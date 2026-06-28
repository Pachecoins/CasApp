import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mic, Send, Volume2, Star, MapPin } from 'lucide-react'
import { assistantService } from '@/services/assistant.service'

interface RecommendedWorker {
  id: string
  user: { firstName: string; lastName: string; avatarUrl: string | null }
  rating: number
  totalReviews: number
  distanceKm: number
  estimatedArrivalMin: number
}

interface Result {
  problem: string
  solution: string
  category: { slug: string; name: string } | null
  recommendedWorkers: RecommendedWorker[]
}

export function AskTukiPage() {
  const navigate = useNavigate()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const recognitionRef = useRef<any>(null)

  const getLocation = (): Promise<{ lat?: number; lng?: number }> =>
    new Promise((resolve) => {
      if (!('geolocation' in navigator)) return resolve({})
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 4000 },
      )
    })

  const handleAnalyze = async () => {
    if (description.trim().length < 5) {
      setError('Contanos un poco más qué está pasando.')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const { lat, lng } = await getLocation()
      const data = await assistantService.analyze({
        description: description.trim(),
        latitude: lat,
        longitude: lng,
      })
      setResult({
        problem: data.analysis.problem,
        solution: data.analysis.solution,
        category: data.category,
        recommendedWorkers: data.recommendedWorkers,
      })
    } catch {
      setError('No pudimos analizar tu pedido. Probá de nuevo en un momento.')
    } finally {
      setLoading(false)
    }
  }

  const toggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Tu navegador no soporta entrada de voz.')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-AR'
    recognition.interimResults = false
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  const speakSolution = () => {
    if (!result || !('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(result.solution)
    utterance.lang = 'es-AR'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary px-6 pt-10 pb-6 text-white">
        <button onClick={() => navigate('/home')} className="mb-4">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-3xl shadow-lg">
            🦜
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Tuki te escucha</h1>
            <p className="text-primary-100 text-sm">¿Qué está pasando?</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-6 pb-28">
        <div className="card mb-4">
          <label className="input-label">Contame qué pasa en tu casa</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: el pasto del jardín está muy crecido y hay hojas por todos lados…"
            className="input-field min-h-[100px] resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={toggleVoiceInput}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                listening ? 'bg-secondary-50 text-secondary-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Mic size={14} />
              {listening ? 'Escuchando…' : 'Hablar'}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-secondary-700 mb-3">{error}</p>}

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2 mb-6"
        >
          <Send size={18} />
          {loading ? 'Tuki está pensando…' : 'Preguntarle a Tuki'}
        </button>

        {result && (
          <div className="space-y-4">
            <div className="card">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Problema</p>
              <p className="text-sm text-gray-800">{result.problem}</p>
            </div>

            <div className="card bg-primary-50">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-primary-700 uppercase mb-1">Solución de Tuki</p>
                  <p className="text-sm text-primary-800">{result.solution}</p>
                </div>
                <button
                  onClick={speakSolution}
                  className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0"
                >
                  <Volume2 size={16} className="text-primary-700" />
                </button>
              </div>
            </div>

            {result.category && result.recommendedWorkers.length > 0 && (
              <div>
                <h2 className="text-sm font-heading font-bold text-gray-900 mb-3">
                  Tukis recomendados para {result.category.name}
                </h2>
                <div className="space-y-3">
                  {result.recommendedWorkers.map((w) => (
                    <div key={w.id} className="card flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-lg font-bold text-primary-700">
                        {w.user.firstName[0]}
                        {w.user.lastName[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-800">
                          {w.user.firstName} {w.user.lastName}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-0.5">
                            <Star size={12} className="fill-accent text-accent" />
                            {w.rating.toFixed(1)} ({w.totalReviews})
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MapPin size={12} />
                            {w.distanceKm} km
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          navigate(`/services/${result.category!.slug}?type=ON_DEMAND`)
                        }
                        className="btn-outline px-3 py-2 text-xs"
                      >
                        Pedir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.category && result.recommendedWorkers.length === 0 && (
              <div className="card text-center text-sm text-gray-500 py-6">
                No encontramos Tukis disponibles cerca ahora. Probá de nuevo en un rato.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
