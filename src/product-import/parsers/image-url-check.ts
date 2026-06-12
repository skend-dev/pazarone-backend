const CHECK_TIMEOUT_MS = 8000;
const IMAGE_CONTENT_TYPES = /^image\//i;

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (compatible; PazarOne/1.0; +https://pazarone.mk) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface ImageUrlCheckResult {
  ok: boolean;
  status: number | null;
  /** Server blocked verification (e.g. hotlink protection) — not treated as broken. */
  inconclusive?: boolean;
}

function buildRequestHeaders(url: string): Record<string, string> {
  let origin = '';
  try {
    origin = new URL(url).origin;
  } catch {
    /* ignore invalid URLs */
  }

  return {
    'User-Agent': BROWSER_USER_AGENT,
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    ...(origin ? { Referer: `${origin}/` } : {}),
  };
}

export function looksLikeImageBytes(bytes: Uint8Array, contentType: string): boolean {
  if (IMAGE_CONTENT_TYPES.test(contentType)) {
    return true;
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return true;
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return true;
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return true;
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49) {
    return true;
  }

  return false;
}

async function readResponseSample(
  response: Response,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const contentType = response.headers.get('content-type') || '';
  const buffer = new Uint8Array(await response.arrayBuffer());
  return { bytes: buffer.slice(0, 512), contentType };
}

async function fetchImageSample(
  url: string,
  method: 'GET' | 'HEAD',
  signal: AbortSignal,
): Promise<Response> {
  const headers = buildRequestHeaders(url);
  if (method === 'GET') {
    return fetch(url, {
      method: 'GET',
      signal,
      redirect: 'follow',
      headers: { ...headers, Range: 'bytes=0-511' },
    });
  }

  return fetch(url, {
    method: 'HEAD',
    signal,
    redirect: 'follow',
    headers,
  });
}

export async function checkImageUrl(url: string): Promise<ImageUrlCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    let response = await fetchImageSample(url, 'GET', controller.signal);
    const retryStatuses = new Set([405, 501]);

    if (retryStatuses.has(response.status)) {
      response = await fetchImageSample(url, 'HEAD', controller.signal);
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        return {
          ok:
            IMAGE_CONTENT_TYPES.test(contentType) ||
            contentType === '' ||
            response.status === 206,
          status: response.status,
        };
      }
    }

    const status = response.status;

    if (status === 403 || status === 429) {
      return { ok: false, status, inconclusive: true };
    }

    if (!response.ok) {
      return { ok: false, status };
    }

    const { bytes, contentType } = await readResponseSample(response);
    if (looksLikeImageBytes(bytes, contentType)) {
      return { ok: true, status };
    }

    if (contentType.includes('text/html')) {
      return { ok: false, status };
    }

    return { ok: false, status };
  } catch {
    return { ok: false, status: null, inconclusive: true };
  } finally {
    clearTimeout(timeout);
  }
}
