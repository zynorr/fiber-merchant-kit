/**
 * Webhook Delivery Engine
 *
 * Responsible for delivering webhook events to registered merchant endpoints
 * with automatic retry (exponential backoff) and delivery logging.
 */

import { createDelivery, updateDelivery, listWebhooks } from '../db';
import type { DbWebhook, DbWebhookDelivery } from '../db/types';
import crypto from 'crypto';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

function parseDeliveryPayload(payload: string | null): Record<string, unknown> {
  if (!payload) return {};
  const parsed = JSON.parse(payload) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Stored webhook payload is not an object');
  }
  return parsed as Record<string, unknown>;
}

function queueDelivery(
  deliveryId: string,
  url: string,
  secret: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  void deliverWithRetry(deliveryId, url, secret, event, payload)
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      updateDelivery(deliveryId, {
        statusCode: 0,
        success: false,
        attempts: 1,
        error: message,
      });
      console.error(`[Webhook] Unexpected delivery failure: ${message}`);
    });
}

/**
 * Dispatch a webhook event to all registered webhooks matching that event type
 */
export async function dispatchWebhookEvent(
  event: string,
  payload: Record<string, unknown>,
  options: { merchantId?: string; webhookId?: string } = {},
): Promise<void> {
  const webhooks = listWebhooks(options.merchantId);

  const matching = webhooks.filter((wh) => {
    const events = (typeof wh.events === 'string' ? JSON.parse(wh.events as string) : wh.events) as string[];
    return events.includes(event) && (!options.webhookId || wh.id === options.webhookId);
  });

  for (const webhook of matching) {
    const deliveryId = crypto.randomUUID();
    createDelivery({
      id: deliveryId,
      webhookId: webhook.id as string,
      event,
      url: webhook.url as string,
      payload,
    });

    // Fire-and-forget with retries
    queueDelivery(deliveryId, webhook.url as string, webhook.secret as string, event, payload);
  }
}

/**
 * Replay an existing delivery by creating a fresh delivery log and queueing it.
 */
export function replayWebhookDelivery(
  webhook: DbWebhook,
  original: DbWebhookDelivery,
): DbWebhookDelivery {
  const payload = parseDeliveryPayload(original.payload);
  const delivery = createDelivery({
    id: crypto.randomUUID(),
    webhookId: webhook.id,
    event: original.event,
    url: webhook.url,
    payload,
  });

  queueDelivery(delivery.id, webhook.url, webhook.secret, original.event, payload);
  return delivery;
}

function getRetryDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
}

/**
 * Deliver a webhook payload with retry logic (exponential backoff)
 */
async function deliverWithRetry(
  deliveryId: string,
  url: string,
  secret: string,
  event: string,
  payload: Record<string, unknown>,
  attempt: number = 1
): Promise<void> {
  try {
    const body = JSON.stringify({
      id: deliveryId,
      type: event,
      created: new Date().toISOString(),
      data: payload,
    });

    const signature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Fiber-Signature': signature,
        'X-Fiber-Event': event,
        'User-Agent': 'Fiber-Merchant-Kit/1.0',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status < 200 || response.status >= 300) {
      updateDelivery(deliveryId, {
        statusCode: response.status,
        success: false,
        attempts: attempt,
        error: `HTTP ${response.status}`,
      });

      if (attempt < MAX_RETRIES) {
        const delay = getRetryDelay(attempt);
        console.warn(
          `[Webhook] Delivery returned HTTP ${response.status} (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return deliverWithRetry(deliveryId, url, secret, event, payload, attempt + 1);
      }

      console.error(`[Webhook] Delivery failed after ${MAX_RETRIES} attempts: HTTP ${response.status}`);
      return;
    }

    updateDelivery(deliveryId, {
      statusCode: response.status,
      success: true,
      attempts: attempt,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    updateDelivery(deliveryId, {
      statusCode: 0,
      success: false,
      attempts: attempt,
      error: errorMessage,
    });

    if (attempt < MAX_RETRIES) {
      const delay = getRetryDelay(attempt);
      console.warn(
        `[Webhook] Delivery failed (attempt ${attempt}/${MAX_RETRIES}): ${errorMessage}. Retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return deliverWithRetry(deliveryId, url, secret, event, payload, attempt + 1);
    }

    updateDelivery(deliveryId, {
      statusCode: 0,
      success: false,
      attempts: attempt,
      error: `Max retries exceeded: ${errorMessage}`,
    });

    console.error(`[Webhook] Delivery failed after ${MAX_RETRIES} attempts: ${errorMessage}`);
  }
}
