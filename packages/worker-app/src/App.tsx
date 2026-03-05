import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SplashPage } from './pages/auth/SplashPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { IncomingRequestPage } from './pages/requests/IncomingRequestPage'
import { JobDetailPage } from './pages/requests/JobDetailPage'
import { useAuthStore } from './store/auth.store'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashPage />} />

        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

        {/* Incoming request (from socket notification) */}
        <Route
          path="/requests/incoming"
          element={<ProtectedRoute><IncomingRequestPage /></ProtectedRoute>}
        />

        {/* Job detail + status management */}
        <Route
          path="/requests/:requestId"
          element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
