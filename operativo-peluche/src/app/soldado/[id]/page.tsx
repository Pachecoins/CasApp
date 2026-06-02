import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import type { Soldier } from '@/lib/types'

export default async function SoldierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: soldier } = await supabase.from('soldiers').select('*').eq('id', id).single<Soldier>()
  if (!soldier) notFound()

  const formattedDate = new Date(soldier.fecha_rescate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <main className="min-h-screen bg-base pb-10">
      <div className="px-5 pt-6 pb-2">
        <Link href="/ejercito" className="text-sand/50 hover:text-sand text-sm transition-colors">← Ejército</Link>
      </div>
      <div className="relative w-full aspect-square bg-military/20">
        {soldier.foto_oficial_url ? (
          <Image src={soldier.foto_oficial_url} alt={soldier.nombre} fill className="object-cover" priority />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-sand/30">
            <span className="text-7xl">🪖</span>
            <span className="text-sm uppercase tracking-widest mt-3">Sin foto oficial</span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <Badge label={soldier.estado} variant={soldier.estado as 'recluta' | 'activo' | 'donado'} />
        </div>
      </div>
      <div className="px-5 py-6 space-y-6">
        <div>
          <h1 className="font-stencil text-bone text-3xl uppercase tracking-wide leading-tight">{soldier.nombre}</h1>
          {soldier.rango && <p className="text-sand text-sm uppercase tracking-widest mt-1">{soldier.rango}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {soldier.ciudad_rescate && <DetailItem label="Ciudad de rescate" value={soldier.ciudad_rescate} />}
          <DetailItem label="Incorporado" value={formattedDate} />
        </div>
        <div>
          <p className="text-sand text-xs tracking-widest uppercase mb-1">Descripción</p>
          <p className="text-bone/80 text-sm leading-relaxed">{soldier.descripcion}</p>
        </div>
        {soldier.tags.length > 0 && (
          <div>
            <p className="text-sand text-xs tracking-widest uppercase mb-2">Clasificación</p>
            <div className="flex flex-wrap gap-1.5">
              {soldier.tags.map((tag) => <Badge key={tag} label={tag} variant="tag" />)}
            </div>
          </div>
        )}
        {soldier.notas && (
          <div>
            <p className="text-sand text-xs tracking-widest uppercase mb-1">Notas de campo</p>
            <p className="text-bone/70 text-sm leading-relaxed italic">{soldier.notas}</p>
          </div>
        )}
        {soldier.fotos_momento.length > 0 && (
          <div>
            <p className="text-sand text-xs tracking-widest uppercase mb-2">Fotos del rescate</p>
            <div className="grid grid-cols-3 gap-1.5">
              {soldier.fotos_momento.map((url, i) => (
                <div key={i} className="aspect-square relative rounded-sm overflow-hidden bg-military/20">
                  <Image src={url} alt={`Foto rescate ${i + 1}`} fill className="object-cover" sizes="33vw" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sand/60 text-xs uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-bone text-sm">{value}</p>
    </div>
  )
}
