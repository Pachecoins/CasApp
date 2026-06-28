import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Star, Camera, Edit3, Plus, Trash2,
  CheckCircle, Shield, Award, ChevronDown, X, GraduationCap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'

interface PortfolioItem {
  id: string
  url: string
  caption?: string
  categoryName?: string
}

interface WorkerService {
  category: { id: string; name: string; slug: string }
  yearsExperience: number
  portfolio: PortfolioItem[]
}

interface OwnProfile {
  id: string
  bio?: string
  rating: number
  totalReviews: number
  isVerified: boolean
  radiusKm: number
  completedJobs: number
  user: { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string; phone?: string }
  workerServices: WorkerService[]
  reviews: Array<{
    id: string
    rating: number
    comment?: string
    createdAt: string
    reviewer: { firstName: string; lastName: string }
  }>
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const portfolioInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<OwnProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingBio, setEditingBio] = useState(false)
  const [bio, setBio] = useState('')
  const [savingBio, setSavingBio] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  useEffect(() => {
    api
      .get('/profiles/me')
      .then((r) => {
        setProfile(r.data.data)
        setBio(r.data.data.bio ?? '')
        if (r.data.data.workerServices[0]) {
          setSelectedCategoryId(r.data.data.workerServices[0].category.id)
        }
      })
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false))
  }, [navigate])

  const handleSaveBio = async () => {
    if (!profile) return
    setSavingBio(true)
    try {
      const r = await api.patch('/profiles/me', { bio })
      setProfile((p) => p ? { ...p, bio: r.data.data.bio } : p)
      setEditingBio(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingBio(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const form = new FormData()
      form.append('avatar', file)
      const r = await api.post('/profiles/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setProfile((p) =>
        p ? { ...p, user: { ...p.user, avatarUrl: r.data.data.avatarUrl } } : p,
      )
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedCategoryId) return
    setUploadingPortfolio(true)
    try {
      const form = new FormData()
      form.append('image', file)
      form.append('categoryId', selectedCategoryId)
      const r = await api.post('/profiles/me/portfolio', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const newItem: PortfolioItem = r.data.data
      setProfile((p) => {
        if (!p) return p
        return {
          ...p,
          workerServices: p.workerServices.map((ws) =>
            ws.category.id === selectedCategoryId
              ? { ...ws, portfolio: [...ws.portfolio, newItem] }
              : ws,
          ),
        }
      })
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingPortfolio(false)
      e.target.value = ''
    }
  }

  const handleRemovePortfolioItem = async (categoryId: string, itemId: string) => {
    try {
      await api.delete(`/profiles/me/portfolio/${categoryId}/${itemId}`)
      setProfile((p) => {
        if (!p) return p
        return {
          ...p,
          workerServices: p.workerServices.map((ws) =>
            ws.category.id === categoryId
              ? { ...ws, portfolio: ws.portfolio.filter((i) => i.id !== itemId) }
              : ws,
          ),
        }
      })
    } catch (err) {
      console.error(err)
    }
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-heading font-bold text-gray-900">Mi perfil</h1>
        </div>
        <button
          onClick={logout}
          className="text-sm text-red-500 font-medium"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Avatar + name */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            {profile.user.avatarUrl ? (
              <img
                src={profile.user.avatarUrl}
                alt={profile.user.firstName}
                className="w-20 h-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {profile.user.firstName[0]}{profile.user.lastName[0]}
                </span>
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white shadow"
            >
              {uploadingAvatar ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera size={13} />
              )}
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-heading font-bold text-xl text-gray-900">
              {profile.user.firstName} {profile.user.lastName}
            </h2>
            <p className="text-sm text-gray-500 truncate">{profile.user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {profile.isVerified && (
                <span className="flex items-center gap-1 text-xs text-primary bg-green-50 px-2 py-0.5 rounded-full">
                  <Shield size={9} />
                  Verificado
                </span>
              )}
              <div className="flex items-center gap-1">
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-medium text-gray-700">{profile.rating.toFixed(1)}</span>
                <span className="text-xs text-gray-400">({profile.totalReviews})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
            <p className="text-xl font-heading font-bold text-gray-900">{profile.completedJobs}</p>
            <p className="text-xs text-gray-400 mt-0.5">Completados</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
            <p className="text-xl font-heading font-bold text-gray-900">{profile.totalReviews}</p>
            <p className="text-xs text-gray-400 mt-0.5">Reseñas</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
            <p className="text-xl font-heading font-bold text-gray-900">{profile.radiusKm}km</p>
            <p className="text-xs text-gray-400 mt-0.5">Radio</p>
          </div>
        </div>

        {/* Courses */}
        <button
          onClick={() => navigate('/cursos')}
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-accent-50 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={20} className="text-accent-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm text-gray-800">Cursos para Tukis</p>
            <p className="text-xs text-gray-500">Capacitate y mejorá tu servicio. Gratis si tenés buena calificación.</p>
          </div>
        </button>

        {/* Bio */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-800">Bio</h3>
            <button
              onClick={() => setEditingBio(!editingBio)}
              className="text-primary p-1"
            >
              <Edit3 size={16} />
            </button>
          </div>
          {editingBio ? (
            <div className="space-y-2">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Contá quién sos, tu experiencia y lo que ofrecés..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">{bio.length}/500</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setBio(profile.bio ?? ''); setEditingBio(false) }}>
                    Cancelar
                  </Button>
                  <Button size="sm" loading={savingBio} onClick={handleSaveBio}>
                    Guardar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed">
              {profile.bio || <span className="text-gray-400 italic">Sin bio. Agregá una descripción para que los clientes te conozcan.</span>}
            </p>
          )}
        </div>

        {/* Portfolio per category */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-medium text-gray-800">Portfolio</h3>
            <div className="flex items-center gap-2">
              {profile.workerServices.length > 1 && (
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  {profile.workerServices.map((ws) => (
                    <option key={ws.category.id} value={ws.category.id}>
                      {ws.category.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                ref={portfolioInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePortfolioUpload}
              />
              <button
                onClick={() => portfolioInputRef.current?.click()}
                disabled={uploadingPortfolio || !selectedCategoryId}
                className="flex items-center gap-1 text-xs text-primary font-medium bg-green-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {uploadingPortfolio ? (
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus size={12} />
                )}
                Agregar
              </button>
            </div>
          </div>

          {profile.workerServices.map((ws) => {
            const isExpanded = expandedCategory === ws.category.id || profile.workerServices.length === 1
            const portfolio = ws.portfolio ?? []

            return (
              <div key={ws.category.id} className="border-b border-gray-50 last:border-0">
                {profile.workerServices.length > 1 && (
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : ws.category.id)}
                    className="w-full flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <Award size={14} className="text-gray-400" />
                      <span className="text-sm font-medium text-gray-800">{ws.category.name}</span>
                      <span className="text-xs text-gray-400">({portfolio.length} fotos)</span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}

                {isExpanded && (
                  <div className="px-4 pb-4">
                    {portfolio.length === 0 ? (
                      <p className="text-sm text-gray-400 italic py-2">
                        Sin fotos. Mostrá tu trabajo para conseguir más clientes.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {portfolio.map((item) => (
                          <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                            <img src={item.url} alt={item.caption ?? ws.category.name} className="w-full h-full object-cover" />
                            <button
                              onClick={() => handleRemovePortfolioItem(ws.category.id, item.id)}
                              className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Recent reviews */}
        {profile.reviews.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-medium text-gray-800 mb-3">Últimas reseñas</h3>
            <div className="space-y-3">
              {profile.reviews.slice(0, 5).map((review) => (
                <div key={review.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                    {review.reviewer.firstName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{review.reviewer.firstName}</p>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={10}
                            className={s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
