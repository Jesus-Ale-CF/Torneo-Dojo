import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, LogIn } from 'lucide-react';
import { Logo, LogoMark } from '@/components/ui/Logo';
import { FormErrors, Input } from '@/components/ui/Field';
import { fieldErrorsOf } from '@/lib/hooks';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/lib/auth';

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string> | undefined>();
  const [busy, setBusy] = useState(false);
  if (!loading && user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/mesa'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setFields(undefined);
    try {
      const u = await login(email, password);
      nav(u.role === 'ADMIN' ? '/admin' : '/mesa', { replace: true });
    } catch (err) {
      const f = fieldErrorsOf(err);
      if (f) setFields(f);
      else setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="tatami-weave relative hidden flex-col justify-between bg-elevated p-10 lg:flex">
        <Link to="/" aria-label="Zenkai Dojo, inicio"><Logo /></Link>
        <div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}><LogoMark className="h-40 w-40" /></motion.div>
          <h1 className="mt-8 max-w-md text-4xl leading-tight">全快 — <span className="text-shu">Zenkai</span>: recuperación completa, energía total.</h1>
          <p className="mt-4 max-w-md text-muted">Gestiona el torneo entero desde una sola pantalla: inscripciones, pesaje, llaves, tatamis y medallero. La mesa registra, el público lo ve en vivo.</p>
        </div>
        <p className="text-xs text-muted">Acceso restringido a organización y mesas de control. El público no necesita cuenta.</p>
      </section>
      <section className="flex flex-col p-4 sm:p-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="btn-ghost -ml-2 text-sm"><ArrowLeft className="h-4 w-4" aria-hidden />Vista pública</Link>
          <ThemeToggle />
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="m-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="text-2xl">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-muted">Administración y mesa de control.</p>
          <form onSubmit={submit} className="mt-6" noValidate><FormErrors errors={fields}><div className="space-y-4">
            <Input label="Correo electrónico" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@zenkai.dojo" />
            <Input label="Contraseña" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p role="alert" className="rounded-lg border border-shu/40 bg-shu/10 px-3 py-2 text-sm text-shu">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}><LogIn className="h-4 w-4" aria-hidden />{busy ? 'Entrando…' : 'Entrar'}</button>
          </div></FormErrors></form>
          <div className="mt-8 rounded-lg border border-dashed border-line p-3 text-xs text-muted">
            <p className="label mb-1">Credenciales de prueba</p>
            <p>Admin: <code className="num">admin@zenkai.dojo</code> / <code className="num">admin123</code></p>
            <p>Mesa: <code className="num">mesa@zenkai.dojo</code> / <code className="num">mesa123</code></p>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
