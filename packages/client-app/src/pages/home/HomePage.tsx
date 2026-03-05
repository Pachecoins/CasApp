import { useNavigate } from 'react-router-dom'
import { MapPin, Bell, ChevronDown, Clock, Repeat } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { Logo } from '@/components/ui/Logo'

const SERVICE_CATEGORIES = [
  { slug: 'jardineria', name: 'Jardinería', icon: '🌿', color: 'bg-green-50 text-green-700' },
  { slug: 'piletas', name: 'Piletas', icon: '💧', color: 'bg-blue-50 text-blue-700' },
  { slug: 'limpieza', name: 'Limpieza', icon: '🧹', color: 'bg-purple-50 text-purple-700' },
  { slug: 'plomeria', name: 'Plomería', icon: '🔧', color: 'bg-orange-50 text-orange-700' },
  { slug: 'electricidad', name: 'Electricidad', icon: '⚡', color: 'bg-yellow-50 text-yellow-700' },
  { slug: 'pintura', name: 'Pintura', icon: '🎨', color: 'bg-pink-50 text-pink-700' },
  { slug: 'carpinteria', name: 'Carpintería', icon: '🪟', color: 'bg-amber-50 text-amber-700' },
  { slug: 'plagas', name: 'Plagas', icon: '🐜', color: 'bg-red-50 text-red-700' },
  { slug: 'aire-acondicionado', name: 'A/C', icon: '❄️', color: 'bg-cyan-50 text-cyan-700' },
  { slug: 'otros', name: 'Otros', icon: '➕', color: 'bg-gray-50 text-gray-700' },
]

export function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleCategorySelect = (slug: string) => {
    navigate(`/services/${slug}`)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
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
              <span className="text-sm font-bold">{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
            </button>
          </div>
        </div>

        {/* Address bar */}
        <button className="flex items-center gap-2 bg-primary-600 rounded-2xl px-4 py-2.5 w-full text-left">
          <MapPin size={16} className="text-primary-200 flex-shrink-0" />
          <span className="text-sm text-white flex-1 truncate">
            {user ? 'Seleccioná tu dirección' : 'Cargando...'}
          </span>
          <ChevronDown size={16} className="text-primary-200" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pt-6">
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card text-center">
            <div className="text-2xl mb-1">0</div>
            <div className="text-xs text-gray-500">Pedidos activos</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl mb-1">0</div>
            <div className="text-xs text-gray-500">Suscripciones</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl mb-1">0</div>
            <div className="text-xs text-gray-500">Completados</div>
          </div>
        </div>

        {/* Booking modes */}
        <div className="mb-6">
          <div className="grid grid-cols-3 gap-3">
            <button className="card text-center hover:shadow-card-hover transition-shadow">
              <div className="text-2xl mb-1">⚡</div>
              <div className="text-xs font-semibold text-secondary">Ahora</div>
              <div className="text-xs text-gray-400">On-demand</div>
            </button>
            <button className="card text-center hover:shadow-card-hover transition-shadow">
              <div className="text-2xl mb-1">📅</div>
              <div className="text-xs font-semibold text-blue-600">Programar</div>
              <div className="text-xs text-gray-400">Elegí horario</div>
            </button>
            <button className="card text-center hover:shadow-card-hover transition-shadow">
              <div className="text-2xl mb-1">🔄</div>
              <div className="text-xs font-semibold text-primary">Suscripción</div>
              <div className="text-xs text-gray-400">Recurrente</div>
            </button>
          </div>
        </div>

        {/* Service categories */}
        <div className="mb-6">
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-4">
            ¿Qué necesitás?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {SERVICE_CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => handleCategorySelect(cat.slug)}
                className="card flex items-center gap-3 hover:shadow-card-hover transition-all active:scale-[0.98] text-left"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${cat.color}`}>
                  {cat.icon}
                </div>
                <span className="font-medium text-gray-800 text-sm">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent activity placeholder */}
        <div>
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-4">
            Actividad reciente
          </h2>
          <div className="card text-center py-8">
            <div className="text-4xl mb-3">🏡</div>
            <p className="text-gray-500 text-sm">
              Todavía no tenés pedidos.<br />
              ¡Contratá tu primer servicio!
            </p>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
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
            onClick={() => navigate('/history')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <Clock size={20} />
            <span className="text-xs">Historial</span>
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
