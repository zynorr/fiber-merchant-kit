export type WebhookPayload = string | ArrayBuffer | ArrayBufferView | Record<string, unknown>;

function payloadToBytes(payload: WebhookPayload): Uint8Array<ArrayBuffer> {
  if (typeof payload === 'string') return new TextEncoder().encode(payload);
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
  if (ArrayBuffer.isView(payload)) {
    return Uint8Array.from(new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength));
  }
  return new TextEncoder().encode(JSON.stringify(payload));
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeSignature(signature: string): string {
  return signature.trim().toLowerCase().replace(/^sha256=/, '');
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = normalizeSignature(a);
  const right = normalizeSignature(b);
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let i = 0; i < maxLength; i += 1) {
    const leftCode = i < left.length ? left.charCodeAt(i) : 0;
    const rightCode = i < right.length ? right.charCodeAt(i) : 0;
    diff |= leftCode ^ rightCode;
  }

  return diff === 0;
}

async function hmacSha256Hex(payload: WebhookPayload, secret: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available in this runtime');
  }

  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await globalThis.crypto.subtle.sign('HMAC', key, payloadToBytes(payload));
  return bytesToHex(signature);
}

/**
 * Verify a Fiber Merchant webhook `X-Fiber-Signature` value.
 *
 * Pass the exact raw request body string or bytes when possible. If you pass an
 * object, it is JSON-stringified first, which only verifies correctly when the
 * resulting JSON matches the original delivered body byte-for-byte.
 */
export async function verifyWebhookSignature(
  payload: WebhookPayload,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const expected = await hmacSha256Hex(payload, secret);
  return constantTimeEqual(signature, expected);
}

export async function constructWebhookEvent<T = unknown>(
  payload: WebhookPayload,
  signature: string,
  secret: string,
): Promise<T> {
  const valid = await verifyWebhookSignature(payload, signature, secret);
  if (!valid) {
    throw new Error('Invalid webhook signature');
  }

  if (typeof payload === 'string') return JSON.parse(payload) as T;
  const bytes = payloadToBytes(payload);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
