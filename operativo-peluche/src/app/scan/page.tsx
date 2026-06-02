'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { ScanResult } from '@/components/ScanResult'
import type { Soldier } from '@/lib/types'

type Phase = 'idle' | 'preview' | 'scanning' | 'result' | 'error'

type ResultData = {
  ya_tengo: Soldier[]
  nuevos_posibles: { descripcion: string; tags: string[] }[]
}

export default function ScanPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<ResultData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fileRef2 = useRef<HTMLInputElement>(null)
  const selectedFile = useRef<File | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    selectedFile.current = file
    const url = URL.createObjectURL(file)
    setPreview(url)
    setPhase('preview')
  }

  async function handleScan() {
    if (!selectedFile.current) return
    setPhase('scanning')
    const formData = new FormData()
    formData.append('foto', selectedFile.current)
    try {
      const res = await fetch('/api/scan', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Error desconocido')
        setPhase('error')
        return
      }
      setResult(data)
      setPhase('result')
    } catch {
      setErrorMsg('Error de red. Chequea tu conexión.')
      setPhase('error')
    }
  }

  function reset() {
    setPhase('idle')
    setPreview(null)
    setResult(null)
    setErrorMsg(null)
    selectedFile.current = null
    if (fileRef.current) fileRef.current.value = ''
    if (fileRef2.current) fileRef2.current.value = ''
  }

  return (
    <main className="min-h-screen bg-base flex flex-col">
      <header className="px-5 pt-6 pb-4 flex items-center gap-4">
        <Link href="/" className="text-sand/50 hover:text-sand text-sm transition-colors">
          ← Base
        </Link>
        <div className="flex-1">
          <h1 className="font-stencil text-bone text-xl tracking-widest uppercase">Reconocimiento</h1>
        </div>
      </header>

      {phase === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-8">
          <div>
            <span className="text-6xl block mb-4">📷</span>
            <p className="font-stencil text-bone text-2xl uppercase tracking-widest leading-tight mb-2">Fotografiá la máquina</p>
            <p className="text-sand/60 text-sm leading-relaxed max-w-xs mx-auto">Apuntá a la vidriera completa para mejor identificación.</p>
          </div>
          <label className="w-full cursor-pointer">
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFileChange} />
            <div className="w-full bg-military hover:bg-military/80 active:scale-95 text-bone font-stencil text-lg tracking-widest uppercase py-5 rounded-sm transition-all text-center">
              📸 Tomar foto
            </div>
          </label>
          <label className="w-full cursor-pointer -mt-4">
            <input ref={fileRef2} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
            <div className="w-full border border-sand/20 hover:border-sand/40 text-sand/60 font-stencil text-sm tracking-widest uppercase py-3 rounded-sm transition-all text-center">
              Subir desde galería
            </div>
          </label>
        </div>
      )}

      {phase === 'preview' && preview && (
        <div className="flex-1 flex flex-col">
          <div className="relative w-full aspect-[4/3] bg-military/20">
            <Image src={preview} alt="Preview" fill className="object-cover" />
          </div>
          <div className="px-5 py-5 space-y-3 mt-auto">
            <button onClick={handleScan} className="w-full bg-military hover:bg-military/80 active:scale-95 text-bone font-stencil text-lg tracking-widest uppercase py-5 rounded-sm transition-all">
              Identificar peluches
            </button>
            <button onClick={reset} className="w-full border border-sand/20 hover:border-sand/40 text-sand/60 font-stencil text-sm tracking-widest uppercase py-3 rounded-sm transition-all">
              Nueva foto
            </button>
          </div>
        </div>
      )}

      {phase === 'scanning' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-2 border-military/30" />
            <div className="absolute inset-0 rounded-full border-2 border-t-sand border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🔭</div>
          </div>
          <div>
            <p className="font-stencil text-bone text-xl uppercase tracking-widest mb-1">Identificando...</p>
            <p className="text-sand/50 text-xs tracking-widest uppercase">Cruzando con el inventario</p>
          </div>
        </div>
      )}

      {phase === 'result' && result && (
        <ScanResult yaEnEjercito={result.ya_tengo} nuevosPosibles={result.nuevos_posibles} onRescan={reset} />
      )}

      {phase === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
          <span className="text-5xl">⚠️</span>
          <div>
            <p className="font-stencil text-bone text-xl uppercase tracking-widest mb-2">Falla en misión</p>
            <p className="text-sand/60 text-sm">{errorMsg}</p>
          </div>
          <button onClick={reset} className="w-full max-w-xs bg-military hover:bg-military/80 active:scale-95 text-bone font-stencil tracking-widest uppercase py-4 rounded-sm transition-all text-sm">Reintentar</button>
        </div>
      )}
    </main>
  )
}
