/**
 * Webhook Delivery Engine
 *
 * Responsible for delivering webhook events to registered merchant endpoints
 * with automatic retry (exponential backoff) and delivery logging.
 */

import { createDelivery, updateDelivery, listWebhooks } from '../db';
import crypto from 'crypto';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

/**
 * Dispatch a webhook event to all registered webhooks matching that event type
 */
export async function dispatchWebhookEvent(
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const webhooks = listWebhooks();

  const matching = webhooks.filter((wh) => {
    const events = (typeof wh.events === 'string' ? JSON.parse(wh.events as string) : wh.events) as string[];
    return events.includes(event);
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
    deliverWithRetry(deliveryId, webhook.url as string, webhook.secret as string, event, payload);
  }
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

    updateDelivery(deliveryId, {
      statusCode: response.status,
      success: response.status >= 200 && response.status < 300,
      attempts: attempt,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
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
