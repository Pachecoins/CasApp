import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Briefcase, DollarSign, RefreshCw,
  Shield, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight,
  BarChart2, TrendingUp,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { formatPrice } from '@/lib/utils'

type AdminTab = 'overview' | 'workers' | 'transactions' | 'users'

interface Stats {
  users: { total: number; workers: number; clients: number; pendingVerifications: number }
  requests: { total: number; completed: number }
  revenue: { total: number }
  subscriptions: { active: number }
  recentRequests: Array<{
    id: string
    status: string
    createdAt: string
    finalPrice?: number
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

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-600 bg-yellow-50',
  PENDING_PAYMENT: 'text-orange-600 bg-orange-50',
  MATCHED: 'text-blue-600 bg-blue-50',
  CONFIRMED: 'text-purple-600 bg-purple-50',
  IN_PROGRESS: 'text-indigo-600 bg-indigo-50',
  COMPLETED: 'text-green-700 bg-green-50',
  CANCELLED: 'text-gray-500 bg-gray-50',
  DISPUTED: 'text-red-600 bg-red-50',
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
            <h1 className="font-heading font-bold text-2xl">CasApp Admin</h1>
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
        <div className="flex gap-1">
          {(['overview', 'workers', 'transactions', 'users'] as AdminTab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'overview' ? 'Resumen' : t === 'workers' ? 'Trabajadores' : t === 'transactions' ? 'Pagos' : 'Usuarios'}
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
                onClick={() => { setTab('workers'); setWorkerFilter('unverified') }}
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
                      {req.finalPrice ? <p className="font-medium text-gray-700">{formatPrice(req.finalPrice)}</p> : null}
                      <p>{new Date(req.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
