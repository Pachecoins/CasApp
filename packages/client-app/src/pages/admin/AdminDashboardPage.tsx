import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Briefcase, DollarSign, RefreshCw,
  Shield, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight,
  BarChart2, TrendingUp, Banknote,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { formatPrice } from '@/lib/utils'

type AdminTab = 'overview' | 'workers' | 'kyc' | 'disputes' | 'withdrawals' | 'transactions' | 'users'

interface Stats {
  users: { total: number; workers: number; clients: number; pendingVerifications: number }
  requests: { total: number; completed: number }
  revenue: { total: number }
  subscriptions: { active: number }
  recentRequests: Array<{
    id: string
    status: string
    createdAt: string
    quotedPrice?: number
    category: { name: string }
    client: { user: { firstName: string; lastName: string } }
    worker?: { user: { firstName: string; lastName: string } } | null
  }>
}

interface WorkerItem {
  id: string
  rating: number
  totalReviews: number
  isVerified: boolean
  isAvailable: boolean
  user: { id: string; firstName: string; lastName: string; email: string; createdAt: string; avatarUrl?: string }
  workerServices: Array<{ category: { name: string } }>
}

interface TxItem {
  id: string
  amount: number
  status: string
  method: string
  createdAt: string
  serviceRequest: {
    category: { name: string }
    client: { user: { firstName: string; lastName: string } }
    worker?: { user: { firstName: string; lastName: string } } | null
  }
}

interface UserItem {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  createdAt: string
  avatarUrl?: string
}

interface DisputeItem {
  id: string
  reason: string
  resolvedAt?: string
  resolution?: string
  createdAt: string
  serviceRequest: {
    id: string
    status: string
    quotedPrice?: number
    address: string
    category: { name: string }
    client: { user: { firstName: string; lastName: string } }
    worker?: { user: { firstName: string; lastName: string } } | null
  }
}

interface WithdrawalItem {
  id: string
  amountCents: number
  bankCvu: string
  status: 'PENDING' | 'PAID' | 'REJECTED'
  requestedAt: string
  worker: { user: { firstName: string; lastName: string; email: string } }
}

interface KycWorkerItem {
  id: string
  kycStatus: string
  identityVerified: boolean
  dniFrontUrl?: string
  dniBackUrl?: string
  selfieBiometricUrl?: string
  insurancePolicyUrl?: string
  insuranceVerified: boolean
  bankCvu?: string
  bankAccountVerified: boolean
  user: { id: string; firstName: string; lastName: string; email: string }
}

