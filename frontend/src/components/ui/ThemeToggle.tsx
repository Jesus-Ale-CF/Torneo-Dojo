import { Moon, Sun, MonitorSmartphone } from 'lucide-react';
import { useTheme } from '@/lib/theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { pref, cycle } = useTheme();
  const label = pref === 'system' ? 'Tema: automático' : pref === 'light' ? 'Tema: claro' : 'Tema: oscuro';
  const Icon = pref === 'system' ? MonitorSmartphone : pref === 'light' ? Sun : Moon;
  return (
    <button onClick={cycle} className={`btn-ghost h-11 w-11 px-0 ${className}`} aria-label={`${label}. Pulsa para cambiar`} title={label}>
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
