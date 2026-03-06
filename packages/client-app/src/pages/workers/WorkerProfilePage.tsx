import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Star, MapPin, Shield, CheckCircle,
  ChevronRight, Phone, MessageSquare, Briefcase, Award
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/utils'

interface PortfolioItem {
  id: string
  url: string
  caption?: string
}

interface WorkerService {
  category: { name: string; slug: string }
  yearsExperience: number
  hourlyRate?: number
  portfolio: PortfolioItem[]
}

interface Review {
  id: string
  rating: number
  comment?: string
  createdAt: string
  reviewer: { firstName: string; lastName: string; avatarUrl?: string }
  serviceRequest: { category: { name: string } }
}

interface WorkerProfile {
  id: string
  bio?: string
  rating: number
  totalReviews: number
  isAvailable: boolean
  isVerified: boolean
  completedJobs: number
  user: {
    id: string
    firstName: string
    lastName: string
    avatarUrl?: string
    phone?: string
    createdAt: string
  }
  workerServices: WorkerService[]
  reviews: Review[]
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  )
}

function RatingBar({ rating, count, total }: { rating: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-3 text-gray-500">{rating}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-5 text-right text-gray-400">{count}</span>
    </div>
  )
}

export function WorkerProfilePage() {
  const { workerUserId } = useParams<{ workerUserId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const categorySlug = searchParams.get('category') ?? ''

  const [profile, setProfile] = useState<WorkerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'about' | 'portfolio' | 'reviews'>('about')
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)

  useEffect(() => {
    if (!workerUserId) return
    api
      .get(`/profiles/workers/${workerUserId}`)
      .then((r) => setProfile(r.data.data))
      .catch(() => navigate(-1))
      .finally(() => setLoading(false))
  }, [workerUserId, navigate])

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const allPortfolio = profile.workerServices.flatMap((ws) =>
    (ws.portfolio ?? []).map((p) => ({ ...p, categoryName: ws.category.name })),
  )

  // Rating distribution
  const ratingCounts = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: profile.reviews.filter((rv) => rv.rating === r).length,
  }))

  const memberSince = new Date(profile.user.createdAt).getFullYear()

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Hero */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-br from-primary to-green-700" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-12 left-4 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Avatar */}
        <div className="absolute left-4 -bottom-14">
          {profile.user.avatarUrl ? (
            <img
              src={profile.user.avatarUrl}
              alt={profile.user.firstName}
              className="w-24 h-24 rounded-2xl border-4 border-white object-cover shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl border-4 border-white bg-primary flex items-center justify-center shadow-lg">
              <span className="text-white text-3xl font-bold">
                {profile.user.firstName[0]}{profile.user.lastName[0]}
              </span>
            </div>
          )}
          {profile.isAvailable && (
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 border-2 border-white rounded-full" />
          )}
        </div>
      </div>

      {/* Name + badges */}
      <div className="pt-16 px-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading font-bold text-2xl text-gray-900">
              {profile.user.firstName} {profile.user.lastName}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {profile.isVerified && (
                <span className="flex items-center gap-1 text-xs text-primary bg-green-50 px-2 py-0.5 rounded-full font-medium">
                  <Shield size={10} />
                  Verificado
                </span>
              )}
              <span className="text-xs text-gray-400">Desde {memberSince}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                profile.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {profile.isAvailable ? '● Disponible' : '● No disponible'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="font-bold text-lg text-gray-900">{profile.rating.toFixed(1)}</span>
            </div>
            <p className="text-xs text-gray-400">{profile.totalReviews} reseñas</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
            <p className="font-bold text-lg text-gray-900">{profile.completedJobs}</p>
            <p className="text-xs text-gray-400">Trabajos</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
            <p className="font-bold text-lg text-gray-900">
              {profile.workerServices.length}
            </p>
            <p className="text-xs text-gray-400">Servicios</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mt-5 bg-white rounded-2xl mx-4 p-1 shadow-sm">
        {(['about', 'portfolio', 'reviews'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all capitalize ${
              activeTab === tab ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            {tab === 'about' ? 'Sobre mí' : tab === 'portfolio' ? 'Portfolio' : 'Reseñas'}
          </button>
        ))}
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* ── About ── */}
        {activeTab === 'about' && (
          <>
            {profile.bio && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="font-medium text-gray-800 mb-2">Bio</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <h3 className="font-medium text-gray-800">Servicios</h3>
              </div>
              {profile.workerServices.map((ws) => (
                <div key={ws.category.slug} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{ws.category.name}</p>
                    {ws.yearsExperience > 0 && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Award size={10} />
                        {ws.yearsExperience} año{ws.yearsExperience !== 1 ? 's' : ''} de experiencia
                      </p>
                    )}
                  </div>
                  {ws.hourlyRate && (
                    <p className="text-sm font-semibold text-primary">{formatPrice(ws.hourlyRate)}/h</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Portfolio ── */}
        {activeTab === 'portfolio' && (
          <>
            {allPortfolio.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Briefcase size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin imágenes de portfolio</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {allPortfolio.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setLightboxImg(item.url)}
                    className="relative aspect-square rounded-xl overflow-hidden bg-gray-100"
                  >
                    <img
                      src={item.url}
                      alt={item.caption ?? item.categoryName}
                      className="w-full h-full object-cover"
                    />
                    {item.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-2">
                        <p className="text-white text-xs truncate">{item.caption}</p>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {item.categoryName}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Reviews ── */}
        {activeTab === 'reviews' && (
          <>
            {profile.totalReviews > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="text-center">
                    <p className="text-5xl font-heading font-bold text-gray-900">
                      {profile.rating.toFixed(1)}
                    </p>
                    <StarRating rating={profile.rating} size={16} />
                    <p className="text-xs text-gray-400 mt-1">{profile.totalReviews} reseñas</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {ratingCounts.map(({ rating, count }) => (
                      <RatingBar
                        key={rating}
                        rating={rating}
                        count={count}
                        total={profile.totalReviews}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {profile.reviews.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Star size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin reseñas todavía</p>
              </div>
            ) : (
              <div className="space-y-3">
                {profile.reviews.map((review) => (
                  <div key={review.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center font-bold text-sm text-gray-600 flex-shrink-0">
                        {review.reviewer.firstName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm text-gray-900">
                            {review.reviewer.firstName} {review.reviewer.lastName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(review.createdAt).toLocaleDateString('es-AR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StarRating rating={review.rating} />
                          <span className="text-xs text-gray-400">{review.serviceRequest.category.name}</span>
                        </div>
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <img src={lightboxImg} alt="Portfolio" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 flex gap-3">
        {profile.user.phone && (
          <a
            href={`tel:${profile.user.phone}`}
            className="w-12 h-12 border border-gray-200 rounded-xl flex items-center justify-center text-gray-600 flex-shrink-0"
          >
            <Phone size={20} />
          </a>
        )}
        <Button
          className="flex-1"
          size="lg"
          disabled={!profile.isAvailable}
          onClick={() =>
            navigate(
              categorySlug
                ? `/services/${categorySlug}/configure`
                : '/home',
            )
          }
        >
          {profile.isAvailable ? 'Contratar ahora' : 'No disponible'}
          {profile.isAvailable && <ChevronRight size={18} className="ml-1" />}
        </Button>
      </div>
    </div>
  )
}
