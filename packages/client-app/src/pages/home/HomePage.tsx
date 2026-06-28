import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, Clock, MapPin, Repeat } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { categoriesService, requestsService, subscriptionsService } from '@/services/requests.service'
import type { ServiceCategory } from '@casapp/shared'

// ─── Per-slug visual overrides (UI only) ─────────────────────────────────────
const CATEGORY_VISUALS: Record<string, { icon: string; color: string }> = {
  'jardineria':         { icon: '🌿', color: 'bg-green-50 text-green-700' },
  'piletas':            { icon: '💧', color: 'bg-blue-50 text-blue-700' },
  'pintura':            { icon: '🎨', color: 'bg-pink-50 text-pink-700' },
  'limpieza-de-vidrios':{ icon: '🪟', color: 'bg-sky-50 text-sky-700' },
}
const DEFAULT_VISUAL = { icon: '🔧', color: 'bg-gray-50 text-gray-700' }

type ServiceType = 'ON_DEMAND' | 'SCHEDULED' | 'SUBSCRIPTION'

const BOOKING_MODES: { type: ServiceType; emoji: string; label: string; sublabel: string; activeColor: string }[] = [
  { type: 'ON_DEMAND',    emoji: '⚡', label: 'Ahora',       sublabel: 'On-demand', activeColor: 'border-secondary text-secondary' },
  { type: 'SCHEDULED',   emoji: '📅', label: 'Programar',   sublabel: 'Elegí horario', activeColor: 'border-blue-500 text-blue-600' },
  { type: 'SUBSCRIPTION', emoji: '🔄', label: 'Suscripción', sublabel: 'Recurrente',   activeColor: 'border-primary text-primary' },
]

