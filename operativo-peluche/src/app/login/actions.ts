'use server'

import { createClient } from '@/lib/supabase/server'

export async function sendMagicLink(
  _prevState: { error: string | null; success: boolean },
  formData: FormData,
) {
  const email = (formData.get('email') as string)?.toLowerCase().trim()
  if (!email) return { error: 'Ingresá tu email.', success: false }

  const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  if (!allowed.includes(email)) return { error: 'Acceso no autorizado.', success: false }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback` },
  })

  if (error) return { error: 'Error al enviar el link. Intentá de nuevo.', success: false }
  return { error: null, success: true }
}
