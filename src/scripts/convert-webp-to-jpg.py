#!/usr/bin/env python3
"""Convert product Cloudinary originals from WebP to JPG (overwrite in place)."""

from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API_BASE = "https://pazarone-backend-prod.up.railway.app/api/products"
OUT_DIR = Path(__file__).resolve().parent / ".webp-convert"


def load_env() -> dict[str, str]:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    values: dict[str, str] = {}
    for line in env_path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def ext_of(url: str) -> str:
    path = urllib.parse.urlparse(url).path.lower()
    name = path.rsplit("/", 1)[-1]
    return name.rsplit(".", 1)[-1] if "." in name else ""


def split_urls(value: str) -> list[str]:
    if "," in value and "http" in value.split(",", 1)[1]:
        return [part.strip() for part in value.split(",") if part.strip()]
    return [value]


def public_id_from_url(url: str) -> str | None:
    path = urllib.parse.urlparse(url.split("?")[0]).path
    marker = "/upload/"
    if marker not in path:
        return None
    rest = path.split(marker, 1)[1]
    parts = rest.split("/")
    if parts and parts[0].startswith("v") and parts[0][1:].isdigit():
        parts = parts[1:]
    if not parts:
        return None
    last = parts[-1]
    if "." in last:
        parts[-1] = last.rsplit(".", 1)[0]
    return "/".join(parts)


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "pazarone-webp-convert"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def collect_webp_urls() -> tuple[list[str], list[dict]]:
    unique: dict[str, str] = {}
    products_touched: list[dict] = []
    page = 1
    fetched = 0
    total = None
    while True:
        data = fetch_json(f"{API_BASE}?page={page}&limit=100")
        products = data.get("products") or []
        total = (data.get("pagination") or {}).get("total")
        fetched += len(products)
        for product in products:
            images = []
            for raw in product.get("images") or []:
                if isinstance(raw, str):
                    images.extend(split_urls(raw))
            variants = product.get("variants") or []
            for variant in variants:
                for raw in variant.get("images") or []:
                    if isinstance(raw, str):
                        images.extend(split_urls(raw))
            webps = [
                url
                for url in images
                if "cloudinary.com" in url and ext_of(url) == "webp"
            ]
            if not webps:
                continue
            products_touched.append(
                {"id": product.get("id"), "name": product.get("name"), "webp": webps}
            )
            for url in webps:
                unique[url] = url
        print(f"collected page {page} ({fetched}/{total})", flush=True)
        if not products or fetched >= (total or 0):
            break
        page += 1
        time.sleep(0.1)
    return sorted(unique), products_touched


def convert_one(url: str, cloud: str, key: str, secret: str) -> dict:
    public_id = public_id_from_url(url)
    if not public_id:
        return {"url": url, "ok": False, "error": "no public_id"}
    fields = {
        "file": url,
        "public_id": public_id,
        "overwrite": "1",
        "invalidate": "1",
        "format": "jpg",
    }
    body = urllib.parse.urlencode(fields).encode()
    endpoint = f"https://api.cloudinary.com/v1_1/{cloud}/image/upload"
    auth = base64.b64encode(f"{key}:{secret}".encode()).decode()
    req = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={"Authorization": f"Basic {auth}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode())
        return {
            "url": url,
            "ok": True,
            "public_id": result.get("public_id"),
            "format": result.get("format"),
            "bytes": result.get("bytes"),
            "secure_url": result.get("secure_url"),
        }
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:400]
        return {"url": url, "ok": False, "public_id": public_id, "error": detail}


def head_type(url: str) -> str:
    req = urllib.request.Request(
        url, method="HEAD", headers={"User-Agent": "pazarone-webp-convert"}
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.headers.get("Content-Type") or ""
    except Exception as exc:  # noqa: BLE001
        return f"error:{exc}"


def main() -> None:
    env = load_env()
    cloud = env["CLOUDINARY_CLOUD_NAME"]
    key = env["CLOUDINARY_API_KEY"]
    secret = env["CLOUDINARY_API_SECRET"]
    OUT_DIR.mkdir(exist_ok=True)

    urls_path = OUT_DIR / "webp-urls.json"
    products_path = OUT_DIR / "webp-products.json"
    if urls_path.exists() and products_path.exists():
        urls = json.loads(urls_path.read_text())
        products = json.loads(products_path.read_text())
        print("reusing collected webp url list", flush=True)
    else:
        urls, products = collect_webp_urls()
        urls_path.write_text(json.dumps(urls, indent=2))
        products_path.write_text(json.dumps(products, indent=2, ensure_ascii=False))
    print(f"unique webp urls: {len(urls)} across {len(products)} products", flush=True)

    results = []
    for index, url in enumerate(urls, start=1):
        result = convert_one(url, cloud, key, secret)
        results.append(result)
        status = "OK" if result["ok"] else "FAIL"
        print(f"[{index}/{len(urls)}] {status} {result.get('public_id') or url}", flush=True)
        time.sleep(0.15)

    ok = [item for item in results if item["ok"]]
    failed = [item for item in results if not item["ok"]]
    summary = {
        "unique_webp": len(urls),
        "converted": len(ok),
        "failed": len(failed),
        "failures": failed,
    }
    (OUT_DIR / "convert-results.json").write_text(json.dumps(results, indent=2))
    (OUT_DIR / "convert-summary.json").write_text(json.dumps(summary, indent=2))

    if ok:
        sample = ok[0]
        original = sample["url"]
        jpg_url = sample.get("secure_url") or original.rsplit(".", 1)[0] + ".jpg"
        summary["sample_check"] = {
            "original_url": original,
            "original_content_type": head_type(original),
            "jpg_url": jpg_url,
            "jpg_content_type": head_type(jpg_url),
        }
        (OUT_DIR / "convert-summary.json").write_text(json.dumps(summary, indent=2))

    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
