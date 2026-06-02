'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { addSoldier } from '@/app/ejercito/actions'
import { Button } from './ui/Button'

const initialState = { error: null as string | null, success: false }

export function AddSoldierModal() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(addSoldier, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) { setOpen(false); formRef.current?.reset() }
  }, [state.success])

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-military hover:bg-military/80 active:scale-95 text-bone font-stencil text-sm tracking-widest uppercase px-5 py-3 rounded-sm shadow-lg transition-all">
        + Agregar soldado
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="bg-[#141414] border border-white/10 rounded-sm w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="font-stencil text-bone text-lg tracking-widest uppercase">Nuevo recluta</h2>
              <button onClick={() => setOpen(false)} className="text-sand/50 hover:text-sand text-xl leading-none">×</button>
            </div>
            <form ref={formRef} action={action} className="p-5 space-y-4">
              <Field label="Nombre *" name="nombre" required />
              <Field label="Rango" name="rango" placeholder="Ej: Cabo, Sargento, Teniente" />
              <Field label="Ciudad de rescate" name="ciudad_rescate" placeholder="Ej: Buenos Aires" />
              <Field label="Descripción *" name="descripcion" required textarea placeholder="Ej: oso panda blanco y negro mediano con moño rojo" />
              <Field label="Tags" name="tags" placeholder="Ej: oso, rosado, mediano, kawaii" />
              <Field label="Notas" name="notas" textarea />
              <div>
                <label className="block text-sand text-xs tracking-widest uppercase mb-2">Fotos del rescate</label>
                <input type="file" name="fotos_momento" multiple accept="image/*" capture="environment"
                  className="w-full text-bone/60 text-sm file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-military/40 file:text-bone file:text-xs file:uppercase file:tracking-widest file:cursor-pointer" />
              </div>
              <div>
                <label className="block text-sand text-xs tracking-widest uppercase mb-2">Foto oficial <span className="text-sand/40 normal-case">(opcional)</span></label>
                <input type="file" name="foto_oficial" accept="image/*"
                  className="w-full text-bone/60 text-sm file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-military/40 file:text-bone file:text-xs file:uppercase file:tracking-widest file:cursor-pointer" />
              </div>
              {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1">Cancelar</Button>
                <Button type="submit" disabled={pending} className="flex-1">{pending ? 'Incorporando...' : 'Incorporar al ejército'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, name, required, placeholder, textarea }: { label: string; name: string; required?: boolean; placeholder?: string; textarea?: boolean }) {
  const base = 'w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2.5 text-bone text-sm placeholder-bone/30 focus:outline-none focus:border-sand/50 transition-colors'
  return (
    <div>
      <label className="block text-sand text-xs tracking-widest uppercase mb-1.5">{label}</label>
      {textarea
        ? <textarea name={name} required={required} placeholder={placeholder} rows={3} className={`${base} resize-none`} />
        : <input type="text" name={name} required={required} placeholder={placeholder} className={base} />}
    </div>
  )
}
