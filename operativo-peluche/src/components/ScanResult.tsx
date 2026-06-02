import Image from 'next/image'
import Link from 'next/link'
import type { Soldier } from '@/lib/types'
import { Badge } from './ui/Badge'

type NuevoRecluta = { descripcion: string; tags: string[] }

type ScanResultProps = {
  yaEnEjercito: Soldier[]
  nuevosPosibles: NuevoRecluta[]
  onRescan: () => void
}

export function ScanResult({ yaEnEjercito, nuevosPosibles, onRescan }: ScanResultProps) {
  const totalDetectados = yaEnEjercito.length + nuevosPosibles.length

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="text-center py-4">
        <p className="text-sand/60 text-xs tracking-widest uppercase">
          {totalDetectados} peluche{totalDetectados !== 1 ? 's' : ''} detectado{totalDetectados !== 1 ? 's' : ''}
        </p>
      </div>

      {yaEnEjercito.length > 0 && (
        <section>
          <div className="flex items-center gap-3 px-5 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
            <div>
              <p className="font-stencil text-bone text-sm uppercase tracking-widest">Ya en el ejército</p>
              <p className="text-red-400/70 text-xs">No los rescates.</p>
            </div>
          </div>
          <div className="px-4 space-y-2">
            {yaEnEjercito.map((soldier) => (
              <Link key={soldier.id} href={`/soldado/${soldier.id}`}
                className="flex items-center gap-3 bg-red-950/20 border border-red-900/30 rounded-sm p-3">
                <div className="w-14 h-14 relative flex-shrink-0 rounded-sm overflow-hidden bg-military/20">
                  {soldier.foto_oficial_url
                    ? <Image src={soldier.foto_oficial_url} alt={soldier.nombre} fill className="object-cover" />
                    : <div className="absolute inset-0 flex items-center justify-center text-2xl">🪖</div>}
                </div>
                <div className="min-w-0">
                  <p className="font-stencil text-bone text-sm uppercase tracking-wide truncate">{soldier.nombre}</p>
                  {soldier.rango && <p className="text-sand/60 text-xs uppercase tracking-widest truncate">{soldier.rango}</p>}
                  {soldier.ciudad_rescate && <p className="text-bone/40 text-xs truncate">{soldier.ciudad_rescate}</p>}
                </div>
                <Badge label="duplicado" variant="recluta" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {nuevosPosibles.length > 0 && (
        <section>
          <div className="flex items-center gap-3 px-5 mb-3">
            <div className="w-3 h-3 rounded-full bg-military flex-shrink-0" style={{backgroundColor:'#3d4a2a'}} />
            <div>
              <p className="font-stencil text-bone text-sm uppercase tracking-widest">Posibles reclutas</p>
              <p className="text-xs" style={{color:'#8aad6e'}}>Dale, son nuevos.</p>
            </div>
          </div>
          <div className="px-4 space-y-2">
            {nuevosPosibles.map((recluta, i) => (
              <div key={i} className="bg-military/10 border border-military/30 rounded-sm p-3">
                <p className="text-bone/80 text-sm leading-relaxed">{recluta.descripcion}</p>
                {recluta.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {recluta.tags.map((tag) => <Badge key={tag} label={tag} variant="tag" />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {totalDetectados === 0 && (
        <div className="text-center py-10 px-8">
          <span className="text-4xl">🔍</span>
          <p className="font-stencil text-bone/50 text-lg uppercase tracking-widest mt-3">Sin resultados</p>
          <p className="text-sand/40 text-sm mt-2">No se detectaron peluches en la imagen.</p>
        </div>
      )}

      <div className="px-5 space-y-3 mt-2">
        <button onClick={onRescan}
          className="w-full bg-military hover:bg-military/80 active:scale-95 text-bone font-stencil tracking-widest uppercase py-4 rounded-sm transition-all text-sm">
          Escanear otra
        </button>
        <Link href="/"
          className="flex items-center justify-center w-full border border-sand/20 hover:border-sand/40 text-sand/70 font-stencil tracking-widest uppercase py-3 rounded-sm transition-all text-xs">
          Volver a base
        </Link>
      </div>
    </div>
  )
}
