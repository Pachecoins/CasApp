import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Receipt, CheckCircle, XCircle, Clock, ChevronRight } from 'lucide-react'
import { paymentsService } from '@/services/requests.service'
import { formatPrice } from '@/lib/utils'

interface TransactionItem {
  id: string
  amount: number
  currency: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED'
  method: string
  createdAt: string
  serviceRequest: {
    id: string
    scheduledAt?: string | null
    address: string
    category: { name: string; slug: string }
    worker?: {
      user: { firstName: string; lastName: string; avatarUrl?: string }
    }
  }
}

const STATUS_CONFIG: Record<TransactionItem['status'], { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  APPROVED: { label: 'Aprobado', icon: <CheckCircle size={14} />, color: 'text-primary', bg: 'bg-green-50' },
  PENDING: { label: 'Pendiente', icon: <Clock size={14} />, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  REJECTED: { label: 'Rechazado', icon: <XCircle size={14} />, color: 'text-red-500', bg: 'bg-red-50' },
  REFUNDED: { label: 'Reembolsado', icon: <Receipt size={14} />, color: 'text-blue-500', bg: 'bg-blue-50' },
}


export function PaymentHistoryPage() {
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    paymentsService
      .getHistory()
      .then(setTransactions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const totalSpent = transactions
    .filter((t) => t.status === 'APPROVED')
    .reduce((sum, t) => sum + t.amount, 0)

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
          <h1 className="font-heading font-bold text-gray-900">Mis pagos</h1>
          <p className="text-xs text-gray-500">Historial de transacciones</p>
        </div>
      </div>

      {/* Summary card */}
      {!loading && transactions.length > 0 && (
        <div className="mx-4 mt-4 bg-primary rounded-2xl p-4 text-white">
          <p className="text-sm opacity-80">Total gastado</p>
          <p className="text-3xl font-heading font-bold mt-1">{formatPrice(totalSpent)}</p>
          <p className="text-xs opacity-70 mt-1">
            {transactions.filter((t) => t.status === 'APPROVED').length} servicios completados
          </p>
        </div>
      )}

      {/* List */}
      <div className="px-4 mt-4 space-y-3 pb-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16">
            <Receipt size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin pagos aún</p>
            <p className="text-sm text-gray-400 mt-1">Tus transacciones aparecerán aquí</p>
          </div>
        ) : (
          transactions.map((tx) => {
            const statusCfg = STATUS_CONFIG[tx.status]
            const workerName = tx.serviceRequest.worker
              ? `${tx.serviceRequest.worker.user.firstName} ${tx.serviceRequest.worker.user.lastName}`
              : 'Sin asignar'

            return (
              <button
                key={tx.id}
                onClick={() => navigate(`/requests/${tx.serviceRequest.id}/tracking`)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 text-left"
              >
                {/* Category icon */}
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  {tx.serviceRequest.scheduledAt ? '📅' : '⚡'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {tx.serviceRequest.category.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{workerName}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.color}`}
                    >
                      {statusCfg.icon}
                      {statusCfg.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(tx.createdAt).toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                </div>

                {/* Amount + chevron */}
                <div className="text-right flex-shrink-0">
                  <p className="font-heading font-bold text-gray-900">{formatPrice(tx.amount)}</p>
                  <ChevronRight size={16} className="text-gray-300 ml-auto mt-1" />
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
