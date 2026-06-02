import Link from 'next/link'

export default function ScanPage() {
  return (
    <main className="min-h-screen bg-base flex flex-col">
      <div className="px-5 pt-6">
        <Link href="/" className="text-sand/50 hover:text-sand text-sm transition-colors">← Base</Link>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <span className="text-6xl mb-6">🔭</span>
        <h1 className="font-stencil text-bone text-3xl uppercase tracking-widest leading-tight mb-3">Reconocimiento<br />de campo</h1>
        <p className="text-sand/60 text-sm leading-relaxed max-w-xs">El sistema de identificación con IA llega en la próxima misión.</p>
        <div className="mt-8 border border-military rounded-sm px-4 py-2">
          <p className="text-military text-xs uppercase tracking-widest">Operación Día 2</p>
        </div>
      </div>
    </main>
  )
}
