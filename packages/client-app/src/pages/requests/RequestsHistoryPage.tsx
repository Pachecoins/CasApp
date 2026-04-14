import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { requestsService } from '@/services/requests.service'
import { formatPrice } from '@/lib/utils'

interface RequestSummary {
  id: string
  status: string
  address: string
  quotedPrice?: number
  finalPrice?: number
  createdAt: string
  scheduledAt?: string
  category: { name: string }
  worker?: { user: { firstName: string; lastName: string } } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  SEARCHING:                 { label: 'Buscando',       color: 'text-gray-600',   bg: 'bg-gray-100',    emoji: '🔍' },
  ASSIGNED:                  { label: 'Asignado',       color: 'text-blue-600',   bg: 'bg-blue-50',     emoji: '👷' },
  EN_ROUTE:                  { label: 'En camino',      color: 'text-orange-600', bg: 'bg-orange-50',   emoji: '🚗' },
  IN_PROGRESS:               { label: 'En progreso',    color: 'text-primary',    bg: 'bg-primary-50',  emoji: '🔨' },
  FINISHED_PENDING_APPROVAL: { label: 'Esperando aprobación', color: 'text-amber-600', bg: 'bg-amber-50', emoji: '📸' },
  COMPLETED:                 { label: 'Completado',     color: 'text-green-700',  bg: 'bg-green-50',    emoji: '✅' },
  CANCELLED:                 { label: 'Cancelado',      color: 'text-gray-500',   bg: 'bg-gray-50',     emoji: '❌' },
  DISPUTED:                  { label: 'En disputa',     color: 'text-amber-700',  bg: 'bg-amber-50',    emoji: '⚠️' },
}

const ACTIVE_STATUSES = new Set(['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'FINISHED_PENDING_APPROVAL'])

export function RequestsHistoryPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<RequestSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  useEffect(() => {
    requestsService.getMyRequests()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = requests.filter((r) => {
    if (filter === 'active') return ACTIVE_STATUSES.has(r.status)
    if (filter === 'completed') return r.status === 'COMPLETED'
    return true
  })

  const navigateToRequest = (req: RequestSummary) => {
    if (req.status === 'COMPLETED' || req.status === 'CANCELLED') {
      navigate(`/requests/${req.id}/tracking`)
    } else if (ACTIVE_STATUSES.has(req.status)) {
      navigate(`/requests/${req.id}/tracking`)
    } else {
      navigate(`/requests/${req.id}/tracking`)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-heading font-bold text-gray-900">Mis pedidos</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 pt-4 pb-2">
        {([
          { key: 'all', label: 'Todos' },
          { key: 'active', label: 'Activos' },
          { key: 'completed', label: 'Completados' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filter === key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-2 pb-8 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center mt-4">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 text-sm">
              {filter === 'active' ? 'No tenés pedidos activos' :
               filter === 'completed' ? 'Todavía no completaste ningún pedido' :
               'Todavía no realizaste ningún pedido'}
            </p>
          </div>
        ) : (
          filtered.map((req) => {
            const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.SEARCHING
            const price = req.finalPrice ?? req.quotedPrice
            const date = new Date(req.createdAt)
            const isActive = ACTIVE_STATUSES.has(req.status)

            return (
              <button
                key={req.id}
                onClick={() => navigateToRequest(req)}
                className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 hover:shadow-card-hover transition-shadow active:scale-[0.99] text-left"
              >
                {/* Status emoji */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${cfg.bg}`}>
                  {cfg.emoji}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm text-gray-900 truncate">{req.category.name}</p>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
                      {cfg.label}
                    </span>
                    {req.worker && (
                      <span className="text-xs text-gray-400 truncate">
                        {req.worker.user.firstName} {req.worker.user.lastName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{req.address}</p>
                </div>

                {/* Price + date + chevron */}
                <div className="text-right flex-shrink-0 flex flex-col items-end">
                  {price ? (
                    <p className="font-bold text-sm text-gray-900">{formatPrice(price)}</p>
                  ) : null}
                  <p className="text-xs text-gray-400">
                    {date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  </p>
                  <ChevronRight size={14} className="text-gray-300 mt-0.5" />
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
