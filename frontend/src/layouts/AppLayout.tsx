import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, Link, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Menu, X, LogOut, Eye } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';

export interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean }

/** Layout para roles con sesión: barra lateral en PC, barra inferior en móvil/tablet. */
export function AppLayout({ items, role, title }: { items: NavItem[]; role: Role | Role[]; title: string }) {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  if (loading) return <div className="grid min-h-dvh place-items-center text-muted" role="status">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/mesa'} replace />;

  const link = ({ isActive }: { isActive: boolean }) => `flex min-h-touch items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${isActive ? 'bg-shu/10 text-shu' : 'text-muted hover:bg-elevated hover:text-ink'}`;
  const mobileItems = items.slice(0, 4);

  return (
    <div className="flex min-h-dvh">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">Saltar al contenido</a>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center px-5"><Link to="/" aria-label="Torneo Dojo, inicio"><Logo /></Link></div>
        <div className="px-5 pb-2"><span className="label">{title}</span></div>
        <nav className="flex-1 space-y-1 px-3" aria-label={title}>{items.map((it) => <NavLink key={it.to} to={it.to} end={it.end} className={link}>{it.icon}{it.label}</NavLink>)}</nav>
        <div className="border-t border-line p-3">
          <div className="mb-2 px-2 text-sm"><div className="truncate font-semibold">{user.name}</div><div className="truncate text-xs text-muted">{user.email}</div></div>
          <div className="flex items-center gap-1">
            <Link to="/" className="btn-ghost flex-1 justify-start text-sm"><Eye className="h-4 w-4" aria-hidden />Vista pública</Link>
            <ThemeToggle />
            <button onClick={logout} className="btn-ghost h-11 w-11 px-0" aria-label="Cerrar sesión"><LogOut className="h-5 w-5" /></button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur lg:hidden">
          <Link to="/" aria-label="Torneo Dojo, inicio"><Logo /></Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button className="btn-ghost h-11 w-11 px-0" onClick={() => setOpen(true)} aria-label="Abrir menú" aria-expanded={open}><Menu className="h-5 w-5" /></button>
          </div>
        </header>
        <main id="contenido" className="mx-auto w-full max-w-screen-2xl flex-1 px-4 pb-24 pt-6 lg:pb-10">
          <ErrorBoundary scope="página" resetKey={pathname}><Outlet /></ErrorBoundary>
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={`${title} móvil`}>
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}>
            {mobileItems.map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} end={it.end} className={({ isActive }) => `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-shu' : 'text-muted'}`}>
                  {it.icon}<span className="truncate">{it.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-ink/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} aria-hidden />
            <motion.div role="dialog" aria-label="Menú" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-surface shadow-lift">
              <div className="flex h-16 items-center justify-between px-4"><span className="label">{title}</span><button className="btn-ghost h-11 w-11 px-0" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X className="h-5 w-5" /></button></div>
              <nav className="flex-1 space-y-1 px-3">{items.map((it) => <NavLink key={it.to} to={it.to} end={it.end} onClick={() => setOpen(false)} className={link}>{it.icon}{it.label}</NavLink>)}</nav>
              <div className="border-t border-line p-4">
                <div className="mb-3 text-sm"><div className="font-semibold">{user.name}</div><div className="text-xs text-muted">{user.email}</div></div>
                <div className="flex gap-2"><Link to="/" className="btn-secondary flex-1"><Eye className="h-4 w-4" aria-hidden />Vista pública</Link><button onClick={logout} className="btn-ghost"><LogOut className="h-4 w-4" aria-hidden />Salir</button></div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