export function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [categories, setCategories]   = useState<ServiceCategory[]>([])
  const [catLoading, setCatLoading]   = useState(true)
  const [activeType, setActiveType]   = useState<ServiceType>('ON_DEMAND')

  // Live stats
  const [statsLoading, setStatsLoading] = useState(true)
  const [activeRequests, setActiveRequests]     = useState(0)
  const [subscriptionCount, setSubscriptionCount] = useState(0)
  const [completedCount, setCompletedCount]     = useState(0)

  // Geolocation
  const [geoLabel, setGeoLabel] = useState<string>('Obteniendo ubicación...')

  // ── Load categories ───────────────────────────────────────────────────────────
  useEffect(() => {
    categoriesService
      .getAll()
      .then((all) => setCategories(all.filter((c) => c.isActive)))
      .catch(() => setCategories([]))
      .finally(() => setCatLoading(false))
  }, [])

  // ── Load stats ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    Promise.all([
      requestsService.getMyRequests().catch(() => []),
      subscriptionsService.getMySubscriptions().catch(() => []),
    ]).then(([requests, subs]) => {
      const active = requests.filter(
        (r: { status: string }) =>
          !['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(r.status),
      )
      setActiveRequests(active.length)
      setSubscriptionCount(
        subs.filter((s: { isActive: boolean }) => s.isActive).length,
      )
      setCompletedCount(
        requests.filter((r: { status: string }) => r.status === 'COMPLETED').length,
      )
    }).finally(() => setStatsLoading(false))
  }, [user])

  // ── Geolocation ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoLabel('Buenos Aires, ARG')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Display coords until reverse-geocoding is implemented
        const lat = pos.coords.latitude.toFixed(4)
        const lng = pos.coords.longitude.toFixed(4)
        setGeoLabel(`${lat}, ${lng}`)
      },
      () => setGeoLabel('Buenos Aires, ARG'),
      { timeout: 4000 },
    )
  }, [])

  // ── Navigation ────────────────────────────────────────────────────────────────
  const handleCategorySelect = (slug: string) =>
    navigate(`/services/${slug}?type=${activeType}`)

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-24">

      {/* ── Header ── */}
      <div className="bg-primary px-6 pt-12 pb-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-primary-100 text-sm">Hola 👋</p>
            <h1 className="text-2xl font-heading font-bold">
              {user?.firstName} {user?.lastName}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
              <Bell size={18} />
            </button>
            <button
              onClick={logout}
              className="w-10 h-10 rounded-full bg-primary-600 overflow-hidden flex items-center justify-center"
            >
              <span className="text-sm font-bold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </button>
          </div>
        </div>

        {/* Address / GPS bar */}
        <button className="flex items-center gap-2 bg-primary-600 rounded-2xl px-4 py-2.5 w-full text-left">
          <MapPin size={16} className="text-primary-200 flex-shrink-0" />
          <span className="text-sm text-white flex-1 truncate">{geoLabel}</span>
          <ChevronDown size={16} className="text-primary-200" />
        </button>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-6">

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { value: statsLoading ? '…' : activeRequests,     label: 'Pedidos activos' },
            { value: statsLoading ? '…' : subscriptionCount,  label: 'Suscripciones' },
            { value: statsLoading ? '…' : completedCount,     label: 'Completados' },
          ].map(({ value, label }) => (
            <div key={label} className="card text-center">
              <div className="text-2xl font-bold mb-0.5">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Ask Tuki AI banner */}
        <button
          onClick={() => navigate('/asistente')}
          className="w-full bg-gradient-to-r from-primary to-primary-600 rounded-2xl p-4 mb-6 flex items-center gap-3 text-left text-white shadow-card hover:shadow-card-hover transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
            🦜
          </div>
          <div className="flex-1">
            <p className="font-heading font-bold text-sm">¿Qué está pasando?</p>
            <p className="text-primary-100 text-xs">Contale a Tuki tu problema y te recomienda al mejor profesional</p>
          </div>
        </button>

        {/* Equipment rental banner */}
        <button
          onClick={() => navigate('/equipos')}
          className="w-full bg-white border-2 border-secondary-100 rounded-2xl p-4 mb-6 flex items-center gap-3 text-left hover:shadow-card-hover transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-secondary-50 flex items-center justify-center text-2xl flex-shrink-0">
            🔧
          </div>
          <div className="flex-1">
            <p className="font-heading font-bold text-sm text-gray-800">Alquiler de máquinas</p>
            <p className="text-gray-500 text-xs">Alquilá equipos de los Tukis cerca tuyo</p>
          </div>
        </button>

        {/* Booking mode toggle */}
        <div className="mb-6">
          <div className="grid grid-cols-3 gap-3">
            {BOOKING_MODES.map((mode) => (
              <button
                key={mode.type}
                onClick={() => setActiveType(mode.type)}
                className={`card text-center border-2 hover:shadow-card-hover transition-all ${
                  activeType === mode.type
                    ? `${mode.activeColor} border-current`
                    : 'border-transparent'
                }`}
              >
                <div className="text-2xl mb-1">{mode.emoji}</div>
                <div className={`text-xs font-semibold ${activeType === mode.type ? '' : 'text-gray-700'}`}>
                  {mode.label}
                </div>
                <div className="text-xs text-gray-400">{mode.sublabel}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Service categories */}
        <div className="mb-6">
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-4">
            ¿Qué necesitás?
          </h2>

          {catLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="card animate-pulse h-16 bg-gray-100" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="card text-center py-8 text-gray-400 text-sm">
              No hay servicios disponibles por el momento.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => {
                const visual = CATEGORY_VISUALS[cat.slug] ?? DEFAULT_VISUAL
                return (
                  <button
                    key={cat.slug}
                    onClick={() => handleCategorySelect(cat.slug)}
                    className="card flex items-center gap-3 hover:shadow-card-hover transition-all active:scale-[0.98] text-left"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${visual.color}`}>
                      {cat.iconUrl ? (
                        <img src={cat.iconUrl} alt={cat.name} className="w-7 h-7 object-contain" />
                      ) : (
                        visual.icon
                      )}
                    </div>
                    <span className="font-medium text-gray-800 text-sm">{cat.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent activity — navigate to full list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-gray-900">Actividad reciente</h2>
            {activeRequests > 0 && (
              <button
                onClick={() => navigate('/requests')}
                className="text-xs text-primary font-medium"
              >
                Ver todo
              </button>
            )}
          </div>

          {activeRequests > 0 ? (
            <button
              onClick={() => navigate('/requests')}
              className="card w-full flex items-center gap-3 text-left hover:shadow-card-hover transition-shadow"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary-50 flex items-center justify-center text-xl">
                ⚡
              </div>
              <div>
                <p className="font-medium text-sm text-gray-800">
                  {activeRequests} pedido{activeRequests !== 1 ? 's' : ''} activo{activeRequests !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-500">Tocá para ver el estado</p>
              </div>
            </button>
          ) : (
            <div className="card text-center py-8">
              <div className="text-4xl mb-3">🏡</div>
              <p className="text-gray-500 text-sm">
                Todavía no tenés pedidos.<br />
                ¡Contratá tu primer servicio!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3">
        <div className="flex justify-around">
          <button className="flex flex-col items-center gap-1 text-primary">
            <span className="text-xl">🏠</span>
            <span className="text-xs font-medium">Inicio</span>
          </button>
          <button
            onClick={() => navigate('/subscriptions')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <Repeat size={20} />
            <span className="text-xs">Suscripciones</span>
          </button>
          <button
            onClick={() => navigate('/payment/history')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <Clock size={20} />
            <span className="text-xs">Pagos</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs">
              {user?.firstName?.[0]}
            </div>
            <span className="text-xs">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
