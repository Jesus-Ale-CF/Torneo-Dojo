import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, Settings, LayoutList, Users, Scale, GitBranch, Grid3X3, History, Download, Info } from 'lucide-react';
import { fmtRange } from '@/lib/format';
import { PageHeader } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { TournamentBadge } from '@/components/ui/Badge';
import { ListSkeleton, ErrorState } from '@/components/ui/States';
import { useTournament } from './tournament/shared';
import { SummaryTab } from './tournament/SummaryTab';
import { ConfigTab } from './tournament/ConfigTab';
import { CategoriesTab } from './tournament/CategoriesTab';
import { RegistrationsTab } from './tournament/RegistrationsTab';
import { WeighInTab } from './tournament/WeighInTab';
import { BracketsTab } from './tournament/BracketsTab';
import { MatsTab } from './tournament/MatsTab';
import { AuditTab } from './tournament/AuditTab';
import { ExportTab } from './tournament/ExportTab';

const ic = 'h-4 w-4';
/** Una frase por pestaña: qué se hace aquí y qué viene después. */
const HELP: Record<string, string> = {
  resumen: 'Estado del torneo y guía paso a paso. Pulsa cualquier paso para ir a su pestaña.',
  configuracion: 'Paso 1 · Datos del torneo, divisiones de peso y grupos de edad. Después: Categorías.',
  categorias: 'Paso 2 · Crea las categorías en las que competirán los atletas. Después: Inscripciones.',
  inscripciones: 'Paso 3 · Inscribe atletas (uno a uno o importando Excel) y asígnales categoría. Después: Pesaje.',
  pesaje: 'Paso 4 · Anota el peso de cada atleta. Si no da el peso, el sistema sugiere otra categoría. Después: Llaves.',
  llaves: 'Paso 5 · Genera la llave de cada categoría. Toca un combate para registrar o corregir su resultado. Después: Tatamis.',
  tatamis: 'Paso 6 · Crea los tatamis, reparte las categorías y asigna los usuarios de mesa. Después: la mesa registra los resultados.',
  auditoria: 'Historial de todos los resultados registrados y corregidos, con quién y por qué.',
  exportar: 'Descarga llaves, horarios y resultados en PDF, o el Excel completo del torneo.',
};
const TABS = [
  { key: 'resumen', label: 'Resumen', icon: <LayoutDashboard className={ic} aria-hidden /> },
  { key: 'configuracion', label: 'Configuración', icon: <Settings className={ic} aria-hidden /> },
  { key: 'categorias', label: 'Categorías', icon: <LayoutList className={ic} aria-hidden /> },
  { key: 'inscripciones', label: 'Inscripciones', icon: <Users className={ic} aria-hidden /> },
  { key: 'pesaje', label: 'Pesaje', icon: <Scale className={ic} aria-hidden /> },
  { key: 'llaves', label: 'Llaves', icon: <GitBranch className={ic} aria-hidden /> },
  { key: 'tatamis', label: 'Tatamis', icon: <Grid3X3 className={ic} aria-hidden /> },
  { key: 'auditoria', label: 'Auditoría', icon: <History className={ic} aria-hidden /> },
  { key: 'exportar', label: 'Exportar', icon: <Download className={ic} aria-hidden /> },
];

export function TournamentAdminPage() {
  const { id = '', tab = 'resumen' } = useParams();
  const nav = useNavigate();
  const t = useTournament(id);
  if (t.isLoading) return <ListSkeleton />;
  if (t.isError || !t.data) return <ErrorState error={t.error} retry={() => t.refetch()} />;
  const tour = t.data;
  return (
    <>
      <Link to="/admin/torneos" className="btn-ghost -ml-3 mb-2 text-sm"><ArrowLeft className="h-4 w-4" aria-hidden />Torneos</Link>
      <PageHeader eyebrow={tour.sport.name} title={tour.name} subtitle={<span className="flex flex-wrap items-center gap-2"><TournamentBadge status={tour.status} /><span>{tour.venue} · {fmtRange(tour.startDate, tour.endDate)}</span></span>} />
      <Tabs id="adm" tabs={TABS} value={tab} onChange={(k) => nav(`/admin/torneos/${id}/${k}`)} />
      <div role="tabpanel" id={`adm-panel-${tab}`} aria-labelledby={`adm-${tab}`} className="pt-4">
        {HELP[tab] && <p className="mb-5 flex items-start gap-2 text-sm text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{HELP[tab]}</p>}
        {tab === 'resumen' && <SummaryTab t={tour} />}
        {tab === 'configuracion' && <ConfigTab key={tour.id} t={tour} />}
        {tab === 'categorias' && <CategoriesTab t={tour} />}
        {tab === 'inscripciones' && <RegistrationsTab t={tour} />}
        {tab === 'pesaje' && <WeighInTab t={tour} />}
        {tab === 'llaves' && <BracketsTab t={tour} />}
        {tab === 'tatamis' && <MatsTab t={tour} />}
        {tab === 'auditoria' && <AuditTab t={tour} />}
        {tab === 'exportar' && <ExportTab t={tour} />}
      </div>
    </>
  );
}
