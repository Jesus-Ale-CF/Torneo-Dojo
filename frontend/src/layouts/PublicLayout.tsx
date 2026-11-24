import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Home, Trophy, LogIn, LayoutDashboard, Tablet } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/lib/auth';

export function PublicLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const panel = user?.role === 'ADMIN' ? { to: '/admin', label: 'Panel', icon: LayoutDashboard } : user?.role === 'TABLE' ? { to: '/mesa', label: 'Mesa', icon: Tablet } : { to: '/login', label: 'Entrar', icon: LogIn };
  const items = [{ to: '/', label: 'Inicio', icon: Home, end: true }, { to: '/torneos', label: 'Torneos', icon: Trophy }, panel];
  const cls = ({ isActive }: { isActive: boolean }) => `flex min-h-touch items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${isActive ? 'bg-elevated text-ink' : 'text-muted hover:text-ink'}`;
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">Saltar al contenido</a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-4">
          <Link to="/" className="rounded-lg" aria-label="Zenkai Dojo, inicio"><Logo /></Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Principal">
            {items.map((it) => <NavLink key={it.to} to={it.to} end={'end' in it ? it.end : undefined} className={cls}><it.icon className="h-4 w-4" aria-hidden />{it.label}</NavLink>)}
            <ThemeToggle className="ml-1" />
          </nav>
          <ThemeToggle className="sm:hidden" />
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-screen-2xl flex-1 px-4 pb-24 pt-6 sm:pb-10">
        <ErrorBoundary scope="página" resetKey={pathname}><Outlet /></ErrorBoundary>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden" aria-label="Principal móvil">
        <ul className="grid grid-cols-3">
          {items.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} end={'end' in it ? it.end : undefined} className={({ isActive }) => `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-shu' : 'text-muted'}`}>
                <it.icon className="h-5 w-5" aria-hidden />{it.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
