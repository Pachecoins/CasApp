import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

const QUICK_TAGS = [
  'Muy puntual',
  'Excelente trabajo',
  'Muy prolijo',
  'Amable y respetuoso',
  'Precio justo',
  'Lo recomendaría',
]

export function ReviewPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])

  const handleSubmit = async () => {
    if (rating === 0) return
    setSubmitting(true)
    try {
      const fullComment = [
        ...selectedTags,
        comment.trim(),
      ].filter(Boolean).join(' · ')

      await api.post('/reviews', {
        serviceRequestId: requestId,
        rating,
        comment: fullComment || undefined,
      })
      navigate('/home')
    } catch {
      navigate('/home')
    } finally {
      setSubmitting(false)
    }
  }

  const ratingLabels = ['', 'Pésimo', 'Regular', 'Bien', 'Muy bien', '¡Excelente!']

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary px-6 pt-12 pb-8 text-white text-center">
        <div className="text-5xl mb-3">⭐</div>
        <h1 className="text-2xl font-heading font-bold mb-1">¿Cómo fue el servicio?</h1>
        <p className="text-primary-100 text-sm">Tu opinión ayuda a otros clientes</p>
      </div>

      <div className="flex-1 px-6 pt-8 pb-32">
        {/* Stars */}
        <div className="text-center mb-6">
          <div className="flex justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  size={44}
                  className={`transition-colors ${star <= (hovered || rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
                />
              </button>
            ))}
          </div>
          {(hovered || rating) > 0 && (
            <p className="text-lg font-heading font-bold text-gray-800">
              {ratingLabels[hovered || rating]}
            </p>
          )}
        </div>

        {/* Quick tags */}
        {rating >= 4 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">¿Qué destacarías?</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm border-2 transition-all ${
                    selectedTags.includes(tag)
                      ? 'border-primary bg-primary-50 text-primary font-medium'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Comment */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comentario <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={3}
            placeholder="Contanos tu experiencia..."
          />
        </div>

        {/* Re-hire shortcut */}
        {rating >= 4 && (
          <div className="bg-primary-50 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">🔄</span>
            <div className="flex-1">
              <p className="font-medium text-primary-800 text-sm">¿Querés volver a contratarlo?</p>
              <p className="text-xs text-primary-600">Creá una suscripción con este profesional</p>
            </div>
            <button
              onClick={() => navigate('/home')}
              className="text-xs font-semibold text-primary border border-primary rounded-xl px-3 py-1.5"
            >
              Suscribirme
            </button>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 space-y-2">
        <Button
          className="w-full"
          size="lg"
          loading={submitting}
          disabled={rating === 0}
          onClick={handleSubmit}
        >
          Enviar calificación
        </Button>
        <button
          onClick={() => navigate('/home')}
          className="w-full text-center text-sm text-gray-400 py-1"
        >
          Omitir por ahora
        </button>
      </div>
    </div>
  )
}
