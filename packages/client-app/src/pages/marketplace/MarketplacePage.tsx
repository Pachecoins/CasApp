import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Minus, Plus } from 'lucide-react'
import { productsService, type MarketplaceProduct } from '@/services/products.service'
import { formatPrice } from '@/lib/utils'

export function MarketplacePage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<MarketplaceProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const load = (lat?: number, lng?: number) =>
      productsService
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

  const openProduct = (item: MarketplaceProduct) => {
    setSelected(item)
    setQuantity(1)
  }

  const handleBuy = async () => {
    if (!selected) return
    setSubmitting(true)
    setMessage('')
    try {
      await productsService.order({ productId: selected.id, quantity })
      setMessage('¡Pedido confirmado! El Tuki se va a contactar para coordinar la entrega.')
      setSelected(null)
    } catch (err: any) {
      setMessage(err?.response?.data?.error ?? 'No pudimos procesar el pedido.')
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
        <h1 className="text-xl font-heading font-bold">Productos reciclados</h1>
        <p className="text-primary-100 text-sm">
          Briquetas, abono y más, hechos por los Tukis con lo que recolectan en sus trabajos
        </p>
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
            Todavía no hay productos publicados cerca tuyo.
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
                    <p className="text-sm font-bold text-primary mt-1">{formatPrice(item.priceCents / 100)}</p>
                  </div>
                  <button onClick={() => openProduct(item)} className="btn-outline px-3 py-2 text-xs flex-shrink-0">
                    Comprar
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
            {selected.description && <p className="text-sm text-gray-500 mb-3">{selected.description}</p>}
            <p className="text-sm text-gray-500 mb-4">{formatPrice(selected.priceCents / 100)} c/u</p>

            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <Minus size={16} />
              </button>
              <span className="text-xl font-bold w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(selected.stock, q + 1))}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <Plus size={16} />
              </button>
            </div>

            <p className="text-center text-sm text-gray-700 mb-4">
              Total: <span className="font-bold">{formatPrice((selected.priceCents * quantity) / 100)}</span>
            </p>

            <button onClick={handleBuy} disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Procesando…' : 'Confirmar pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
