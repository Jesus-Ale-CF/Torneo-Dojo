import type { Belt } from '@/lib/types';

/** Insignia de cinturón con los colores reales; incluye el nombre como texto (no solo color). */
export function BeltBadge({ belt, size = 'md', showName = true }: { belt: Belt | null | undefined; size?: 'sm' | 'md' | 'lg'; showName?: boolean }) {
  if (!belt) return <span className="text-muted text-sm">—</span>;
  const h = size === 'sm' ? 'h-2.5 w-7' : size === 'lg' ? 'h-4 w-12' : 'h-3 w-9';
  const light = isLight(belt.color);
  return (
    <span className="inline-flex items-center gap-1.5 align-middle" title={`Cinturón ${belt.name}`}>
      <span className={`relative inline-block ${h} rounded-[3px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.25)] overflow-hidden`} style={{ background: belt.color }} aria-hidden>
        {belt.secondary && <span className="absolute inset-y-0 right-[18%] w-[22%]" style={{ background: belt.secondary }} />}
        {light && <span className="absolute inset-0 ring-1 ring-inset ring-black/20 rounded-[3px]" />}
      </span>
      {showName && <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-ink`}>{belt.name}</span>}
    </span>
  );
}
function isLight(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}
