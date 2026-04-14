import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Calendar, BarChart2 } from 'lucide-react'
import { workerRequestsService } from '@/services/requests.service'
import { formatPrice } from '@/lib/utils'

interface JobSummary {
  id: string
  status: string
  address: string
  quotedPrice?: number
  createdAt: string
  scheduledAt?: string | null
  category: { name: string; slug: string }
  client: { user: { firstName: string; lastName: string } }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  SEARCHING:                 { label: 'Buscando',           color: 'text-gray-600',   bg: 'bg-gray-100',    emoji: '🔍' },
  ASSIGNED:                  { label: 'Asignado',           color: 'text-blue-600',   bg: 'bg-blue-50',     emoji: '👷' },
  EN_ROUTE:                  { label: 'En camino',          color: 'text-orange-600', bg: 'bg-orange-50',   emoji: '🚗' },
  IN_PROGRESS:               { label: 'En progreso',        color: 'text-primary',    bg: 'bg-primary-50',  emoji: '🔨' },
  FINISHED_PENDING_APPROVAL: { label: 'Esperando aprobación', color: 'text-amber-600', bg: 'bg-amber-50',  emoji: '📸' },
  COMPLETED:                 { label: 'Completado',         color: 'text-green-700',  bg: 'bg-green-50',    emoji: '✅' },
  CANCELLED:                 { label: 'Cancelado',          color: 'text-gray-400',   bg: 'bg-gray-50',     emoji: '❌' },
  DISPUTED:                  { label: 'En disputa',         color: 'text-amber-700',  bg: 'bg-amber-50',    emoji: '⚠️' },
}

const ACTIVE_STATUSES = new Set(['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'FINISHED_PENDING_APPROVAL'])

export function JobsPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  useEffect(() => {
    workerRequestsService
      .getMyRequests()
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = jobs.filter((j) => {
    if (filter === 'active') return ACTIVE_STATUSES.has(j.status)
    if (filter === 'completed') return j.status === 'COMPLETED'
    return true
  })

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-heading font-bold text-gray-900">Mis trabajos</h1>
          <p className="text-xs text-gray-500">{jobs.length} trabajo{jobs.length !== 1 ? 's' : ''} en total</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 pt-4">
        <div className="flex bg-white rounded-2xl p-1 shadow-sm">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Completados'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin trabajos{filter !== 'all' ? ' en esta categoría' : ''}</p>
            <p className="text-sm text-gray-400 mt-1">
              {filter === 'active' ? 'Aceptá un pedido para verlo aquí' : 'Completá trabajos para verlos aquí'}
            </p>
          </div>
        ) : (
          filtered.map((job) => {
            const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.SEARCHING
            const isActive = ACTIVE_STATUSES.has(job.status)
            const workerEarnings = job.quotedPrice ? Math.round(job.quotedPrice / 1.15) : null

            return (
              <button
                key={job.id}
                onClick={() => navigate(`/requests/${job.id}`)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 text-left"
              >
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  {statusCfg.emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 truncate">{job.category.name}</p>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {job.client.user.firstName} {job.client.user.lastName}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.color}`}
                    >
                      {statusCfg.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {job.scheduledAt
                        ? `📅 ${new Date(job.scheduledAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
                        : new Date(job.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  {workerEarnings && (
                    <p className="font-heading font-bold text-primary text-sm">{formatPrice(workerEarnings)}</p>
                  )}
                  <ChevronRight size={16} className="text-gray-300 ml-auto mt-1" />
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3">
        <div className="flex justify-around">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <span className="text-xl">🏠</span>
            <span className="text-xs">Inicio</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-primary">
            <Calendar size={20} />
            <span className="text-xs font-medium">Trabajos</span>
          </button>
          <button
            onClick={() => navigate('/earnings')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <BarChart2 size={20} />
            <span className="text-xs">Ganancias</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <span className="text-xl opacity-40">👤</span>
            <span className="text-xs">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
