import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, DollarSign, Calendar, ChevronRight } from 'lucide-react'
import { earningsService } from '@/services/requests.service'
import { formatPrice } from '@/lib/utils'

interface EarningItem {
  id: string
  amount: number
  workerEarnings: number | null
  currency: string
  status: 'APPROVED'
  createdAt: string
  serviceRequest: {
    id: string
    type: string
    address: string
    category: { name: string }
    client: {
      user: { firstName: string; lastName: string; avatarUrl?: string }
    }
  }
}

const TYPE_EMOJIS: Record<string, string> = {
  ON_DEMAND: '⚡',
  SCHEDULED: '📅',
  SUBSCRIPTION: '🔄',
}

function groupByMonth(items: EarningItem[]) {
  const groups: Record<string, EarningItem[]> = {}
  for (const item of items) {
    const key = new Date(item.createdAt).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return groups
}

export function EarningsPage() {
  const navigate = useNavigate()
  const [earnings, setEarnings] = useState<EarningItem[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month')

  useEffect(() => {
    earningsService
      .getHistory()
      .then(setEarnings)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const filtered = earnings.filter((e) => {
    const d = new Date(e.createdAt)
    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return d >= weekAgo
    }
    if (period === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }
    return true
  })

  const totalEarnings = filtered.reduce((sum, e) => sum + (e.workerEarnings ?? e.amount * 0.8), 0)
  const totalServices = filtered.length
  const avgPerService = totalServices > 0 ? totalEarnings / totalServices : 0

  const grouped = groupByMonth(filtered)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-heading font-bold text-gray-900">Mis ganancias</h1>
          <p className="text-xs text-gray-500">Historial de cobros</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="px-4 pt-4">
        <div className="flex bg-white rounded-2xl p-1 shadow-sm">
          {(['week', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                period === p ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
              }`}
            >
              {p === 'week' ? 'Esta semana' : p === 'month' ? 'Este mes' : 'Todo'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-3">
        <div className="bg-primary rounded-2xl p-4 text-white col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="opacity-70" />
            <span className="text-xs opacity-70">Ganancias netas</span>
          </div>
          <p className="text-3xl font-heading font-bold">{formatPrice(totalEarnings)}</p>
          <p className="text-xs opacity-60 mt-1">80% del total cobrado</p>
        </div>
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-1 text-gray-500 mb-1">
              <Calendar size={12} />
              <span className="text-xs">Servicios</span>
            </div>
            <p className="font-heading font-bold text-xl text-gray-900">{totalServices}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-1 text-gray-500 mb-1">
              <TrendingUp size={12} />
              <span className="text-xs">Promedio</span>
            </div>
            <p className="font-heading font-bold text-base text-gray-900">{formatPrice(avgPerService)}</p>
          </div>
        </div>
      </div>

      {/* Earnings list */}
      <div className="px-4 mt-4 pb-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <DollarSign size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin ganancias en este período</p>
            <p className="text-sm text-gray-400 mt-1">Completá servicios para ver tus cobros aquí</p>
          </div>
        ) : (
          Object.entries(grouped).map(([month, items]) => (
            <div key={month}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 capitalize">{month}</h3>
                <span className="text-sm font-medium text-primary">
                  {formatPrice(items.reduce((s, e) => s + (e.workerEarnings ?? e.amount * 0.8), 0))}
                </span>
              </div>

              <div className="space-y-2">
                {items.map((earning) => {
                  const net = earning.workerEarnings ?? earning.amount * 0.8
                  const clientName = `${earning.serviceRequest.client.user.firstName} ${earning.serviceRequest.client.user.lastName}`

                  return (
                    <button
                      key={earning.id}
                      onClick={() => navigate(`/requests/${earning.serviceRequest.id}`)}
                      className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left"
                    >
                      <div className="w-11 h-11 bg-gray-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                        {TYPE_EMOJIS[earning.serviceRequest.type] ?? '🏠'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {earning.serviceRequest.category.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{clientName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(earning.createdAt).toLocaleDateString('es-AR', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-heading font-bold text-primary">{formatPrice(net)}</p>
                        <p className="text-xs text-gray-400">{formatPrice(earning.amount)} total</p>
                        <ChevronRight size={14} className="text-gray-300 ml-auto mt-1" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
