'use client'

import { useActionState } from 'react'
import { sendMagicLink } from './actions'

const initialState = { error: null as string | null, success: false }

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendMagicLink, initialState)

  return (
    <main className="min-h-screen bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-sand text-xs tracking-[0.3em] uppercase mb-2">Bienvenido al</p>
          <h1 className="font-stencil text-bone text-4xl tracking-wider uppercase leading-tight">Operativo<br />Peluche</h1>
          <p className="text-sand/60 text-xs mt-3 tracking-widest uppercase">Acceso restringido</p>
        </div>
        {state.success ? (
          <div className="bg-military/30 border border-military rounded-sm p-5 text-center">
            <p className="text-bone text-sm leading-relaxed">Link de acceso enviado.<br />Revisá tu email.</p>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <div>
              <label className="block text-sand text-xs tracking-widest uppercase mb-2">Email</label>
              <input type="email" name="email" required autoComplete="email"
                className="w-full bg-white/5 border border-white/15 rounded-sm px-4 py-3 text-bone placeholder-bone/30 text-sm focus:outline-none focus:border-sand transition-colors"
                placeholder="tu@email.com" />
            </div>
            {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
            <button type="submit" disabled={pending}
              className="w-full bg-military hover:bg-military/80 disabled:opacity-50 text-bone font-stencil tracking-widest uppercase py-3 rounded-sm transition-colors text-sm">
              {pending ? 'Enviando...' : 'Solicitar acceso'}
            </button>
          </form>
        )}
        <p className="text-center text-sand/40 text-xs mt-8 tracking-widest uppercase">Comandados por la General La Gorda</p>
      </div>
    </main>
  )
}
