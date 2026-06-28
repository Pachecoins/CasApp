import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, CheckSquare, Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import type { ServiceCategory } from '@casapp/shared'

const registerSchema = z
  .object({
    firstName: z.string().min(2, 'Mínimo 2 caracteres'),
    lastName: z.string().min(2, 'Mínimo 2 caracteres'),
    email: z.string().email('Email inválido'),
    phone: z.string().optional(),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
    bio: z.string().optional(),
    radiusKm: z.number().min(1).max(50).default(10),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const registerWorker = useAuthStore((s) => s.registerWorker)
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { radiusKm: 10 },
  })

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.data || [])).catch(() => {})
  }, [])

  const handleStep1 = async () => {
    const valid = await trigger(['firstName', 'lastName', 'email', 'phone'])
    if (valid) setStep(2)
  }

  const handleStep2 = async () => {
    const valid = await trigger(['password', 'confirmPassword', 'bio', 'radiusKm'])
    if (valid) setStep(3)
  }

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  const onSubmit = async (data: RegisterForm) => {
    if (selectedCategories.length === 0) {
      setServerError('Seleccioná al menos un servicio que ofrecés')
      return
    }
    setServerError(null)
    try {
      await registerWorker({
        ...data,
        categoryIds: selectedCategories,
      })
      navigate('/dashboard')
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } }; message?: string }
      setServerError(apiErr?.response?.data?.error || 'Error al crear la cuenta')
    }
  }

  const steps = ['Datos personales', 'Experiencia', 'Servicios']

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary px-6 pt-10 pb-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl">🏠</div>
          <span className="text-xl font-heading font-bold">Tuki <span className="text-accent">Pro</span></span>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1.5 mb-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${step > i ? 'bg-white' : 'bg-primary-600'}`}
            />
          ))}
        </div>
        <p className="text-primary-100 text-xs">
          Paso {step} de {steps.length} — {steps[step - 1]}
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pt-6 pb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Step 1: Personal data */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-heading font-bold text-gray-900 mb-4">Tus datos</h2>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Nombre" placeholder="Juan" error={errors.firstName?.message} {...register('firstName')} />
                <Input label="Apellido" placeholder="García" error={errors.lastName?.message} {...register('lastName')} />
              </div>
              <Input label="Email" type="email" placeholder="tu@email.com" error={errors.email?.message} {...register('email')} />
              <Input label="Teléfono" type="tel" placeholder="+54 9 11..." error={errors.phone?.message} {...register('phone')} />

              <Button type="button" className="w-full" size="lg" onClick={handleStep1}>
                Continuar →
              </Button>
            </>
          )}

          {/* Step 2: Password + profile */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-heading font-bold text-gray-900 mb-4">Perfil profesional</h2>

              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  error={errors.password?.message}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-gray-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <Input
                label="Confirmar contraseña"
                type="password"
                placeholder="Repetí la contraseña"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />

              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción / Bio</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Contá tu experiencia, especializaciones, años de trabajo..."
                  {...register('bio')}
                />
              </div>

              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Radio de cobertura: <span className="text-primary font-bold">10 km</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={50}
                  className="w-full accent-primary"
                  {...register('radiusKm', { valueAsNumber: true })}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 km</span>
                  <span>50 km</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
                  ← Atrás
                </Button>
                <Button type="button" size="lg" className="flex-1" onClick={handleStep2}>
                  Continuar →
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Services */}
          {step === 3 && (
            <>
              <h2 className="text-xl font-heading font-bold text-gray-900 mb-1">
                ¿Qué servicios ofrecés?
              </h2>
              <p className="text-gray-500 text-sm mb-4">Seleccioná todos los que apliquen</p>

              <div className="grid grid-cols-1 gap-2">
                {categories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary-50 text-primary'
                          : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="text-gray-300" />}
                      <span className="font-medium">{cat.name}</span>
                      <span className="ml-auto text-sm text-gray-400">
                        desde ${cat.basePriceStandard.toLocaleString('es-AR')}
                      </span>
                    </button>
                  )
                })}
              </div>

              {selectedCategories.length > 0 && (
                <div className="bg-primary-50 rounded-xl p-3 text-sm text-primary-700">
                  ✓ {selectedCategories.length} servicio{selectedCategories.length > 1 ? 's' : ''} seleccionado{selectedCategories.length > 1 ? 's' : ''}
                </div>
              )}

              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-600">{serverError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(2)}>
                  ← Atrás
                </Button>
                <Button type="submit" size="lg" className="flex-1" loading={isSubmitting}>
                  Crear cuenta Pro
                </Button>
              </div>
            </>
          )}
        </form>

        {step === 1 && (
          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-primary font-semibold">Iniciá sesión</Link>
          </p>
        )}
      </div>
    </div>
  )
}
