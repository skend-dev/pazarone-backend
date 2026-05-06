/** Normalize Infobip webhook JSON (batch shape varies by channel / account settings). */

function pickStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim().length) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

export function normalizeInfobipResultArray(body: unknown): unknown[] {
  if (body === null || body === undefined) return [];
  if (Array.isArray(body)) return body;
  if (typeof body === 'object') {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.messages)) return o.messages;
    if (Array.isArray(o.inboundMessages)) return o.inboundMessages;
    return [body];
  }
  return [];
}

function parseInfobipDate(v: unknown): Date | null {
  const s = pickStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function summarizeError(err: Record<string, unknown> | null): string | null {
  if (!err) return null;
  const name = pickStr(err.name) ?? pickStr(err.groupName);
  const desc = pickStr(err.description) ?? pickStr(err.message);
  const id =
    typeof err.id === 'number'
      ? String(err.id)
      : typeof err.groupId === 'number'
        ? String(err.groupId)
        : null;
  const parts = [name, id, desc].filter(Boolean);
  if (!parts.length) return null;
  return parts.slice(0, 3).join(' · ').slice(0, 2000);
}

export type ParsedDeliveryFlat = {
  messageId: string | null;
  bulkId: string | null;
  channel: string | null;
  destination: string | null;
  statusGroup: string | null;
  statusName: string | null;
  statusId: number | null;
  errorSummary: string | null;
  sentAt: Date | null;
  doneAt: Date | null;
  rawPayload: Record<string, unknown>;
};

export function parseInfobipDeliveryItem(item: unknown): ParsedDeliveryFlat {
  const row =
    item && typeof item === 'object'
      ? (item as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const status =
    row.status && typeof row.status === 'object'
      ? (row.status as Record<string, unknown>)
      : null;
  const err =
    row.error && typeof row.error === 'object'
      ? (row.error as Record<string, unknown>)
      : null;
  const statusId =
    typeof status?.id === 'number'
      ? status.id
      : typeof status?.id === 'string' && /^\d+$/.test(status.id)
        ? parseInt(status.id, 10)
        : null;

  return {
    messageId: pickStr(row.messageId) ?? pickStr(row.messageID),
    bulkId: pickStr(row.bulkId),
    channel: pickStr(row.channel),
    destination: pickStr(row.to) ?? pickStr(row.destination),
    statusGroup: status ? pickStr(status.groupName) : null,
    statusName: status ? pickStr(status.name) : null,
    statusId,
    errorSummary: summarizeError(err),
    sentAt: parseInfobipDate(row.sentAt),
    doneAt: parseInfobipDate(row.doneAt),
    rawPayload: row,
  };
}

export type ParsedInboundFlat = {
  messageId: string | null;
  fromMsisdn: string | null;
  toDestination: string | null;
  channel: string | null;
  textBody: string | null;
  receivedAt: Date | null;
  rawPayload: Record<string, unknown>;
};

export function parseInfobipInboundItem(item: unknown): ParsedInboundFlat {
  const row =
    item && typeof item === 'object'
      ? (item as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const text =
    pickStr(row.text) ??
    pickStr(row.cleanText) ??
    pickStr(row.body) ??
    pickStr(row.content);

  return {
    messageId: pickStr(row.messageId) ?? pickStr(row.messageID),
    fromMsisdn: pickStr(row.from) ?? pickStr(row.msisdn),
    toDestination: pickStr(row.to),
    channel: pickStr(row.channel),
    textBody: text,
    receivedAt: parseInfobipDate(row.receivedAt) ?? parseInfobipDate(row.sentAt),
    rawPayload: row,
  };
}
