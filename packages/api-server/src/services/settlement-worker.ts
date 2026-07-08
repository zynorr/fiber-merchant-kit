import { refreshOpenInvoices } from './invoice-settlement';

const DEFAULT_INTERVAL_MS = 30_000;
const MIN_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;

let timer: NodeJS.Timeout | undefined;
let running = false;

export interface SettlementWorkerConfig {
  enabled: boolean;
  active: boolean;
  running: boolean;
  mode: 'demo' | 'live';
  intervalMs: number;
  batchSize: number;
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
  };
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const config = getSettlementWorkerConfig();
    const summary = await refreshOpenInvoices({ limit: config.batchSize });
    const changed = summary.paid + summary.received + summary.expired;

    if (summary.checked > 0 && (changed > 0 || summary.errors > 0)) {
      console.log(
        `[SettlementWorker] checked=${summary.checked} paid=${summary.paid} received=${summary.received} ` +
        `expired=${summary.expired} errors=${summary.errors}`,
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[SettlementWorker] Tick failed:', message);
  } finally {
    running = false;
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
