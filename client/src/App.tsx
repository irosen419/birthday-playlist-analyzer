import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlayerProvider } from './context/PlayerContext';
import LoginPage from './components/auth/LoginPage';
import OnboardingPage from './components/auth/OnboardingPage';
import AppLayout from './components/layout/AppLayout';
import PlaylistList from './components/playlist/PlaylistList';
import PlaylistEditor from './components/playlist/PlaylistEditor';
import AnalysisView from './components/analysis/AnalysisView';
import SettingsPage from './components/settings/SettingsPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorBoundary from './components/common/ErrorBoundary';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/" replace />;
  if (!user.setupCompleted) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

function RootRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (user && !user.setupCompleted) return <Navigate to="/onboarding" replace />;
  if (user) return <Navigate to="/playlists" replace />;

  return <LoginPage />;
}

function OnboardingRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/" replace />;
  if (user.setupCompleted) return <Navigate to="/playlists" replace />;

  return <OnboardingPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/onboarding" element={<OnboardingRoute />} />
            <Route
              element={
                <ProtectedRoute>
                  <PlayerProvider>
                    <AppLayout />
                  </PlayerProvider>
                </ProtectedRoute>
              }
            >
              <Route path="/playlists" element={<PlaylistList />} />
              <Route path="/playlists/:id" element={<PlaylistEditor />} />
              <Route path="/analysis" element={<AnalysisView />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
