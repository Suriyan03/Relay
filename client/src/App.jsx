import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useSession } from './context/Session.jsx';
import { DataProvider, useData } from './context/Data.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { Spinner } from './components/ui.jsx';
import ClientPortal from './pages/ClientPortal.jsx';

function RequireAssistant() {
  const { session } = useSession();
  const loc = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return (
    <DataProvider>
      <Gate />
    </DataProvider>
  );
}

/** Sends people without a connected account to onboarding, everyone else to the inbox. */
function Gate() {
  const { loaded, accounts } = useData();
  const { pathname } = useLocation();
  if (!loaded) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  const has = accounts.length > 0;
  if (!has && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

function Home() {
  const { session } = useSession();
  return <Navigate to={session ? '/app' : '/login'} replace />;
}

export default function App() {
  return (
        <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/c/:token" element={<ClientPortal />} />
      <Route element={<RequireAssistant />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/app/*" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}