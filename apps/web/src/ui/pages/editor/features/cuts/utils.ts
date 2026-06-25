export function percentage(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${(value / total) * 100}%`;
}

export function formatTimeRange(startSec: number, endSec: number): string {
  return `${formatMinutesSeconds(startSec)} → ${formatMinutesSeconds(endSec)}`;
}

export function formatMinutesSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}
