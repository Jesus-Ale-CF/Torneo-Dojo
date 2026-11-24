export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeDasharray="140 40" transform="rotate(-60 32 32)" className="text-shu" />
      <rect x="26" y="20" width="12" height="24" rx="2" className="fill-ink" />
    </svg>
  );
}
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <span className="font-display text-xl font-black leading-none tracking-tight">
          Zenkai<span className="text-shu">·</span>Dojo
        </span>
      )}
    </span>
  );
}
