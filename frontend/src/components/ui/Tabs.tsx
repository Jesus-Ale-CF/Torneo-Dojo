import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export interface Tab { key: string; label: string; icon?: ReactNode; count?: number }
export function Tabs({ tabs, value, onChange, id = 'tabs' }: { tabs: Tab[]; value: string; onChange: (k: string) => void; id?: string }) {
  return (
    <div role="tablist" aria-label="Secciones" className="scrollbar-thin tabs-scroll -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 pr-10 sm:mx-0 sm:pl-0 lg:pr-0">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button key={t.key} role="tab" id={`${id}-${t.key}`} aria-selected={active} aria-controls={`${id}-panel-${t.key}`} onClick={() => onChange(t.key)}
            className={`relative flex min-h-touch shrink-0 items-center gap-2 px-3 text-sm font-semibold transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}>
            {t.icon}
            {t.label}
            {t.count != null && <span className="num rounded-md bg-elevated px-1.5 text-xs">{t.count}</span>}
            {active && <motion.span layoutId={`${id}-ind`} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-shu" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          </button>
        );
      })}
    </div>
  );
}