const STATUS_COLORS: Record<string, string> = {
  SEARCHING:                'text-yellow-600 bg-yellow-50',
  ASSIGNED:                 'text-blue-600 bg-blue-50',
  EN_ROUTE:                 'text-purple-600 bg-purple-50',
  IN_PROGRESS:              'text-indigo-600 bg-indigo-50',
  FINISHED_PENDING_APPROVAL:'text-orange-600 bg-orange-50',
  COMPLETED:                'text-green-700 bg-green-50',
  CANCELLED:                'text-gray-500 bg-gray-50',
  DISPUTED:                 'text-red-600 bg-red-50',
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [workers, setWorkers] = useState<WorkerItem[]>([])
  const [transactions, setTransactions] = useState<TxItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [workerFilter, setWorkerFilter] = useState<'all' | 'unverified'>('all')
  const [searchQ, setSearchQ] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [verifying, setVerifying] = useState<string | null>(null)

  // KYC tab
  const [kycWorkers, setKycWorkers] = useState<KycWorkerItem[]>([])
  const [kycActioning, setKycActioning] = useState<string | null>(null)

  // Disputes tab
  const [disputes, setDisputes] = useState<DisputeItem[]>([])
  const [disputeResolution, setDisputeResolution] = useState<Record<string, string>>({})
  const [resolvingDispute, setResolvingDispute] = useState<string | null>(null)

  // Withdrawals tab
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([])
  const [resolvingWithdrawal, setResolvingWithdrawal] = useState<string | null>(null)

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'ADMIN') navigate('/home', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data.data)).catch(console.error)
  }, [])

  useEffect(() => {
    if (tab === 'workers') {
      api.get(`/admin/workers?filter=${workerFilter}&page=${page}`)
        .then((r) => { setWorkers(r.data.data.workers); setTotalPages(r.data.data.pages) })
        .catch(console.error)
    } else if (tab === 'kyc') {
      api.get('/admin/kyc/pending')
        .then((r) => setKycWorkers(r.data.data))
        .catch(console.error)
    } else if (tab === 'disputes') {
      api.get('/admin/disputes')
        .then((r) => setDisputes(r.data.data))
        .catch(console.error)
    } else if (tab === 'withdrawals') {
      api.get('/admin/withdrawals?status=PENDING')
        .then((r) => setWithdrawals(r.data.data))
        .catch(console.error)
    } else if (tab === 'transactions') {
      api.get(`/admin/transactions?page=${page}`)
        .then((r) => { setTransactions(r.data.data.transactions); setTotalPages(r.data.data.pages) })
        .catch(console.error)
    } else if (tab === 'users') {
      api.get(`/admin/users?q=${searchQ}&page=${page}`)
        .then((r) => { setUsers(r.data.data.users); setTotalPages(r.data.data.pages) })
        .catch(console.error)
    }
  }, [tab, page, workerFilter, searchQ])

  const handleResolveDispute = async (disputeId: string, side: 'CLIENT' | 'WORKER') => {
    const resolution = disputeResolution[disputeId]?.trim()
    if (!resolution || resolution.length < 5) {
      alert('Ingresá una resolución (mínimo 5 caracteres)')
      return
    }
    setResolvingDispute(disputeId)
    try {
      await api.patch(`/admin/disputes/${disputeId}/resolve`, { side, resolution })
      setDisputes((prev) => prev.map((d) =>
        d.id === disputeId
          ? { ...d, resolvedAt: new Date().toISOString(), resolution }
          : d,
      ))
    } catch (err) {
      console.error(err)
    } finally {
      setResolvingDispute(null)
    }
  }

  const handleResolveWithdrawal = async (withdrawalId: string, status: 'PAID' | 'REJECTED') => {
    setResolvingWithdrawal(withdrawalId)
    try {
      await api.patch(`/admin/withdrawals/${withdrawalId}`, { status })
      setWithdrawals((prev) => prev.filter((w) => w.id !== withdrawalId))
    } catch (err) {
      console.error(err)
    } finally {
      setResolvingWithdrawal(null)
    }
  }

  const handleKycAction = async (
    workerId: string,
    action: 'approve-kyc' | 'approve-insurance' | 'reject-insurance' | 'verify-bank',
  ) => {
    setKycActioning(workerId)
    try {
      await api.patch(`/admin/workers/${workerId}/${action}`)
      setKycWorkers((prev) => prev.filter((w) => {
        // Remove from list once both sections are cleared
        if (action === 'approve-kyc' || action === 'approve-insurance' || action === 'reject-insurance') {
          return w.id !== workerId
        }
        return true
      }))
    } catch (err) {
      console.error(err)
    } finally {
      setKycActioning(null)
    }
  }

  const handleVerify = async (workerUserId: string, verified: boolean) => {
    setVerifying(workerUserId)
    try {
      await api.patch(`/admin/workers/${workerUserId}/verify`, { verified })
      setWorkers((ws) =>
        ws.map((w) => (w.user.id === workerUserId ? { ...w, isVerified: verified } : w)),
      )
    } catch (err) {
      console.error(err)
    } finally {
      setVerifying(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white px-6 pt-12 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-heading font-bold text-2xl">TUKI Admin</h1>
            <p className="text-gray-400 text-sm">Panel de administración</p>
          </div>
          <button
            onClick={() => navigate('/home')}
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Salir
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {(['overview', 'workers', 'kyc', 'disputes', 'withdrawals', 'transactions', 'users'] as AdminTab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1) }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'overview'    ? 'Resumen' :
               t === 'workers'    ? 'Trabajadores' :
               t === 'kyc'        ? `KYC${kycWorkers.length > 0 ? ` (${kycWorkers.length})` : ''}` :
               t === 'disputes'   ? `Disputas${disputes.filter(d => !d.resolvedAt).length > 0 ? ` (${disputes.filter(d => !d.resolvedAt).length})` : ''}` :
               t === 'withdrawals' ? `Retiros${withdrawals.length > 0 ? ` (${withdrawals.length})` : ''}` :
               t === 'transactions' ? 'Pagos' : 'Usuarios'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-8">
        {/* ── Overview ── */}
        {tab === 'overview' && stats && (
          <div className="space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard icon={<Users size={20} />} label="Usuarios" value={stats.users.total} sub={`${stats.users.workers} trabajadores`} color="bg-blue-500" />
              <KpiCard icon={<DollarSign size={20} />} label="Ingresos" value={formatPrice(stats.revenue.total)} sub="total plataforma" color="bg-green-500" />
              <KpiCard icon={<Briefcase size={20} />} label="Pedidos" value={stats.requests.total} sub={`${stats.requests.completed} completados`} color="bg-purple-500" />
              <KpiCard icon={<RefreshCw size={20} />} label="Suscripciones" value={stats.subscriptions.active} sub="activas" color="bg-orange-500" />
            </div>

            {/* Pending verifications alert */}
            {stats.users.pendingVerifications > 0 && (
              <button
                onClick={() => setTab('kyc')}
                className="w-full flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-left"
              >
                <Shield size={20} className="text-yellow-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-800">
                    {stats.users.pendingVerifications} trabajador{stats.users.pendingVerifications !== 1 ? 'es' : ''} pendiente{stats.users.pendingVerifications !== 1 ? 's' : ''} de verificación
                  </p>
                  <p className="text-xs text-yellow-600 mt-0.5">Hacé clic para revisar →</p>
                </div>
              </button>
            )}

            {/* Recent requests */}
            <div>
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp size={16} />
                Pedidos recientes
              </h2>
              <div className="space-y-2">
                {stats.recentRequests.map((req) => (
                  <div key={req.id} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{req.category.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status] ?? ''}`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {req.client.user.firstName} {req.client.user.lastName}
                        {req.worker ? ` → ${req.worker.user.firstName} ${req.worker.user.lastName}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-400 flex-shrink-0">
                      {req.quotedPrice ? <p className="font-medium text-gray-700">{formatPrice(req.quotedPrice)}</p> : null}
                      <p>{new Date(req.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── KYC Review ── */}
        {tab === 'kyc' && (
          <div className="space-y-4">
            {kycWorkers.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-gray-600 font-medium">Sin revisiones pendientes</p>
                <p className="text-gray-400 text-sm mt-1">Todos los documentos están al día</p>
              </div>
            ) : (
              kycWorkers.map((worker) => {
                const hasIdentityPending = worker.kycStatus === 'SUBMITTED' && !worker.identityVerified
                const hasInsurancePending = !!worker.insurancePolicyUrl && !worker.insuranceVerified
                const hasBankPending = !!worker.bankCvu && !worker.bankAccountVerified
                const isActioning = kycActioning === worker.id

                return (
                  <div key={worker.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
                    {/* Worker header */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                        {worker.user.firstName[0]}{worker.user.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {worker.user.firstName} {worker.user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{worker.user.email}</p>
                      </div>
                    </div>

                    {/* Identity section */}
                    {hasIdentityPending && (
                      <div className="border border-blue-200 rounded-xl p-3 bg-blue-50">
                        <p className="text-sm font-semibold text-blue-800 mb-2">
                          🪪 Verificación de identidad — pendiente
                        </p>
                        <div className="flex gap-2 mb-3">
                          {[
                            { label: 'DNI frente', url: worker.dniFrontUrl },
                            { label: 'DNI dorso', url: worker.dniBackUrl },
                            { label: 'Selfie', url: worker.selfieBiometricUrl },
                          ].map(({ label, url }) => (
                            url ? (
                              <a
                                key={label}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-center text-xs bg-white border border-blue-200 rounded-lg py-2 text-blue-700 hover:bg-blue-100 truncate px-1"
                              >
                                {label} ↗
                              </a>
                            ) : (
                              <div key={label} className="flex-1 text-center text-xs bg-gray-100 border border-gray-200 rounded-lg py-2 text-gray-400 px-1">
                                {label} —
                              </div>
                            )
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            disabled={isActioning}
                            onClick={() => handleKycAction(worker.id, 'approve-kyc')}
                            className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white text-sm font-medium py-2 rounded-xl disabled:opacity-50"
                          >
                            {isActioning ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CheckCircle size={14} />
                            )}
                            Aprobar identidad
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Insurance section */}
                    {hasInsurancePending && (
                      <div className="border border-amber-200 rounded-xl p-3 bg-amber-50">
                        <p className="text-sm font-semibold text-amber-800 mb-2">
                          🛡️ Póliza ART/seguro — pendiente
                        </p>
                        {worker.insurancePolicyUrl && (
                          <a
                            href={worker.insurancePolicyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-center text-xs bg-white border border-amber-200 rounded-lg py-2 text-amber-700 hover:bg-amber-100 mb-3"
                          >
                            Ver documento de póliza ↗
                          </a>
                        )}
                        <div className="flex gap-2">
                          <button
                            disabled={isActioning}
                            onClick={() => handleKycAction(worker.id, 'approve-insurance')}
                            className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white text-sm font-medium py-2 rounded-xl disabled:opacity-50"
                          >
                            {isActioning ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CheckCircle size={14} />
                            )}
                            Aprobar seguro
                          </button>
                          <button
                            disabled={isActioning}
                            onClick={() => handleKycAction(worker.id, 'reject-insurance')}
                            className="flex-1 flex items-center justify-center gap-1 border border-red-300 text-red-600 text-sm font-medium py-2 rounded-xl disabled:opacity-50 bg-white"
                          >
                            <XCircle size={14} />
                            Rechazar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bank account section */}
                    {hasBankPending && (
                      <div className="border border-green-200 rounded-xl p-3 bg-green-50">
                        <p className="text-sm font-semibold text-green-800 mb-2">
                          🏦 Cuenta bancaria (CVU/CBU) — pendiente
                        </p>
                        <p className="text-xs text-green-700 mb-3 font-mono">{worker.bankCvu}</p>
                        <button
                          disabled={isActioning}
                          onClick={() => handleKycAction(worker.id, 'verify-bank')}
                          className="w-full flex items-center justify-center gap-1 bg-green-600 text-white text-sm font-medium py-2 rounded-xl disabled:opacity-50"
                        >
                          {isActioning ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <CheckCircle size={14} />
                          )}
                          Verificar cuenta
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── Disputes ── */}
        {tab === 'disputes' && (
          <div className="space-y-4">
            {disputes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="text-4xl mb-3">🕊️</div>
                <p className="text-gray-600 font-medium">Sin disputas abiertas</p>
              </div>
            ) : (
              disputes.map((dispute) => {
                const isResolved = !!dispute.resolvedAt
                const isResolving = resolvingDispute === dispute.id
                const price = dispute.serviceRequest.quotedPrice

                return (
                  <div key={dispute.id} className={`bg-white rounded-2xl p-4 shadow-sm ${isResolved ? 'opacity-60' : ''}`}>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-gray-900 text-sm">{dispute.serviceRequest.category.name}</p>
                          {isResolved
                            ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Resuelta</span>
                            : <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">⚠️ Abierta</span>}
                        </div>
                        <p className="text-xs text-gray-500">{dispute.serviceRequest.address}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Cliente: {dispute.serviceRequest.client.user.firstName} {dispute.serviceRequest.client.user.lastName}
                          {dispute.serviceRequest.worker ? ` · Pro: ${dispute.serviceRequest.worker.user.firstName} ${dispute.serviceRequest.worker.user.lastName}` : ''}
                        </p>
                      </div>
                      {price && <p className="font-bold text-gray-900 text-sm flex-shrink-0">{formatPrice(price)}</p>}
                    </div>

                    {/* Reason */}
                    <div className="bg-amber-50 rounded-xl px-3 py-2 mb-3">
                      <p className="text-xs font-semibold text-amber-700 mb-0.5">Motivo de la disputa:</p>
                      <p className="text-sm text-amber-800">{dispute.reason}</p>
                    </div>

                    {isResolved ? (
                      <div className="bg-green-50 rounded-xl px-3 py-2">
                        <p className="text-xs font-semibold text-green-700 mb-0.5">Resolución:</p>
                        <p className="text-sm text-green-800">{dispute.resolution}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          placeholder="Resolución del moderador (mínimo 5 caracteres)..."
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                          value={disputeResolution[dispute.id] ?? ''}
                          onChange={(e) => setDisputeResolution((prev) => ({ ...prev, [dispute.id]: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            disabled={isResolving}
                            onClick={() => handleResolveDispute(dispute.id, 'CLIENT')}
                            className="flex items-center justify-center gap-1 bg-blue-600 text-white text-xs font-medium py-2.5 rounded-xl disabled:opacity-50"
                          >
                            {isResolving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                            🔄 Reembolsar cliente
                          </button>
                          <button
                            disabled={isResolving}
                            onClick={() => handleResolveDispute(dispute.id, 'WORKER')}
                            className="flex items-center justify-center gap-1 bg-green-600 text-white text-xs font-medium py-2.5 rounded-xl disabled:opacity-50"
                          >
                            💸 Liberar al Pro
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── Withdrawals ── */}
        {tab === 'withdrawals' && (
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="text-4xl mb-3">💸</div>
                <p className="text-gray-600 font-medium">Sin retiros pendientes</p>
              </div>
            ) : (
              withdrawals.map((w) => {
                const isResolving = resolvingWithdrawal === w.id
                return (
                  <div key={w.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {w.worker.user.firstName} {w.worker.user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{w.worker.user.email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">CVU/CBU: {w.bankCvu}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(w.requestedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <p className="font-heading font-bold text-gray-900 flex-shrink-0">{formatPrice(w.amountCents / 100)}</p>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Transferí el monto manualmente al CVU/CBU y marcá como pagado, o rechazá para devolver el saldo a la wallet.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        disabled={isResolving}
                        onClick={() => handleResolveWithdrawal(w.id, 'REJECTED')}
                        className="flex items-center justify-center gap-1 border border-red-300 text-red-600 bg-white text-xs font-medium py-2.5 rounded-xl disabled:opacity-50"
                      >
                        <XCircle size={14} />
                        Rechazar
                      </button>
                      <button
                        disabled={isResolving}
                        onClick={() => handleResolveWithdrawal(w.id, 'PAID')}
                        className="flex items-center justify-center gap-1 bg-green-600 text-white text-xs font-medium py-2.5 rounded-xl disabled:opacity-50"
                      >
                        {isResolving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Banknote size={14} />}
                        Marcar pagado
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── Workers ── */}
        {tab === 'workers' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['all', 'unverified'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setWorkerFilter(f); setPage(1) }}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    workerFilter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  {f === 'all' ? 'Todos' : 'Sin verificar'}
                </button>
              ))}
            </div>

            {workers.map((worker) => (
              <div key={worker.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                    {worker.user.firstName[0]}{worker.user.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">
                        {worker.user.firstName} {worker.user.lastName}
                      </p>
                      {worker.isVerified ? (
                        <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle size={10} />
                          Verificado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
                          <Shield size={10} />
                          Pendiente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{worker.user.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {worker.workerServices.map((ws) => ws.category.name).join(', ')} · ⭐ {worker.rating.toFixed(1)} ({worker.totalReviews})
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {worker.isVerified ? (
                      <button
                        disabled={verifying === worker.user.id}
                        onClick={() => handleVerify(worker.user.id, false)}
                        className="text-xs text-red-500 border border-red-200 px-2 py-1.5 rounded-lg"
                      >
                        <XCircle size={12} />
                      </button>
                    ) : (
                      <button
                        disabled={verifying === worker.user.id}
                        onClick={() => handleVerify(worker.user.id, true)}
                        className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        {verifying === worker.user.id ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle size={12} />
                        )}
                        Verificar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </div>
        )}

        {/* ── Transactions ── */}
        {tab === 'transactions' && (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{tx.serviceRequest.category.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {tx.serviceRequest.client.user.firstName} {tx.serviceRequest.client.user.lastName}
                      {tx.serviceRequest.worker ? ` → ${tx.serviceRequest.worker.user.firstName} ${tx.serviceRequest.worker.user.lastName}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        tx.status === 'APPROVED' ? 'bg-green-50 text-green-700' :
                        tx.status === 'REJECTED' ? 'bg-red-50 text-red-500' :
                        'bg-yellow-50 text-yellow-600'
                      }`}>
                        {tx.status}
                      </span>
                      <span className="text-xs text-gray-400">{tx.method}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(tx.createdAt).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                  </div>
                  <p className="font-heading font-bold text-gray-900 flex-shrink-0">{formatPrice(tx.amount)}</p>
                </div>
              </div>
            ))}
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </div>
        )}

        {/* ── Users ── */}
        {tab === 'users' && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              <input
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setPage(1) }}
                placeholder="Buscar por nombre o email..."
                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>

            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center font-bold text-sm text-gray-600 flex-shrink-0">
                  {u.firstName[0]}{u.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700' :
                    u.role === 'WORKER' ? 'bg-blue-50 text-blue-700' :
                    'bg-gray-50 text-gray-600'
                  }`}>
                    {u.role}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(u.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  icon, label, value, sub, color,
}: { icon: React.ReactNode; label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center text-white mb-2`}>
        {icon}
      </div>
      <p className="text-xl font-heading font-bold text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-700">{label}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 disabled:opacity-30"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm text-gray-600">{page} / {totalPages}</span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 disabled:opacity-30"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
