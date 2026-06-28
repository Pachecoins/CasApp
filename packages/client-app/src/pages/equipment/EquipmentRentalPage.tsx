import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Calendar } from 'lucide-react'
import { equipmentService, type RentalEquipment } from '@/services/equipment.service'
import { formatPrice } from '@/lib/utils'

export function EquipmentRentalPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<RentalEquipment[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RentalEquipment | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const load = (lat?: number, lng?: number) =>
      equipmentService
        .browse(lat, lng)
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false))

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => load(pos.coords.latitude, pos.coords.longitude),
        () => load(),
        { timeout: 4000 },
      )
    } else {
      load()
    }
  }, [])

  const totalDays =
    startDate && endDate
      ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
      : 0

  const handleReserve = async () => {
    if (!selected || !startDate || !endDate) return
    setSubmitting(true)
    setMessage('')
    try {
      await equipmentService.reserve({ equipmentId: selected.id, startDate, endDate })
      setMessage('¡Reserva enviada! El dueño la va a confirmar pronto.')
      setSelected(null)
      setStartDate('')
      setEndDate('')
    } catch (err: any) {
      setMessage(err?.response?.data?.error ?? 'No pudimos crear la reserva.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="bg-primary px-6 pt-10 pb-6 text-white">
        <button onClick={() => navigate('/home')} className="mb-4">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-heading font-bold">Alquiler de máquinas</h1>
        <p className="text-primary-100 text-sm">Equipos de los Tukis, listos para alquilar</p>
      </div>

      <div className="px-4 pt-6">
        {message && <p className="text-sm text-primary-700 mb-4 card">{message}</p>}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse h-24 bg-gray-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="card text-center py-10 text-gray-400 text-sm">
            Todavía no hay máquinas disponibles para alquilar cerca tuyo.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="card">
                <div className="flex items-center gap-3">
                  <img
                    src={item.photoUrl}
                    alt={item.name}
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-gray-100"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.worker.user.firstName} {item.worker.user.lastName}
                      {item.distanceKm != null && (
                        <span className="flex items-center gap-0.5 inline-flex ml-2">
                          <MapPin size={11} /> {item.distanceKm} km
                        </span>
                      )}
                    </p>
                    <p className="text-sm font-bold text-primary mt-1">
                      {formatPrice(item.pricePerDayCents / 100)} / día
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(item)}
                    className="btn-outline px-3 py-2 text-xs flex-shrink-0"
                  >
                    Reservar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={() => setSelected(null)}>
          <div
            className="bg-white w-full rounded-t-3xl p-6 max-w-md mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading font-bold text-lg mb-1">{selected.name}</h2>
            <p className="text-sm text-gray-500 mb-4">
              {formatPrice(selected.pricePerDayCents / 100)} / día
            </p>

            <label className="input-label flex items-center gap-1.5">
              <Calendar size={14} /> Desde
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field mb-3"
            />
            <label className="input-label flex items-center gap-1.5">
              <Calendar size={14} /> Hasta
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field mb-4"
            />

            {totalDays > 0 && (
              <p className="text-sm text-gray-700 mb-4">
                {totalDays} día{totalDays !== 1 ? 's' : ''} ·{' '}
                <span className="font-bold">
                  {formatPrice((selected.pricePerDayCents * totalDays) / 100)}
                </span>
              </p>
            )}

            <button
              onClick={handleReserve}
              disabled={submitting || !startDate || !endDate}
              className="btn-primary w-full"
            >
              {submitting ? 'Reservando…' : 'Confirmar reserva'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
