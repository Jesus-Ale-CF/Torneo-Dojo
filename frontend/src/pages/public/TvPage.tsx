import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Maximize, Minimize, ArrowLeft } from 'lucide-react';
import { useLiveMats, useMedals, usePublicTournament } from '@/lib/queries';
import { MatBoard } from '@/components/MatBoard';
import { MedalTable } from '@/components/MedalTable';
import { Logo } from '@/components/ui/Logo';
import { ListSkeleton } from '@/components/ui/States';

/** Modo TV: tipografía grande, rotación automática entre tatamis y medallero, sin interacción necesaria. */
export function TvPage() {
  const { id } = useParams();
  const t = usePublicTournament(id);
  const live = useLiveMats(id);
  const medals = useMedals(id);
  const [screen, setScreen] = useState<'mats' | 'medals'>('mats');
  const [fs, setFs] = useState(false);
  const [clock, setClock] = useState(new Date());

  useEffect(() => { const i = setInterval(() => setClock(new Date()), 1000 * 30); return () => clearInterval(i); }, []);
  useEffect(() => {
    const hasMedals = (medals.data?.academies.length ?? 0) > 0;
    if (!hasMedals) return;
    const i = setInterval(() => setScreen((s) => (s === 'mats' ? 'medals' : 'mats')), 20_000);
    return () => clearInterval(i);
  }, [medals.data]);
  // Escala toda la interfaz (rem) según el ancho de la pantalla: legible a distancia en TV/4K
  useEffect(() => { const root = document.documentElement; const prev = root.style.fontSize; root.style.fontSize = 'clamp(16px, 1.15vw, 30px)'; return () => { root.style.fontSize = prev; }; }, []);
  useEffect(() => { const h = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h); }, []);
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());

  return (
    <div className="tatami-weave min-h-dvh bg-bg p-4 sm:p-6 text-ink lg:p-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          <Logo />
          <div><h1 className="text-3xl leading-none lg:text-4xl">{t.data?.name ?? '…'}</h1><p className="text-muted">{t.data?.venue}</p></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="num text-3xl font-bold" aria-label="Hora">{clock.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
          <Link to={`/t/${id}`} className="btn-ghost" aria-label="Salir del modo TV"><ArrowLeft className="h-5 w-5" /></Link>
          <button onClick={toggleFs} className="btn-secondary" aria-label={fs ? 'Salir de pantalla completa' : 'Pantalla completa'}>{fs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}</button>
        </div>
      </header>
      <AnimatePresence mode="wait">
        <motion.main key={screen} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          {screen === 'mats' ? (
            <>
              <h2 className="label mb-4 text-base">Tatamis en vivo</h2>
              {live.data ? <MatBoard mats={live.data} tv /> : <ListSkeleton rows={3} />}
            </>
          ) : (
            <>
              <h2 className="label mb-4 text-base">Medallero</h2>
              {medals.data && <MedalTable medals={medals.data} tv />}
            </>
          )}
        </motion.main>
      </AnimatePresence>
      <div className="mt-8 flex justify-center gap-2" aria-hidden>
        <span className={`h-2 w-8 rounded-full ${screen === 'mats' ? 'bg-shu' : 'bg-line'}`} /><span className={`h-2 w-8 rounded-full ${screen === 'medals' ? 'bg-shu' : 'bg-line'}`} />
      </div>
    </div>
  );
}
