import { refreshOpenInvoices, type OpenInvoiceSettlementSummary } from './invoice-settlement';

const DEFAULT_INTERVAL_MS = 30_000;
const MIN_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;

let timer: NodeJS.Timeout | undefined;
let running = false;
let lastRunAt: string | undefined;
let lastSuccessAt: string | undefined;
let lastError: string | undefined;
let lastSummary: OpenInvoiceSettlementSummary | undefined;

export type SettlementRunTrigger = 'timer' | 'manual';

export interface SettlementRunResult {
  trigger: SettlementRunTrigger;
  running: boolean;
  skipped: boolean;
  startedAt: string;
  finishedAt?: string;
  summary?: OpenInvoiceSettlementSummary;
  error?: string;
}

export interface SettlementWorkerConfig {
  enabled: boolean;
  active: boolean;
  running: boolean;
  mode: 'demo' | 'live';
  intervalMs: number;
  batchSize: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  lastSummary?: OpenInvoiceSettlementSummary;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readWorkerEnabled(): boolean | undefined {
  const raw = process.env.FIBER_SETTLEMENT_WORKER?.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

export function getSettlementWorkerConfig(): SettlementWorkerConfig {
  const liveMode = Boolean(process.env.FIBER_NODE_RPC_URL && process.env.FIBER_NODE_RPC_URL !== 'demo');
  const explicitEnabled = readWorkerEnabled();
  const intervalMs = Math.max(
    MIN_INTERVAL_MS,
    readPositiveInteger(process.env.FIBER_SETTLEMENT_WORKER_INTERVAL_MS, DEFAULT_INTERVAL_MS),
  );
  const batchSize = Math.min(
    MAX_BATCH_SIZE,
    readPositiveInteger(process.env.FIBER_SETTLEMENT_WORKER_BATCH_SIZE, DEFAULT_BATCH_SIZE),
  );

  return {
    enabled: explicitEnabled ?? liveMode,
    active: Boolean(timer),
    running,
    mode: liveMode ? 'live' : 'demo',
    intervalMs,
    batchSize,
    lastRunAt,
    lastSuccessAt,
    lastError,
    lastSummary,
  };
}

export async function runSettlementSweep(
  trigger: SettlementRunTrigger = 'manual',
): Promise<SettlementRunResult> {
  const startedAt = new Date().toISOString();
  if (running) {
    return {
      trigger,
      running: true,
      skipped: true,
      startedAt,
      error: 'Settlement sweep already running',
    };
  }

  running = true;
  lastRunAt = startedAt;

  try {
    const config = getSettlementWorkerConfig();
    const summary = await refreshOpenInvoices({ limit: config.batchSize });
    const finishedAt = new Date().toISOString();
    lastSummary = summary;
    lastSuccessAt = finishedAt;
    lastError = undefined;

    return {
      trigger,
      running: false,
      skipped: false,
      startedAt,
      finishedAt,
      summary,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const finishedAt = new Date().toISOString();
    lastError = message;
    console.error('[SettlementWorker] Tick failed:', message);
    return {
      trigger,
      running: false,
      skipped: false,
      startedAt,
      finishedAt,
      error: message,
    };
  } finally {
    running = false;
  }
}

async function tick(): Promise<void> {
  const result = await runSettlementSweep('timer');
  const summary = result.summary;
  if (!summary) return;

  const changed = summary.paid + summary.received + summary.expired;
  if (summary.checked > 0 && (changed > 0 || summary.errors > 0)) {
    console.log(
      `[SettlementWorker] checked=${summary.checked} paid=${summary.paid} received=${summary.received} ` +
      `expired=${summary.expired} errors=${summary.errors}`,
    );
  }
}

export function startSettlementWorker(): void {
  const config = getSettlementWorkerConfig();
  if (!config.enabled) {
    console.log(`[SettlementWorker] Disabled (${config.mode} mode).`);
    return;
  }

  if (timer) return;

  timer = setInterval(() => {
    void tick();
  }, config.intervalMs);
  timer.unref();

  console.log(
    `[SettlementWorker] Started interval=${config.intervalMs}ms batchSize=${config.batchSize} mode=${config.mode}.`,
  );
  void tick();
}

export function stopSettlementWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = undefined;
  console.log('[SettlementWorker] Stopped.');
}
