/**
 * Webhook Delivery Engine
 *
 * Stores each delivery as a durable outbox row, attempts due rows, and records
 * retry state back onto the same delivery log.
 */

import crypto from 'crypto';
import {
  createDelivery,
  getWebhookDeliveryJob,
  listDueWebhookDeliveryJobs,
  listWebhooks,
  lockWebhookDelivery,
  updateDelivery,
} from '../db';
import type { DbWebhook, DbWebhookDelivery, DbWebhookDeliveryJob } from '../db/types';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const DEFAULT_QUEUE_INTERVAL_MS = 5_000;
const MIN_QUEUE_INTERVAL_MS = 1_000;
const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;

let timer: NodeJS.Timeout | undefined;
let running = false;
let lastRunAt: string | undefined;
let lastSuccessAt: string | undefined;
let lastError: string | undefined;
let lastSummary: WebhookDeliveryQueueSummary | undefined;

export interface WebhookDeliveryQueueSummary {
  checked: number;
  delivered: number;
  rescheduled: number;
  failed: number;
  skipped: number;
  errors: number;
}

export interface WebhookDeliveryWorkerConfig {
  enabled: boolean;
  active: boolean;
  running: boolean;
  intervalMs: number;
  batchSize: number;
  maxRetries: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  lastSummary?: WebhookDeliveryQueueSummary;
}

type DeliveryOutcome = 'delivered' | 'rescheduled' | 'failed' | 'skipped' | 'error';

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readWorkerEnabled(): boolean {
  const raw = process.env.WEBHOOK_DELIVERY_WORKER?.trim().toLowerCase();
  if (!raw) return true;
  return raw !== 'false';
}

export function getWebhookDeliveryWorkerConfig(): WebhookDeliveryWorkerConfig {
  const intervalMs = Math.max(
    MIN_QUEUE_INTERVAL_MS,
    readPositiveInteger(process.env.WEBHOOK_DELIVERY_WORKER_INTERVAL_MS, DEFAULT_QUEUE_INTERVAL_MS),
  );
  const batchSize = Math.min(
    MAX_BATCH_SIZE,
    readPositiveInteger(process.env.WEBHOOK_DELIVERY_WORKER_BATCH_SIZE, DEFAULT_BATCH_SIZE),
  );

  return {
    enabled: readWorkerEnabled(),
    active: Boolean(timer),
    running,
    intervalMs,
    batchSize,
    maxRetries: MAX_RETRIES,
    lastRunAt,
    lastSuccessAt,
    lastError,
    lastSummary,
  };
}

function parseDeliveryPayload(payload: string | null): Record<string, unknown> {
  if (!payload) return {};
  const parsed = JSON.parse(payload) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Stored webhook payload is not an object');
  }
  return parsed as Record<string, unknown>;
}

function getRetryDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
}

function nextAttemptAt(attempt: number): string | null {
  if (attempt >= MAX_RETRIES) return null;
  return new Date(Date.now() + getRetryDelay(attempt)).toISOString();
}

function queueDelivery(deliveryId: string): void {
  void processWebhookDelivery(deliveryId).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    updateDelivery(deliveryId, {
      statusCode: 0,
      success: false,
      attempts: 1,
      error: message,
      nextAttemptAt: new Date(Date.now() + BASE_DELAY_MS).toISOString(),
    });
    console.error(`[Webhook] Unexpected delivery failure: ${message}`);
  });
}

