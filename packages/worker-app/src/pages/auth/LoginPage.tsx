import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/auth.store'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    try {
      await login(data.email, data.password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } }; message?: string }
      setServerError(apiErr?.response?.data?.error || apiErr?.message || 'Error al iniciar sesión')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="bg-primary px-6 pt-12 pb-10 text-white">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center">
            <span className="text-2xl">🏠</span>
          </div>
          <div>
            <div className="text-2xl font-heading font-bold">
              Tuki <span className="text-accent">Pro</span>
            </div>
            <div className="text-primary-100 text-xs">Para profesionales del hogar</div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-primary-600 rounded-2xl px-4 py-3">
          <Briefcase size={16} className="text-primary-200" />
          <span className="text-sm text-primary-100">Acceso exclusivo para trabajadores verificados</span>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pt-8 pb-8">
        <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Iniciá sesión</h1>
        <p className="text-gray-500 text-sm mb-6">Accedé a tu panel de trabajos</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email profesional"
            type="email"
            placeholder="tu@email.com"
            error={errors.email?.message}
            autoComplete="email"
            {...register('email')}
          />

          <div className="relative">
            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              placeholder="Tu contraseña"
              error={errors.password?.message}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600">{serverError}</p>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
            Ingresar al panel
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          ¿Todavía no sos parte del equipo?{' '}
          <Link to="/register" className="text-primary font-semibold hover:text-primary-600">
            Registrate como profesional
          </Link>
        </p>

        <div className="mt-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">o</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          ¿Sos cliente?{' '}
          <a
            href={import.meta.env.VITE_CLIENT_APP_URL || 'http://localhost:5173'}
            className="text-secondary font-semibold"
          >
            Usá Tuki Cliente →
          </a>
        </p>
      </div>
    </div>
  )
}
