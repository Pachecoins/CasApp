import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Briefcase, Bell, TrendingUp, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const ONBOARDING_KEY = 'casapp_worker_onboarded'

const slides = [
  {
    icon: Briefcase,
    color: 'bg-green-50',
    iconColor: 'text-primary',
    title: 'Trabajá cuando\nvos quieras',
    description:
      'Activá tu disponibilidad y empezá a recibir pedidos de clientes cerca tuyo. Vos controlás tu agenda.',
  },
  {
    icon: Bell,
    color: 'bg-blue-50',
    iconColor: 'text-blue-500',
    title: 'Notificaciones\nen tiempo real',
    description:
      'Cuando llegue un pedido cercano te avisamos al instante. Podés aceptar o rechazar según tu conveniencia.',
  },
  {
    icon: TrendingUp,
    color: 'bg-orange-50',
    iconColor: 'text-orange-500',
    title: 'Ganancias\ntransparentes',
    description:
      'Recibís el 80% de cada servicio directamente. Consultá tus ganancias por semana, mes o desde siempre.',
  },
  {
    icon: UserCheck,
    color: 'bg-purple-50',
    iconColor: 'text-purple-500',
    title: 'Construí tu\nreputación',
    description:
      'Cada trabajo bien hecho suma a tu perfil. Una mejor calificación te trae más clientes y mejores oportunidades.',
  },
]

export function WorkerOnboardingPage() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)

  const finish = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    navigate('/dashboard')
  }

  const next = () => {
    if (current < slides.length - 1) {
      setCurrent((c) => c + 1)
    } else {
      finish()
    }
  }

  const slide = slides[current]
  const Icon = slide.icon
  const isLast = current === slides.length - 1

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Skip */}
      <div className="flex justify-end px-5 pt-12">
        <button
          onClick={finish}
          className="text-sm text-gray-400 font-medium"
        >
          Saltar
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div
          className={`w-28 h-28 rounded-3xl ${slide.color} flex items-center justify-center mb-8 transition-all duration-300`}
        >
          <Icon size={52} className={slide.iconColor} />
        </div>

        <h1 className="font-heading font-bold text-3xl text-gray-900 mb-4 whitespace-pre-line leading-tight">
          {slide.title}
        </h1>
        <p className="text-gray-500 text-base leading-relaxed max-w-xs">
          {slide.description}
        </p>
      </div>

      {/* Bottom */}
      <div className="px-6 pb-12 space-y-6">
        {/* Dots */}
        <div className="flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current ? 'w-6 h-2 bg-primary' : 'w-2 h-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={next}
        >
          {isLast ? 'Empezar a trabajar' : 'Continuar'}
          {!isLast && <ChevronRight size={18} className="ml-1" />}
        </Button>
      </div>
    </div>
  )
}

export function shouldShowWorkerOnboarding(): boolean {
  return !localStorage.getItem(ONBOARDING_KEY)
}
