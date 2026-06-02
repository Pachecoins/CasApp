import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { count } = await supabase
    .from('soldiers')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'activo')

  const soldierCount = count ?? 0

  return (
    <main className="min-h-screen bg-base flex flex-col">
      <header className="px-6 pt-10 pb-4 text-center">
        <p className="text-sand text-xs tracking-[0.4em] uppercase mb-1">República Argentina — Operación activa</p>
        <h1 className="font-stencil text-bone text-5xl tracking-wider uppercase leading-tight">Operativo<br />Peluche</h1>
        <div className="mt-3 h-px w-24 bg-military mx-auto" />
      </header>
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
        <p className="text-sand/70 text-xs tracking-[0.3em] uppercase mb-2">Efectivos en servicio activo</p>
        <div className="font-stencil text-bone leading-none mb-1">
          <span className="text-9xl">{soldierCount}</span>
        </div>
        <p className="text-sand text-sm tracking-[0.2em] uppercase">Soldados activos</p>
      </section>
      <section className="px-6 pb-10 space-y-3">
        <Link href="/scan" className="flex items-center justify-center w-full bg-military hover:bg-military/80 active:scale-95 text-bone font-stencil text-xl tracking-widest uppercase py-5 rounded-sm transition-all">Escanear máquina</Link>
        <Link href="/ejercito" className="flex items-center justify-center w-full border border-sand/30 hover:border-sand/60 hover:bg-sand/5 active:scale-95 text-sand font-stencil text-base tracking-widest uppercase py-4 rounded-sm transition-all">Ver Ejército</Link>
      </section>
      <footer className="pb-8 text-center">
        <p className="text-sand/40 text-xs tracking-widest uppercase">Comandados por la General La Gorda</p>
      </footer>
    </main>
  )
}
