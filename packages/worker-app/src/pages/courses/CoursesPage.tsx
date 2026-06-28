import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, GraduationCap, Lock, CheckCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/utils'

interface Course {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  contentUrl: string | null
  priceCents: number
  freeAboveRating: number | null
  isFreeForMe: boolean
  enrollment: { id: string; status: string } | null
}

export function CoursesPage() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)

  const load = () => {
    api
      .get('/courses')
      .then((r) => setCourses(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleEnroll = async (course: Course) => {
    if (!course.isFreeForMe && course.priceCents > 0) {
      alert('El pago de cursos todavía no está disponible. Mejorá tu calificación para acceder gratis.')
      return
    }
    setEnrollingId(course.id)
    try {
      await api.post(`/courses/${course.id}/enroll`)
      load()
    } catch {
      alert('No pudimos inscribirte en el curso.')
    } finally {
      setEnrollingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="bg-primary px-6 pt-10 pb-6 text-white">
        <button onClick={() => navigate('/profile')} className="mb-4">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-heading font-bold">Cursos para Tukis</h1>
        <p className="text-primary-100 text-sm">Capacitate y mejorá tu servicio. Los mejor calificados acceden gratis.</p>
      </div>

      <div className="px-4 pt-6">
        {loading ? (
          <div className="space-y-3">
            <div className="card animate-pulse h-24 bg-gray-100" />
            <div className="card animate-pulse h-24 bg-gray-100" />
          </div>
        ) : courses.length === 0 ? (
          <div className="card text-center text-sm text-gray-500 py-8">
            Todavía no hay cursos disponibles.
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((c) => {
              const isEnrolled = !!c.enrollment
              const isFree = c.priceCents === 0 || c.isFreeForMe
              return (
                <div key={c.id} className="card flex gap-3">
                  <div className="w-14 h-14 rounded-xl bg-accent-50 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                    {c.thumbnailUrl ? (
                      <img src={c.thumbnailUrl} className="w-full h-full object-cover" />
                    ) : (
                      <GraduationCap className="text-accent-600" size={24} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-800">{c.title}</p>
                    {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-semibold text-primary">
                        {isFree ? 'Gratis' : formatPrice(c.priceCents / 100)}
                      </span>
                      {isEnrolled ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                          <CheckCircle size={14} /> Inscripto
                        </span>
                      ) : (
                        <button
                          onClick={() => handleEnroll(c)}
                          disabled={enrollingId === c.id}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 ${
                            isFree ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {!isFree && <Lock size={11} />}
                          {isFree ? 'Inscribirme' : 'Comprar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
