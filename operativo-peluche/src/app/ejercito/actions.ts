'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addSoldier(
  _prevState: { error: string | null; success: boolean },
  formData: FormData,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.', success: false }

  const nombre = (formData.get('nombre') as string)?.trim()
  const descripcion = (formData.get('descripcion') as string)?.trim()
  if (!nombre || !descripcion) return { error: 'Nombre y descripción son obligatorios.', success: false }

  const rango = (formData.get('rango') as string)?.trim() || null
  const ciudad_rescate = (formData.get('ciudad_rescate') as string)?.trim() || null
  const notas = (formData.get('notas') as string)?.trim() || null
  const tagsRaw = (formData.get('tags') as string)?.trim()
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const admin = createAdminClient()
  const fotosFiles = formData.getAll('fotos_momento') as File[]
  const fotoOficialFile = formData.get('foto_oficial') as File | null
  const fotos_momento: string[] = []
  let foto_oficial_url: string | null = null

  for (const file of fotosFiles) {
    if (!file || file.size === 0) continue
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadError } = await admin.storage.from('soldiers-momento').upload(path, file, { contentType: file.type })
    if (!uploadError) {
      const { data } = admin.storage.from('soldiers-momento').getPublicUrl(path)
      fotos_momento.push(data.publicUrl)
    }
  }

  if (fotoOficialFile && fotoOficialFile.size > 0) {
    const ext = fotoOficialFile.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await admin.storage.from('soldiers-oficial').upload(path, fotoOficialFile, { contentType: fotoOficialFile.type })
    if (!uploadError) {
      const { data } = admin.storage.from('soldiers-oficial').getPublicUrl(path)
      foto_oficial_url = data.publicUrl
    }
  }

  const estado = foto_oficial_url ? 'activo' : 'recluta'
  const { error: insertError } = await admin.from('soldiers').insert({ nombre, descripcion, rango, ciudad_rescate, notas, tags, fotos_momento, foto_oficial_url, estado })
  if (insertError) return { error: 'Error al incorporar el soldado. Intentá de nuevo.', success: false }

  revalidatePath('/ejercito')
  revalidatePath('/')
  return { error: null, success: true }
}
