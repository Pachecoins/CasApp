import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SoldierCard } from '@/components/SoldierCard'
import { AddSoldierModal } from '@/components/AddSoldierModal'
import type { Soldier } from '@/lib/types'

export default async function EjercitoPage() {
  const supabase = await createClient()
  const { data: soldiers } = await supabase.from('soldiers').select('*').order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-base pb-24">
      <header className="px-5 pt-8 pb-5 flex items-center gap-4">
        <Link href="/" className="text-sand/50 hover:text-sand text-sm transition-colors">← Base</Link>
        <div className="flex-1">
          <h1 className="font-stencil text-bone text-2xl tracking-widest uppercase">El Ejército</h1>
          <p className="text-sand/60 text-xs tracking-widest uppercase mt-0.5">{soldiers?.length ?? 0} efectivos totales</p>
        </div>
      </header>
      {soldiers && soldiers.length > 0 ? (
        <div className="px-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {soldiers.map((soldier: Soldier) => <SoldierCard key={soldier.id} soldier={soldier} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center px-8">
          <span className="text-5xl mb-4">🪖</span>
          <p className="font-stencil text-bone/50 text-lg uppercase tracking-widest">El ejército está vacío</p>
          <p className="text-sand/40 text-sm mt-2">Incorporá tu primer soldado</p>
        </div>
      )}
      <AddSoldierModal />
    </main>
  )
}
