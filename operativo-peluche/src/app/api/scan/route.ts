import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Soldier } from '@/lib/types'

const PROMPT = (inventario: { id: string; nombre: string; descripcion: string }[]) => `
Sos un asistente de identificación de peluches para "Operativo Peluche".
Te paso una foto de una máquina garra (claw machine) con peluches adentro,
y un inventario JSON de peluches que ya tengo rescatados.

INVENTARIO ACTUAL:
${JSON.stringify(inventario)}

TAREA:
1. Identificá cada peluche visible en la foto. Sé específico:
   tipo de animal/personaje, color, estilo, tamaño aparente, detalles distintivos.
2. Para cada uno, decidí si coincide con algún item del inventario.
   El matching es por MODELO (mismo tipo de peluche), no por unidad física.
3. Devolvé EXCLUSIVAMENTE JSON válido, sin texto adicional, sin markdown,
   con esta estructura:

{
  "detectados": [
    {
      "descripcion": "oso panda blanco y negro mediano con moño rojo",
      "match_inventario_id": "uuid-o-null",
      "confianza": "alta"
    }
  ],
  "ya_tengo": [
    { "id": "uuid", "nombre": "Toby" }
  ],
  "nuevos_posibles": [
    {
      "descripcion": "dinosaurio verde tipo dragón, chico, ojos saltones",
      "tags": ["dinosaurio", "verde", "chico"]
    }
  ]
}

Si la confianza es "baja", incluí el peluche en "nuevos_posibles".
`

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  let foto: File
  let ciudad: string | null = null

  try {
    const formData = await request.formData()
    foto = formData.get('foto') as File
    ciudad = (formData.get('ciudad') as string) || null
    if (!foto || foto.size === 0) {
      return Response.json({ error: 'No se recibió foto' }, { status: 400 })
    }
  } catch {
    return Response.json({ error: 'Request inválido' }, { status: 400 })
  }

  const { data: inventario } = await supabase
    .from('soldiers')
    .select('id, nombre, descripcion')
    .neq('estado', 'donado')

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseMimeType: 'application/json' },
  })

  const arrayBuffer = await foto.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  let geminiResult: {
    detectados: { descripcion: string; match_inventario_id: string | null; confianza: string }[]
    ya_tengo: { id: string; nombre: string }[]
    nuevos_posibles: { descripcion: string; tags: string[] }[]
  }

  try {
    const result = await model.generateContent([
      PROMPT(inventario ?? []),
      { inlineData: { data: base64, mimeType: foto.type || 'image/jpeg' } },
    ])
    geminiResult = JSON.parse(result.response.text())
  } catch {
    return Response.json({ error: 'Error al analizar la imagen. Intentá de nuevo.' }, { status: 500 })
  }

  const yaIds = geminiResult.ya_tengo.map((s) => s.id).filter(Boolean)
  let soldadosCompletos: Soldier[] = []
  if (yaIds.length > 0) {
    const { data } = await supabase.from('soldiers').select('*').in('id', yaIds)
    soldadosCompletos = (data as Soldier[]) ?? []
  }

  await supabase.from('scans').insert({
    foto_url: '',
    ciudad,
    resultado: geminiResult,
  })

  return Response.json({
    detectados: geminiResult.detectados,
    ya_tengo: soldadosCompletos,
    nuevos_posibles: geminiResult.nuevos_posibles,
  })
}