/**
 * Dispatch a webhook event to all registered webhooks matching that event type.
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
    const delivery = createDelivery({
      id: crypto.randomUUID(),
      webhookId: webhook.id as string,
      event,
      url: webhook.url as string,
      payload,
    });

    queueDelivery(delivery.id);
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

  queueDelivery(delivery.id);
  return delivery;
}

async function processWebhookDelivery(deliveryId: string): Promise<DeliveryOutcome> {
  const job = getWebhookDeliveryJob(deliveryId);
  if (!job) return 'skipped';
  if (!lockWebhookDelivery(deliveryId)) return 'skipped';
  return deliverJob(job);
}

async function deliverJob(job: DbWebhookDeliveryJob): Promise<DeliveryOutcome> {
  const attempt = (job.attempts || 0) + 1;

  try {
    const payload = parseDeliveryPayload(job.payload);
    const body = JSON.stringify({
      id: job.id,
      type: job.event,
      created: new Date().toISOString(),
      data: payload,
    });

    const signature = crypto
      .createHmac('sha256', job.secret)
      .update(body)
      .digest('hex');

    const response = await fetch(job.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Fiber-Signature': signature,
        'X-Fiber-Event': job.event,
        'User-Agent': 'Fiber-Merchant-Kit/1.0',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status >= 200 && response.status < 300) {
      updateDelivery(job.id, {
        statusCode: response.status,
        success: true,
        attempts: attempt,
        nextAttemptAt: null,
      });
      return 'delivered';
    }

    const retryAt = nextAttemptAt(attempt);
    updateDelivery(job.id, {
      statusCode: response.status,
      success: false,
      attempts: attempt,
      error: `HTTP ${response.status}`,
      nextAttemptAt: retryAt,
    });

    if (retryAt) {
      console.warn(
        `[Webhook] Delivery returned HTTP ${response.status} (attempt ${attempt}/${MAX_RETRIES}). ` +
        `Next retry at ${retryAt}.`,
      );
      return 'rescheduled';
    }

    console.error(`[Webhook] Delivery failed after ${MAX_RETRIES} attempts: HTTP ${response.status}`);
    return 'failed';
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const retryAt = nextAttemptAt(attempt);

    updateDelivery(job.id, {
      statusCode: 0,
      success: false,
      attempts: attempt,
      error: retryAt ? errorMessage : `Max retries exceeded: ${errorMessage}`,
      nextAttemptAt: retryAt,
    });

    if (retryAt) {
      console.warn(
        `[Webhook] Delivery failed (attempt ${attempt}/${MAX_RETRIES}): ${errorMessage}. ` +
        `Next retry at ${retryAt}.`,
      );
      return 'rescheduled';
    }

    console.error(`[Webhook] Delivery failed after ${MAX_RETRIES} attempts: ${errorMessage}`);
    return 'failed';
  }
}

export async function processWebhookDeliveryQueue(params: {
  limit?: number;
} = {}): Promise<WebhookDeliveryQueueSummary> {
  if (running) {
    return {
      checked: 0,
      delivered: 0,
      rescheduled: 0,
      failed: 0,
      skipped: 1,
      errors: 0,
    };
  }

  running = true;
  lastRunAt = new Date().toISOString();

  const summary: WebhookDeliveryQueueSummary = {
    checked: 0,
    delivered: 0,
    rescheduled: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const config = getWebhookDeliveryWorkerConfig();
    const limit = Math.min(MAX_BATCH_SIZE, Math.max(1, params.limit || config.batchSize));
    const jobs = listDueWebhookDeliveryJobs(limit, MAX_RETRIES);

    for (const job of jobs) {
      summary.checked += 1;
      const outcome = await processWebhookDelivery(job.id);
      if (outcome === 'delivered') summary.delivered += 1;
      else if (outcome === 'rescheduled') summary.rescheduled += 1;
      else if (outcome === 'failed') summary.failed += 1;
      else if (outcome === 'skipped') summary.skipped += 1;
      else summary.errors += 1;
    }

    lastSummary = summary;
    lastSuccessAt = new Date().toISOString();
    lastError = undefined;
    return summary;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    lastError = message;
    summary.errors += 1;
    console.error('[WebhookWorker] Tick failed:', message);
    return summary;
  } finally {
    running = false;
  }
}

async function tick(): Promise<void> {
  const summary = await processWebhookDeliveryQueue();
  if (summary.checked > 0 && (summary.delivered > 0 || summary.rescheduled > 0 || summary.failed > 0 || summary.errors > 0)) {
    console.log(
      `[WebhookWorker] checked=${summary.checked} delivered=${summary.delivered} ` +
      `rescheduled=${summary.rescheduled} failed=${summary.failed} errors=${summary.errors}`,
    );
  }
}

export function startWebhookDeliveryWorker(): void {
  const config = getWebhookDeliveryWorkerConfig();
  if (!config.enabled) {
    console.log('[WebhookWorker] Disabled.');
    return;
  }

  if (timer) return;

  timer = setInterval(() => {
    void tick();
  }, config.intervalMs);
  timer.unref();

  console.log(
    `[WebhookWorker] Started interval=${config.intervalMs}ms batchSize=${config.batchSize}.`,
  );
  void tick();
}

export function stopWebhookDeliveryWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = undefined;
  console.log('[WebhookWorker] Stopped.');
}
