import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, MapPin } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/auth.store'

const registerSchema = z
  .object({
    firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
    email: z.string().email('Ingresá un email válido'),
    phone: z.string().optional(),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string(),
    address: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const registerClient = useAuthStore((s) => s.registerClient)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2>(1)

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const handleNextStep = async () => {
    const valid = await trigger(['firstName', 'lastName', 'email', 'phone'])
    if (valid) setStep(2)
  }

  const onSubmit = async (data: RegisterForm) => {
    setServerError(null)
    try {
      await registerClient({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        address: data.address,
      })
      navigate('/home')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Error al crear la cuenta'
      setServerError(message)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <Logo size="md" />
      </div>

      {/* Step indicator */}
      <div className="px-6 pb-6">
        <div className="flex items-center gap-2 mb-6">
          <div
            className={`h-1 flex-1 rounded-full transition-all ${step >= 1 ? 'bg-primary' : 'bg-gray-200'}`}
          />
          <div
            className={`h-1 flex-1 rounded-full transition-all ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`}
          />
        </div>

        <h1 className="text-3xl font-heading font-bold text-gray-900 mb-1">
          {step === 1 ? 'Creá tu cuenta' : 'Seguridad y dirección'}
        </h1>
        <p className="text-gray-500 text-sm">
          {step === 1 ? 'Paso 1 de 2 — Tus datos personales' : 'Paso 2 de 2 — Contraseña y ubicación'}
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Step 1 */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Nombre"
                  placeholder="Juan"
                  error={errors.firstName?.message}
                  autoComplete="given-name"
                  {...register('firstName')}
                />
                <Input
                  label="Apellido"
                  placeholder="García"
                  error={errors.lastName?.message}
                  autoComplete="family-name"
                  {...register('lastName')}
                />
              </div>

              <Input
                label="Email"
                type="email"
                placeholder="tu@email.com"
                error={errors.email?.message}
                autoComplete="email"
                {...register('email')}
              />

              <Input
                label="Teléfono (opcional)"
                type="tel"
                placeholder="+54 9 11 1234-5678"
                error={errors.phone?.message}
                autoComplete="tel"
                {...register('phone')}
              />

              <Button
                type="button"
                className="w-full mt-2"
                size="lg"
                onClick={handleNextStep}
              >
                Continuar →
              </Button>
            </>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <>
              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  error={errors.password?.message}
                  autoComplete="new-password"
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

              <div className="relative">
                <Input
                  label="Confirmar contraseña"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repetí la contraseña"
                  error={errors.confirmPassword?.message}
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Address */}
              <div className="relative">
                <Input
                  label="Tu dirección principal (opcional)"
                  placeholder="Av. Corrientes 1234, Buenos Aires"
                  error={errors.address?.message}
                  {...register('address')}
                />
                <MapPin size={16} className="absolute right-3 top-[38px] text-gray-400" />
              </div>

              <p className="text-xs text-gray-500 -mt-1">
                Podés actualizar tu dirección después
              </p>

              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-600">{serverError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  ← Atrás
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1"
                  loading={isSubmitting}
                >
                  Crear cuenta
                </Button>
              </div>
            </>
          )}
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            ¿Ya tenés cuenta?{' '}
            <Link
              to="/login"
              className="text-primary font-semibold hover:text-primary-600 transition-colors"
            >
              Iniciá sesión
            </Link>
          </p>
        </div>

        <p className="mt-6 text-xs text-center text-gray-400">
          Al registrarte aceptás nuestros{' '}
          <span className="underline cursor-pointer">Términos y Condiciones</span>
          {' '}y la{' '}
          <span className="underline cursor-pointer">Política de Privacidad</span>
        </p>
      </div>
    </div>
  )
}
