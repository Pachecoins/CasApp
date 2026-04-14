import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SplashPage } from './pages/auth/SplashPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { HomePage } from './pages/home/HomePage'
import { CategoryModalityPage } from './pages/services/CategoryModalityPage'
import { ConfigureRequestPage } from './pages/services/ConfigureRequestPage'
import { SearchingPage } from './pages/requests/SearchingPage'
import { TrackingPage } from './pages/requests/TrackingPage'
import { RequestConfirmedPage } from './pages/requests/RequestConfirmedPage'
import { ReviewPage } from './pages/requests/ReviewPage'
import { CheckoutPage } from './pages/payment/CheckoutPage'
import { PaymentResultPage } from './pages/payment/PaymentResultPage'
import { PaymentHistoryPage } from './pages/payment/PaymentHistoryPage'
import { SubscriptionsPage } from './pages/subscriptions/SubscriptionsPage'
import { NewSubscriptionPage } from './pages/subscriptions/NewSubscriptionPage'
import { SubscriptionDetailPage } from './pages/subscriptions/SubscriptionDetailPage'
import { WorkerProfilePage } from './pages/workers/WorkerProfilePage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { ProfilePage } from './pages/profile/ProfilePage'
import { RequestsHistoryPage } from './pages/requests/RequestsHistoryPage'
import { OnboardingPage, shouldShowOnboarding } from './pages/onboarding/OnboardingPage'
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
    const dest = shouldShowOnboarding() ? '/onboarding' : '/home'
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
      <Routes>
        <Route path="/" element={<SplashPage />} />

        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />

        {/* Service flow */}
        <Route path="/services/:slug" element={<ProtectedRoute><CategoryModalityPage /></ProtectedRoute>} />
        <Route path="/services/:slug/configure" element={<ProtectedRoute><ConfigureRequestPage /></ProtectedRoute>} />

        {/* Payment flow */}
        <Route path="/requests/:requestId/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/payment/result" element={<ProtectedRoute><PaymentResultPage /></ProtectedRoute>} />
        <Route path="/payment/history" element={<ProtectedRoute><PaymentHistoryPage /></ProtectedRoute>} />

        {/* Request flow */}
        <Route path="/requests/:requestId/searching" element={<ProtectedRoute><SearchingPage /></ProtectedRoute>} />
        <Route path="/requests/:requestId/tracking" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} />
        <Route path="/requests/:requestId/confirmed" element={<ProtectedRoute><RequestConfirmedPage /></ProtectedRoute>} />
        <Route path="/requests/:requestId/review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />

        {/* Worker profiles */}
        <Route path="/workers/:workerUserId" element={<ProtectedRoute><WorkerProfilePage /></ProtectedRoute>} />

        {/* Subscriptions */}
        <Route path="/subscriptions" element={<ProtectedRoute><SubscriptionsPage /></ProtectedRoute>} />
        <Route path="/subscriptions/new" element={<ProtectedRoute><NewSubscriptionPage /></ProtectedRoute>} />
        <Route path="/subscriptions/:subscriptionId" element={<ProtectedRoute><SubscriptionDetailPage /></ProtectedRoute>} />

        {/* Profile */}
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

        {/* Requests history */}
        <Route path="/requests" element={<ProtectedRoute><RequestsHistoryPage /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
