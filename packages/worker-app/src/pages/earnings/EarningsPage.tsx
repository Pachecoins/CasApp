import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, DollarSign, Calendar, ChevronRight, Wallet } from 'lucide-react'
import { earningsService } from '@/services/requests.service'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/utils'

interface WalletInfo {
  balanceCents: number
  balanceARS: number
  bankCvu: string | null
  bankAccountVerified: boolean
}

interface EarningItem {
  id: string
  amount: number
  workerEarnings: number | null
  currency: string
  status: 'APPROVED'
  createdAt: string
  serviceRequest: {
    id: string
    scheduledAt?: string | null
    address: string
    category: { name: string }
    client: {
      user: { firstName: string; lastName: string; avatarUrl?: string }
    }
  }
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

  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [bankCvuInput, setBankCvuInput] = useState('')
  const [savingBank, setSavingBank] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawMsg, setWithdrawMsg] = useState('')

  const loadWallet = () => {
    api.get('/workers/me/wallet').then((r) => setWallet(r.data.data)).catch(() => {})
  }

  useEffect(() => {
    earningsService
      .getHistory()
      .then(setEarnings)
      .catch(console.error)
      .finally(() => setLoading(false))
    loadWallet()
  }, [])

  const handleSaveBank = async () => {
    if (bankCvuInput.trim().length < 20) return
    setSavingBank(true)
    try {
      await api.patch('/workers/me/bank', { bankCvu: bankCvuInput.trim() })
      setBankCvuInput('')
      loadWallet()
    } catch {
      alert('No pudimos guardar el CVU/CBU.')
    } finally {
      setSavingBank(false)
    }
  }

  const handleWithdraw = async () => {
    const amountARS = parseFloat(withdrawAmount)
    if (!amountARS || amountARS <= 0) return
    setWithdrawing(true)
    setWithdrawMsg('')
    try {
      const r = await api.post('/workers/me/wallet/withdraw', { amountARS })
      setWithdrawMsg(r.data.data.message)
      setWithdrawAmount('')
      loadWallet()
    } catch (err: any) {
      setWithdrawMsg(err?.response?.data?.error ?? 'No pudimos procesar el retiro.')
    } finally {
      setWithdrawing(false)
    }
  }

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

  const workerNet = (e: EarningItem) => e.workerEarnings ?? Math.round(e.amount / 1.15)
  const totalEarnings = filtered.reduce((sum, e) => sum + workerNet(e), 0)
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
          <p className="text-xs opacity-60 mt-1">Neto después de comisión TUKI (15%)</p>
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

      {/* Wallet & withdrawal */}
      {wallet && (
        <div className="px-4 mt-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={16} className="text-primary" />
              <span className="text-sm font-semibold text-gray-800">Wallet</span>
            </div>
            <p className="text-2xl font-heading font-bold text-gray-900">{formatPrice(wallet.balanceARS)}</p>
            <p className="text-xs text-gray-400 mb-3">Saldo disponible para retirar</p>

            {!wallet.bankCvu || !wallet.bankAccountVerified ? (
              <div className="space-y-2">
                {wallet.bankCvu && !wallet.bankAccountVerified && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    Tu CVU/CBU está pendiente de verificación por un admin.
                  </p>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ingresá tu CVU/CBU (20-22 dígitos)"
                  value={bankCvuInput}
                  onChange={(e) => setBankCvuInput(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
                <button
                  onClick={handleSaveBank}
                  disabled={savingBank || bankCvuInput.trim().length < 20}
                  className="btn-primary w-full text-sm"
                >
                  {savingBank ? 'Guardando…' : 'Guardar CVU/CBU'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Monto a retirar (ARS)"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawing || !withdrawAmount}
                    className="btn-primary text-sm px-4"
                  >
                    {withdrawing ? '...' : 'Retirar'}
                  </button>
                </div>
                {withdrawMsg && <p className="text-xs text-gray-500">{withdrawMsg}</p>}
              </div>
            )}
          </div>
        </div>
      )}

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
                  {formatPrice(items.reduce((s, e) => s + workerNet(e), 0))}
                </span>
              </div>

              <div className="space-y-2">
                {items.map((earning) => {
                  const net = workerNet(earning)
                  const clientName = `${earning.serviceRequest.client.user.firstName} ${earning.serviceRequest.client.user.lastName}`
                  const typeEmoji = earning.serviceRequest.scheduledAt ? '📅' : '⚡'

                  return (
                    <button
                      key={earning.id}
                      onClick={() => navigate(`/requests/${earning.serviceRequest.id}`)}
                      className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left"
                    >
                      <div className="w-11 h-11 bg-gray-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                        {typeEmoji}
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
