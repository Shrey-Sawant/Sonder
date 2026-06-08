import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Navigation from './src/components/Navigation';
import ThemeToggle from './src/components/ThemeToggle';
import Dashboard from './src/pages/Dashboard';
import Companion from './src/pages/Companion';
import Sanctuary from './src/pages/Sanctuary';
import Connect from './src/pages/Connect';
import Insight from './src/pages/Insight';
import Journal from './src/pages/Journal';
import Exercises from './src/pages/Exercises';
import Auth from './src/pages/Auth';
import MyStudents from './src/pages/MyStudents';
import Appointments from './src/pages/Appointments';
import SessionNotes from './src/pages/SessionNotes';
import Analytics from './src/pages/Analytics';
import Alerts from './src/pages/Alerts';
import AdminDashboard from './src/pages/AdminDashboard';
import { AuthProvider, useAuth } from './src/context/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Helper to sync Nav highlights
  const currentPath = location.pathname.split('/')[1] || 'dashboard';

  // 1. Admin Console Gate: Completely bypasses standard app shell
  if (isAuthenticated && user?.role === 'admin') {
    return (
      <ProtectedRoute>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </ProtectedRoute>
    );
  }

  // 2. Student and Counsellor shells
  return (
    <Routes>
      <Route path="/login" element={<Auth initialMode="login" />} />
      <Route path="/signup" element={<Auth initialMode="signup" />} />
      <Route path="/verify" element={<Auth initialMode="verify" />} />

      <Route path="/*" element={
        <ProtectedRoute>
          <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex">
            {/* Sidebar Navigation */}
            <Navigation currentView={currentPath} setView={(v) => navigate(`/${v}`)} />

            <main className="flex-1 md:ml-20 lg:ml-64 min-h-screen flex flex-col relative">
              {/* Header */}
              <header className="sticky top-0 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md p-4 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800">
                <div className="md:hidden flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full"></div>
                  <span className="font-bold text-xl tracking-tighter">Sonder.</span>
                </div>
                <div className="ml-auto flex gap-4 items-center">
                  <button onClick={logout} className="text-xs font-medium text-zinc-500 hover:text-red-500 transition-colors">Logout</button>
                  <ThemeToggle />
                </div>
              </header>

              {/* Main Content Area: Gated based on role as single source of truth */}
              <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full">
                {user?.role === 'counsellor' ? (
                  <Routes>
                    <Route path="dashboard" element={<Dashboard setView={(v) => navigate(`/${v}`)} />} />
                    <Route path="mystudents" element={<MyStudents />} />
                    <Route path="appointments" element={<Appointments />} />
                    <Route path="sessionnotes" element={<SessionNotes />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="alerts" element={<Alerts />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                ) : (
                  <Routes>
                    <Route path="dashboard" element={<Dashboard setView={(v) => navigate(`/${v}`)} />} />
                    <Route path="companion" element={<Companion />} />
                    <Route path="sanctuary" element={<Sanctuary />} />
                    <Route path="connect" element={<Connect />} />
                    <Route path="journal" element={<Journal />} />
                    <Route path="exercises" element={<Exercises />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                )}
              </div>
            </main>
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  </AuthProvider>
);

export default App;