import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion';

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <motion.header variants={fadeUp} initial="hidden" animate="show" className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="label mb-1">{eyebrow}</div>}
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.header>
  );
}
export function Section({ title, children, actions, className = '' }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`mb-8 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
