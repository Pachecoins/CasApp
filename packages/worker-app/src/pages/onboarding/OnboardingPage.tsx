import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'welcome' | 'identity' | 'equipment' | 'insurance' | 'mercadopago' | 'done'

interface IdentityDocs {
  dniFront: string | null
  dniBack: string | null
  selfie: string | null
}

interface EquipmentItem {
  name: string
  previewUrl: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function CameraCapture({
  label,
  previewUrl,
  onCapture,
  accept = 'image/*',
}: {
  label: string
  previewUrl: string | null
  onCapture: (base64: string, preview: string) => void
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    onCapture(base64, URL.createObjectURL(file))
  }

  return (
    <div
      className="border-2 border-dashed border-gray-300 rounded-2xl p-4 flex flex-col items-center gap-3 cursor-pointer active:opacity-70 transition-opacity"
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      {previewUrl ? (
        <img src={previewUrl} alt={label} className="w-full h-40 object-cover rounded-xl" />
      ) : (
        <div className="flex flex-col items-center gap-2 py-4 text-gray-400">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs">Tocá para abrir la cámara</span>
        </div>
      )}
      {previewUrl && <span className="text-xs text-green-600 font-semibold">✓ Foto capturada</span>}
    </div>
  )
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 pt-8">
      <div className="text-6xl">🛡️</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurá tu perfil TUKI Pro</h1>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          Verificá tu identidad y preparate para recibir trabajos y cobrar de forma segura.
        </p>
      </div>
      <div className="w-full space-y-3 text-left">
        {[
          { icon: '🪪', text: 'DNI + selfie para verificar tu identidad' },
          { icon: '🔧', text: 'Fotos de tu equipamiento para justificar tu tarifa' },
          { icon: '📋', text: 'Póliza ART/seguro (necesaria para barrios cerrados)' },
          { icon: '💳', text: 'Cuenta MercadoPago para recibir pagos automáticos' },
        ].map(({ icon, text }) => (
          <div key={text} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <span className="text-2xl">{icon}</span>
            <span className="text-sm text-gray-700">{text}</span>
          </div>
        ))}
      </div>
      <button onClick={onNext} className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg">
        Empezar verificación
      </button>
    </div>
  )
}

