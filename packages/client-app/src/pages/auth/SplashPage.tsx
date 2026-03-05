import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

export function SplashPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(isAuthenticated ? '/home' : '/login', { replace: true })
    }, 2000)
    return () => clearTimeout(timer)
  }, [navigate, isAuthenticated])

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-24 h-24 rounded-3xl bg-white flex items-center justify-center text-5xl shadow-2xl">
          🏠
        </div>
        <div className="text-center">
          <h1 className="text-5xl font-heading font-bold text-white">
            Cas<span className="text-accent">App</span>
          </h1>
          <p className="text-primary-100 mt-2 text-lg">
            Servicios del hogar, cuando los necesitás
          </p>
        </div>
      </div>

      {/* Loading indicator */}
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>

      {/* Category icons */}
      <div className="absolute bottom-16 flex gap-6 text-3xl opacity-30">
        <span>🌿</span>
        <span>🔧</span>
        <span>🧹</span>
        <span>⚡</span>
        <span>💧</span>
      </div>
    </div>
  )
}
