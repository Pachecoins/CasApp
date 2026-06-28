import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SplashPage } from './pages/auth/SplashPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { IncomingRequestPage } from './pages/requests/IncomingRequestPage'
import { JobDetailPage } from './pages/requests/JobDetailPage'
import { JobsPage } from './pages/requests/JobsPage'
import { EarningsPage } from './pages/earnings/EarningsPage'
import { ProfilePage } from './pages/profile/ProfilePage'
import { EquipmentManagePage } from './pages/equipment/EquipmentManagePage'
import { ProductsManagePage } from './pages/products/ProductsManagePage'
import { CoursesPage } from './pages/courses/CoursesPage'
import WorkerOnboardingPage, { shouldShowWorkerOnboarding } from './pages/onboarding/OnboardingPage'
import { useAuthStore } from './store/auth.store'
import { usePushNotifications } from './hooks/usePushNotifications'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) {
    const dest = shouldShowWorkerOnboarding() ? '/onboarding' : '/dashboard'
    return <Navigate to={dest} replace />
  }
  return <>{children}</>
}

function AppInner() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  usePushNotifications(isAuthenticated)
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
      <div className="min-h-screen bg-gray-200 flex justify-center">
        <div className="w-full max-w-md min-h-screen bg-background shadow-2xl">
          <AppRoutes />
        </div>
      </div>
    </BrowserRouter>
  )
}

function AppRoutes() {
  return (
      <Routes>
        <Route path="/" element={<SplashPage />} />

        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

        <Route path="/onboarding" element={<WorkerOnboardingPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/jobs" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
        <Route path="/earnings" element={<ProtectedRoute><EarningsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/equipos" element={<ProtectedRoute><EquipmentManagePage /></ProtectedRoute>} />
        <Route path="/productos" element={<ProtectedRoute><ProductsManagePage /></ProtectedRoute>} />
        <Route path="/cursos" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />

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
  )
}
