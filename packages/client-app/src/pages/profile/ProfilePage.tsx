import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Plus, Trash2, Home, Briefcase, Building2, ChevronRight, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { clientProfileService } from '@/services/requests.service'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatPrice } from '@/lib/utils'

interface ClientAddress {
  id: string
  label: string
  address: string
  latitude: number
  longitude: number
  isGatedCommunity: boolean
  isDefault: boolean
}

const LABEL_ICONS: Record<string, React.ReactNode> = {
  'Casa':      <Home size={16} />,
  'Trabajo':   <Briefcase size={16} />,
  'Country':   <Building2 size={16} />,
  'Otro':      <MapPin size={16} />,
}

const LABEL_OPTIONS = ['Casa', 'Trabajo', 'Country', 'Otro']

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [addresses, setAddresses] = useState<ClientAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Add form state
  const [newLabel, setNewLabel] = useState('Casa')
  const [newAddress, setNewAddress] = useState('')
  const [newGated, setNewGated] = useState(false)
  const [newIsDefault, setNewIsDefault] = useState(false)

  useEffect(() => {
    clientProfileService.getAddresses()
      .then(setAddresses)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleAddAddress = async () => {
    if (!newAddress.trim()) {
      setFormError('Ingresá una dirección')
      return
    }
    setFormError(null)
    setSaving(true)

    try {
      // Get GPS coords
      let lat = -34.6037
      let lng = -58.3816
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 }),
          )
          lat = pos.coords.latitude
          lng = pos.coords.longitude
        } catch { /* use default */ }
      }

      const created = await clientProfileService.addAddress({
        label: newLabel,
        address: newAddress.trim(),
        latitude: lat,
        longitude: lng,
        isGatedCommunity: newGated,
        isDefault: newIsDefault,
      })

      if (newIsDefault) {
        setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: false })).concat(created))
      } else {
        setAddresses((prev) => [...prev, created])
      }

      setNewAddress('')
      setNewGated(false)
      setNewIsDefault(false)
      setNewLabel('Casa')
      setShowAddForm(false)
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setFormError(apiErr?.response?.data?.error ?? 'Error al guardar dirección')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await clientProfileService.deleteAddress(id)
      setAddresses((prev) => prev.filter((a) => a.id !== id))
    } catch { /* ignore */ } finally {
      setDeleting(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background pb-8">

      {/* ── Header ── */}
      <div className="bg-primary px-4 pt-12 pb-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-heading font-bold text-xl">Mi perfil</h1>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-2xl font-bold overflow-hidden">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              : `${user?.firstName?.[0]}${user?.lastName?.[0]}`}
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">{user?.firstName} {user?.lastName}</p>
            <p className="text-primary-100 text-sm">{user?.email}</p>
            {user?.phone && <p className="text-primary-100 text-sm">{user.phone}</p>}
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* Quick links */}
        <div className="bg-white rounded-2xl divide-y divide-gray-50 shadow-sm">
          {[
            { label: 'Historial de pedidos', path: '/requests', icon: '📋' },
            { label: 'Historial de pagos',   path: '/payment/history', icon: '💳' },
            { label: 'Suscripciones',        path: '/subscriptions', icon: '🔄' },
          ].map(({ label, path, icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
            >
              <span className="text-xl">{icon}</span>
              <span className="flex-1 text-left text-sm font-medium text-gray-800">{label}</span>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          ))}
        </div>

        {/* ── Saved addresses ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-bold text-gray-900">Mis direcciones</h2>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1 text-primary text-sm font-medium"
            >
              <Plus size={16} />
              Agregar
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Etiqueta</label>
                <div className="flex gap-2">
                  {LABEL_OPTIONS.map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setNewLabel(lbl)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                        newLabel === lbl ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {LABEL_ICONS[lbl]}
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Dirección"
                placeholder="Av. Corrientes 1234, CABA"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Barrio cerrado / Country</p>
                  <p className="text-xs text-gray-400">Solo verás pros con seguro verificado</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewGated((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${newGated ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${newGated ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={newIsDefault}
                  onChange={(e) => setNewIsDefault(e.target.checked)}
                  className="accent-primary"
                />
                <label htmlFor="isDefault" className="text-sm text-gray-700">Usar como dirección principal</label>
              </div>

              {formError && <p className="text-sm text-red-500">{formError}</p>}

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => { setShowAddForm(false); setFormError(null) }}>
                  Cancelar
                </Button>
                <Button size="sm" className="flex-1" loading={saving} onClick={handleAddAddress}>
                  Guardar
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)}
            </div>
          ) : addresses.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <MapPin size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No tenés direcciones guardadas todavía</p>
            </div>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div key={addr.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${addr.isGatedCommunity ? 'bg-amber-50 text-amber-600' : 'bg-primary-50 text-primary'}`}>
                    {LABEL_ICONS[addr.label] ?? <MapPin size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{addr.label}</p>
                      {addr.isDefault && (
                        <span className="text-xs bg-primary-50 text-primary px-1.5 py-0.5 rounded-full">Principal</span>
                      )}
                      {addr.isGatedCommunity && (
                        <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">🛡️ BC</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{addr.address}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    disabled={deleting === addr.id}
                    className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {deleting === addr.id
                      ? <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-red-500 py-4 rounded-2xl border border-red-100 bg-red-50 hover:bg-red-100 transition-colors font-medium text-sm"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>

        <p className="text-center text-xs text-gray-300">TUKI v1.0 MVP</p>
      </div>
    </div>
  )
}
