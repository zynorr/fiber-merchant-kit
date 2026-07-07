export function formatCkbAmount(amount: string | number): string {
  const ckb = Number(amount) / 1e8;
  if (!Number.isFinite(ckb)) return '0.00';
  if (ckb > 0 && ckb < 1) return ckb.toFixed(6);
  return ckb.toFixed(2);
}
