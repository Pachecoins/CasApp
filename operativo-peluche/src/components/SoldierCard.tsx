import Image from 'next/image'
import Link from 'next/link'
import type { Soldier } from '@/lib/types'
import { Badge } from './ui/Badge'

export function SoldierCard({ soldier }: { soldier: Soldier }) {
  return (
    <Link href={`/soldado/${soldier.id}`} className="group block bg-white/4 border border-white/8 rounded-sm overflow-hidden hover:border-sand/30 transition-colors">
      <div className="aspect-square relative bg-military/20">
        {soldier.foto_oficial_url ? (
          <Image src={soldier.foto_oficial_url} alt={soldier.nombre} fill className="object-cover" sizes="(max-width: 768px) 50vw, 33vw" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-sand/30">
            <span className="text-4xl">🪖</span>
            <span className="text-xs uppercase tracking-widest mt-2">Recluta</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge label={soldier.estado} variant={soldier.estado as 'recluta' | 'activo' | 'donado'} />
        </div>
      </div>
      <div className="p-3">
        <p className="font-stencil text-bone text-sm uppercase tracking-wide truncate">{soldier.nombre}</p>
        {soldier.rango && <p className="text-sand/70 text-xs uppercase tracking-widest truncate mt-0.5">{soldier.rango}</p>}
        {soldier.ciudad_rescate && <p className="text-bone/40 text-xs truncate mt-1">{soldier.ciudad_rescate}</p>}
      </div>
    </Link>
  )
}
