import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Trophy, Swords, Users, Building2, UserCog, Tablet } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicLayout } from './layouts/PublicLayout';
import { AppLayout } from './layouts/AppLayout';
import { HomePage } from './pages/public/HomePage';
import { TournamentsPage } from './pages/public/TournamentsPage';
import { TournamentPage } from './pages/public/TournamentPage';
import { CategoryPage } from './pages/public/CategoryPage';
import { TvPage } from './pages/public/TvPage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { SportsPage } from './pages/admin/SportsPage';
import { AdminTournamentsPage } from './pages/admin/AdminTournamentsPage';
import { TournamentAdminPage } from './pages/admin/TournamentAdminPage';
import { AthletesPage } from './pages/admin/AthletesPage';
import { AcademiesPage } from './pages/admin/AcademiesPage';
import { UsersPage } from './pages/admin/UsersPage';
import { TablePage } from './pages/table/TablePage';

const i = 'h-5 w-5';
const adminNav = [
  { to: '/admin', label: 'Inicio', icon: <LayoutDashboard className={i} aria-hidden />, end: true },
  { to: '/admin/torneos', label: 'Torneos', icon: <Trophy className={i} aria-hidden /> },
  { to: '/admin/atletas', label: 'Atletas', icon: <Users className={i} aria-hidden /> },
  { to: '/admin/academias', label: 'Academias', icon: <Building2 className={i} aria-hidden /> },
  { to: '/admin/deportes', label: 'Deportes', icon: <Swords className={i} aria-hidden /> },
  { to: '/admin/usuarios', label: 'Usuarios', icon: <UserCog className={i} aria-hidden /> },
];
const tableNav = [{ to: '/mesa', label: 'Mesa de control', icon: <Tablet className={i} aria-hidden /> }];

export default function App() {
  const loc = useLocation();
  // Animación de ENTRADA de página por sección (clave = primer segmento + id).
  // Sin AnimatePresence/exit: con mode="wait" la animación de salida no siempre terminaba
  // (p. ej. categoría → inicio tras llegar desde el torneo con la misma clave), la página nueva
  // no se montaba y la vieja quedaba en opacity:0 (pantalla en negro sin ninguna excepción).
  const key = loc.pathname.split('/').slice(0, 3).join('/');
  return (
    <motion.div key={key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <ErrorBoundary scope="ruta" resetKey={loc.pathname} fullScreen>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/torneos" element={<TournamentsPage />} />
          <Route path="/t/:id" element={<TournamentPage />} />
          <Route path="/t/:id/c/:cid" element={<CategoryPage />} />
        </Route>
        <Route path="/t/:id/tv" element={<TvPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout items={adminNav} role="ADMIN" title="Administración" />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/torneos" element={<AdminTournamentsPage />} />
          <Route path="/admin/torneos/:id" element={<TournamentAdminPage />} />
          <Route path="/admin/torneos/:id/:tab" element={<TournamentAdminPage />} />
          <Route path="/admin/atletas" element={<AthletesPage />} />
          <Route path="/admin/academias" element={<AcademiesPage />} />
          <Route path="/admin/deportes" element={<SportsPage />} />
          <Route path="/admin/usuarios" element={<UsersPage />} />
        </Route>
        <Route element={<AppLayout items={tableNav} role={['TABLE', 'ADMIN']} title="Mesa de control" />}>
          <Route path="/mesa" element={<TablePage />} />
          <Route path="/mesa/:matId" element={<TablePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </motion.div>
  );
}