function IdentityStep({
  docs,
  onDocsChange,
  onNext,
}: {
  docs: IdentityDocs
  onDocsChange: (d: IdentityDocs) => void
  onNext: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previews, setPreviews] = useState<{ front?: string; back?: string; selfie?: string }>({})

  const allCaptured = docs.dniFront && docs.dniBack && docs.selfie

  const handleSubmit = async () => {
    if (!allCaptured) return
    setLoading(true); setError('')
    try {
      await api.post('/workers/me/kyc/identity', {
        dniFrontBase64: docs.dniFront,
        dniBackBase64: docs.dniBack,
        selfieBase64: docs.selfie,
      })
      onNext()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar documentos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">1. Verificá tu identidad</h2>
        <p className="text-sm text-gray-500 mt-1">Sacá fotos claras de tu DNI y una selfie. Solo las ven nuestros revisores.</p>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">DNI — Frente</p>
        <CameraCapture label="Foto del frente del DNI" previewUrl={previews.front ?? null}
          onCapture={(b64, prev) => { onDocsChange({ ...docs, dniFront: b64 }); setPreviews(p => ({ ...p, front: prev })) }} />

        <p className="text-sm font-semibold text-gray-700">DNI — Dorso</p>
        <CameraCapture label="Foto del dorso del DNI" previewUrl={previews.back ?? null}
          onCapture={(b64, prev) => { onDocsChange({ ...docs, dniBack: b64 }); setPreviews(p => ({ ...p, back: prev })) }} />

        <p className="text-sm font-semibold text-gray-700">Selfie biométrica</p>
        <CameraCapture label="Tu selfie (mirá a la cámara)" previewUrl={previews.selfie ?? null}
          onCapture={(b64, prev) => { onDocsChange({ ...docs, selfie: b64 }); setPreviews(p => ({ ...p, selfie: prev })) }}
          accept="image/*" />
      </div>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
        La verificación puede demorar hasta 24 hs. Podés completar los otros pasos mientras tanto.
      </div>
      <button onClick={handleSubmit} disabled={!allCaptured || loading}
        className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-40">
        {loading ? 'Enviando...' : 'Enviar para verificación'}
      </button>
    </div>
  )
}

function EquipmentStep({ onNext }: { onNext: () => void }) {
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [newName, setNewName] = useState('')
  const [newPhotoB64, setNewPhotoB64] = useState<string | null>(null)
  const [newPreview, setNewPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addItem = async () => {
    if (!newName.trim() || !newPhotoB64) return
    setLoading(true); setError('')
    try {
      await api.post('/workers/me/equipment', { name: newName.trim(), photoBase64: newPhotoB64 })
      setItems(prev => [...prev, { name: newName.trim(), previewUrl: newPreview! }])
      setNewName(''); setNewPhotoB64(null); setNewPreview(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir equipo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">2. Tu equipamiento</h2>
        <p className="text-sm text-gray-500 mt-1">Subí fotos de tus herramientas. Esto justifica tu tarifa y genera confianza.</p>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
          <img src={item.previewUrl} alt={item.name} className="w-14 h-14 object-cover rounded-lg" />
          <div>
            <p className="font-semibold text-sm">{item.name}</p>
            <p className="text-xs text-green-600">✓ Subido</p>
          </div>
        </div>
      ))}
      <div className="border border-gray-200 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Agregar equipo</p>
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
          placeholder='Ej: "Cortadora Husqvarna 450X"'
          value={newName} onChange={e => setNewName(e.target.value)} />
        <CameraCapture label="Foto del equipo" previewUrl={newPreview}
          onCapture={(b64, prev) => { setNewPhotoB64(b64); setNewPreview(prev) }} />
        <button onClick={addItem} disabled={!newName.trim() || !newPhotoB64 || loading}
          className="w-full bg-gray-800 text-white font-semibold py-3 rounded-xl disabled:opacity-40">
          {loading ? 'Subiendo...' : '+ Agregar equipo'}
        </button>
      </div>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <button onClick={onNext} disabled={items.length === 0}
        className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-40">
        Continuar
      </button>
      <button onClick={onNext} className="text-sm text-gray-400 text-center underline">Saltar por ahora</button>
    </div>
  )
}

function InsuranceStep({ onNext }: { onNext: () => void }) {
  const [photoB64, setPhotoB64] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState('')

  const handleUpload = async () => {
    if (!photoB64) return
    setLoading(true); setError('')
    try {
      await api.post('/workers/me/kyc/insurance', { policyBase64: photoB64 })
      setUploaded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir póliza')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">3. Seguro / ART</h2>
        <p className="text-sm text-gray-500 mt-1">Necesaria para trabajar en barrios cerrados.</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
        <strong>¿Por qué?</strong> Los countries exigen seguro por accidentes. Sin esto, esos trabajos no te aparecen. Podés agregarlo después desde tu perfil.
      </div>
      {uploaded ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="font-semibold text-green-800">Póliza enviada</p>
          <p className="text-xs text-green-600 mt-1">Un revisor la aprobará en las próximas 24 hs.</p>
        </div>
      ) : (
        <>
          <CameraCapture label="Foto de tu póliza o certificado ART" previewUrl={preview}
            onCapture={(b64, prev) => { setPhotoB64(b64); setPreview(prev) }} accept="image/*,application/pdf" />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button onClick={handleUpload} disabled={!photoB64 || loading}
            className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl disabled:opacity-40">
            {loading ? 'Subiendo...' : 'Enviar póliza'}
          </button>
        </>
      )}
      <button onClick={onNext}
        className={`w-full font-bold py-4 rounded-2xl text-lg ${uploaded ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
        {uploaded ? 'Continuar' : 'Saltar por ahora'}
      </button>
    </div>
  )
}

function MercadoPagoStep({ onNext }: { onNext: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const connected = new URLSearchParams(window.location.search).get('mp_connected') === '1'

  const handleConnect = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get<{ data: { url: string } }>('/workers/me/mp/connect-url')
      window.location.href = (res.data as { url: string }).url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al conectar')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">4. Conectá MercadoPago</h2>
        <p className="text-sm text-gray-500 mt-1">Vinculá tu cuenta para recibir pagos automáticamente al finalizar cada trabajo.</p>
      </div>
      <div className="bg-blue-50 rounded-xl p-4 space-y-2 text-sm">
        {[['Total del trabajo', '$ 10.000', ''], ['Comisión TUKI (15%)', '- $ 1.500', 'text-red-500'],
          ['Vos recibís', '$ 8.500', 'text-green-600 font-bold']].map(([label, value, cls]) => (
          <div key={label as string} className={`flex justify-between ${cls as string}`}>
            <span className="text-gray-600">{label as string}</span><span>{value as string}</span>
          </div>
        ))}
      </div>
      {connected ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="font-semibold text-green-800">MercadoPago conectado</p>
        </div>
      ) : (
        <>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button onClick={handleConnect} disabled={loading}
            className="w-full bg-[#009EE3] text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-40">
            {loading ? 'Conectando...' : '💳 Conectar con MercadoPago'}
          </button>
        </>
      )}
      <button onClick={onNext} disabled={!connected}
        className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl disabled:opacity-40">
        Finalizar configuración
      </button>
      <button onClick={onNext} className="text-sm text-gray-400 text-center underline">Saltar por ahora</button>
    </div>
  )
}

function DoneStep() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center text-center gap-6 pt-8">
      <div className="text-6xl">🎉</div>
      <h1 className="text-2xl font-bold text-gray-900">¡Todo listo!</h1>
      <p className="text-gray-500 text-sm leading-relaxed">
        Tu perfil está configurado. Activá tu disponibilidad y empezá a recibir trabajos.
      </p>
      <div className="w-full bg-green-50 rounded-2xl p-4 text-sm text-green-800">
        La verificación de identidad puede demorar hasta 24 hs. Mientras tanto ya podés recibir pedidos sin restricción de seguro.
      </div>
      <button onClick={() => navigate('/dashboard')}
        className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg">
        Ir al dashboard
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const STEPS: Step[] = ['welcome', 'identity', 'equipment', 'insurance', 'mercadopago', 'done']
const STEP_LABELS: Partial<Record<Step, string>> = {
  identity: 'Identidad', equipment: 'Equipamiento', insurance: 'Seguro', mercadopago: 'MercadoPago',
}

export function shouldShowWorkerOnboarding(): boolean {
  return localStorage.getItem('onboarding_completed') !== 'true'
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('welcome')
  const [docs, setDocs] = useState<IdentityDocs>({ dniFront: null, dniBack: null, selfie: null })

  const currentIndex = STEPS.indexOf(step)
  const showProgress = step !== 'welcome' && step !== 'done'
  const progressSteps = STEPS.filter(s => STEP_LABELS[s])
  const next = () => { const i = currentIndex + 1; if (i < STEPS.length) setStep(STEPS[i]) }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {showProgress && (
        <div className="px-4 pt-4 pb-2">
          <div className="flex gap-1 mb-2">
            {progressSteps.map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${STEPS.indexOf(s) <= currentIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Paso {progressSteps.indexOf(step) + 1} de {progressSteps.length} — {STEP_LABELS[step]}
          </p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4">
        {step === 'welcome'     && <WelcomeStep onNext={next} />}
        {step === 'identity'    && <IdentityStep docs={docs} onDocsChange={setDocs} onNext={next} />}
        {step === 'equipment'   && <EquipmentStep onNext={next} />}
        {step === 'insurance'   && <InsuranceStep onNext={next} />}
        {step === 'mercadopago' && <MercadoPagoStep onNext={next} />}
        {step === 'done'        && <DoneStep />}
      </div>
    </div>
  )
}
