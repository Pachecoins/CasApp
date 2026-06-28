import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/utils'

interface Equipment {
  id: string
  name: string
  photoUrl: string
  isForRent: boolean
  pricePerDayCents: number | null
}

interface Rental {
  id: string
  status: string
  startDate: string
  endDate: string
  totalDays: number
  totalPriceCents: number
  equipment: { name: string }
  renter: { firstName: string; lastName: string; phone: string | null }
}

export function EquipmentManagePage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Equipment[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = () => {
    Promise.all([api.get('/equipment/me'), api.get('/equipment/me/rentals')])
      .then(([eq, rent]) => {
        setItems(eq.data.data)
        setRentals(rent.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const toggleRent = async (item: Equipment) => {
    const nextIsForRent = !item.isForRent
    const priceInput = prices[item.id] ?? (item.pricePerDayCents ? String(item.pricePerDayCents / 100) : '')
    const pricePerDayCents = priceInput ? Math.round(parseFloat(priceInput) * 100) : undefined

    if (nextIsForRent && !pricePerDayCents) {
      alert('Ingresá un precio por día antes de activar el alquiler.')
      return
    }

    setSavingId(item.id)
    try {
      await api.patch(`/equipment/${item.id}/rent-settings`, { isForRent: nextIsForRent, pricePerDayCents })
      load()
    } catch {
      alert('No pudimos actualizar el equipo.')
    } finally {
      setSavingId(null)
    }
  }

  const updateRentalStatus = async (rentalId: string, status: string) => {
    try {
      await api.patch(`/equipment/rentals/${rentalId}/status`, { status })
      load()
    } catch {
      alert('No pudimos actualizar la reserva.')
    }
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="bg-primary px-6 pt-10 pb-6 text-white">
        <button onClick={() => navigate('/dashboard')} className="mb-4">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-heading font-bold">Mis equipos</h1>
        <p className="text-primary-100 text-sm">Ofrecé tus máquinas en alquiler y generá un ingreso extra</p>
      </div>

      <div className="px-4 pt-6">
        <button
          onClick={() => navigate('/productos')}
          className="w-full card flex items-center gap-3 mb-6 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-accent-50 flex items-center justify-center text-xl flex-shrink-0">
            ♻️
          </div>
          <div>
            <p className="font-medium text-sm text-gray-800">Vender productos reciclados</p>
            <p className="text-xs text-gray-500">Briquetas, abono y más → Mis productos</p>
          </div>
        </button>
        {loading ? (
          <div className="card animate-pulse h-20 bg-gray-100" />
        ) : items.length === 0 ? (
          <div className="card text-center text-sm text-gray-500 py-8">
            Todavía no subiste equipamiento. Hacelo desde tu perfil.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {items.map((item) => (
              <div key={item.id} className="card flex items-center gap-3">
                <img src={item.photoUrl} className="w-14 h-14 rounded-xl object-cover bg-gray-100" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-800">{item.name}</p>
                  <input
                    type="number"
                    placeholder="Precio por día (ARS)"
                    defaultValue={item.pricePerDayCents ? item.pricePerDayCents / 100 : ''}
                    onChange={(e) => setPrices((p) => ({ ...p, [item.id]: e.target.value }))}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 mt-1 w-32"
                  />
                </div>
                <button
                  onClick={() => toggleRent(item)}
                  disabled={savingId === item.id}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                    item.isForRent ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {item.isForRent ? 'En alquiler' : 'Activar'}
                </button>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-sm font-heading font-bold text-gray-900 mb-3">Reservas recibidas</h2>
        {rentals.length === 0 ? (
          <div className="card text-center text-sm text-gray-500 py-8">Sin reservas todavía.</div>
        ) : (
          <div className="space-y-3">
            {rentals.map((r) => (
              <div key={r.id} className="card">
                <p className="font-medium text-sm text-gray-800">{r.equipment.name}</p>
                <p className="text-xs text-gray-500">
                  {r.renter.firstName} {r.renter.lastName} · {new Date(r.startDate).toLocaleDateString()} →{' '}
                  {new Date(r.endDate).toLocaleDateString()} ({r.totalDays}d)
                </p>
                <p className="text-sm font-bold text-primary mt-1">{formatPrice(r.totalPriceCents / 100)}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-semibold text-gray-500">{r.status}</span>
                  {r.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateRentalStatus(r.id, 'CANCELLED')}
                        className="text-xs text-secondary-700 font-semibold"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => updateRentalStatus(r.id, 'CONFIRMED')}
                        className="text-xs text-primary font-semibold"
                      >
                        Confirmar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
