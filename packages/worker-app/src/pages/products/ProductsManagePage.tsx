import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/utils'

interface Product {
  id: string
  name: string
  photoUrl: string
  priceCents: number
  stock: number
  isActive: boolean
}

interface Order {
  id: string
  status: string
  quantity: number
  totalPriceCents: number
  product: { name: string }
  buyer: { firstName: string; lastName: string; phone: string | null }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ProductsManagePage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [photoB64, setPhotoB64] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    Promise.all([api.get('/products/me'), api.get('/products/me/orders')])
      .then(([p, o]) => {
        setProducts(p.data.data)
        setOrders(o.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoB64(await fileToBase64(file))
    setPreview(URL.createObjectURL(file))
  }

  const handleCreate = async () => {
    if (!name.trim() || !price || !stock || !photoB64) return
    setCreating(true)
    setError('')
    try {
      await api.post('/products', {
        name: name.trim(),
        priceCents: Math.round(parseFloat(price) * 100),
        stock: parseInt(stock, 10),
        photoBase64: photoB64,
      })
      setName('')
      setPrice('')
      setStock('')
      setPhotoB64(null)
      setPreview(null)
      load()
    } catch {
      setError('No pudimos publicar el producto.')
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (p: Product) => {
    await api.patch(`/products/${p.id}`, { isActive: !p.isActive })
    load()
  }

  const updateOrderStatus = async (orderId: string, status: string) => {
    await api.patch(`/products/orders/${orderId}/status`, { status })
    load()
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="bg-primary px-6 pt-10 pb-6 text-white">
        <button onClick={() => navigate('/dashboard')} className="mb-4">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-heading font-bold">Mis productos</h1>
        <p className="text-primary-100 text-sm">Vendé lo que generás en tus trabajos (hojas, recortes, etc.)</p>
      </div>

      <div className="px-4 pt-6">
        <div className="card mb-6 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Publicar producto nuevo</p>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
            placeholder='Ej: "Briquetas de carbón ecológico x10"'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="number"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm"
              placeholder="Precio (ARS)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <input
              type="number"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm"
              placeholder="Stock"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
          <div
            className="border-2 border-dashed border-gray-300 rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer"
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            {preview ? (
              <img src={preview} className="w-20 h-20 object-cover rounded-lg" />
            ) : (
              <p className="text-xs text-gray-400">Tocá para subir una foto</p>
            )}
          </div>
          {error && <p className="text-xs text-secondary-700">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !price || !stock || !photoB64}
            className="btn-primary w-full text-sm"
          >
            {creating ? 'Publicando…' : 'Publicar'}
          </button>
        </div>

        <h2 className="text-sm font-heading font-bold text-gray-900 mb-3">Tus productos</h2>
        {loading ? (
          <div className="card animate-pulse h-16 bg-gray-100 mb-6" />
        ) : products.length === 0 ? (
          <p className="text-sm text-gray-400 mb-6">Todavía no publicaste productos.</p>
        ) : (
          <div className="space-y-3 mb-8">
            {products.map((p) => (
              <div key={p.id} className="card flex items-center gap-3">
                <img src={p.photoUrl} className="w-12 h-12 rounded-xl object-cover bg-gray-100" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatPrice(p.priceCents / 100)} · stock {p.stock}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(p)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                    p.isActive ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {p.isActive ? 'Publicado' : 'Pausado'}
                </button>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-sm font-heading font-bold text-gray-900 mb-3">Pedidos recibidos</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400">Sin pedidos todavía.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="card">
                <p className="font-medium text-sm text-gray-800">
                  {o.product.name} x{o.quantity}
                </p>
                <p className="text-xs text-gray-500">
                  {o.buyer.firstName} {o.buyer.lastName}
                </p>
                <p className="text-sm font-bold text-primary mt-1">{formatPrice(o.totalPriceCents / 100)}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-semibold text-gray-500">{o.status}</span>
                  {o.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateOrderStatus(o.id, 'CANCELLED')}
                        className="text-xs text-secondary-700 font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => updateOrderStatus(o.id, 'CONFIRMED')}
                        className="text-xs text-primary font-semibold"
                      >
                        Confirmar
                      </button>
                    </div>
                  )}
                  {o.status === 'CONFIRMED' && (
                    <button
                      onClick={() => updateOrderStatus(o.id, 'DELIVERED')}
                      className="text-xs text-primary font-semibold"
                    >
                      Marcar entregado
                    </button>
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
