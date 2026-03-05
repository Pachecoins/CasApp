import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SplashPage } from './pages/auth/SplashPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { HomePage } from './pages/home/HomePage'
import { CategoryModalityPage } from './pages/services/CategoryModalityPage'
import { ConfigureRequestPage } from './pages/services/ConfigureRequestPage'
import { SearchingPage } from './pages/requests/SearchingPage'
import { RequestConfirmedPage } from './pages/requests/RequestConfirmedPage'
import { useAuthStore } from './store/auth.store'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/home" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Splash */}
        <Route path="/" element={<SplashPage />} />

        {/* Public only */}
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

        {/* Protected */}
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />

        {/* Service flow */}
        <Route
          path="/services/:slug"
          element={<ProtectedRoute><CategoryModalityPage /></ProtectedRoute>}
        />
        <Route
          path="/services/:slug/configure"
          element={<ProtectedRoute><ConfigureRequestPage /></ProtectedRoute>}
        />

        {/* Request flow */}
        <Route
          path="/requests/:requestId/searching"
          element={<ProtectedRoute><SearchingPage /></ProtectedRoute>}
        />
        <Route
          path="/requests/:requestId/confirmed"
          element={<ProtectedRoute><RequestConfirmedPage /></ProtectedRoute>}
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
