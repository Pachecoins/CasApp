import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { getNearbyWorkers } from './workers.service.js'

interface AnalyzeParams {
  description: string
  latitude?: number
  longitude?: number
}

interface AnalysisResult {
  problem: string
  solution: string
  categorySlug: string | null
}

// Heurística simple por palabras clave — se usa si no hay OPENAI_API_KEY configurada,
// así el asistente funciona desde el día 1 sin depender de un servicio externo.
const KEYWORD_RULES: { slug: string; keywords: string[] }[] = [
  { slug: 'jardineria', keywords: ['pasto', 'césped', 'cesped', 'jardín', 'jardin', 'planta', 'poda', 'arbol', 'árbol', 'hojas'] },
  { slug: 'piletas', keywords: ['pileta', 'piscina', 'agua verde', 'cloro', 'filtro de agua'] },
  { slug: 'pintura', keywords: ['pintar', 'pintura', 'pared', 'descascar'] },
  { slug: 'limpieza-de-vidrios', keywords: ['vidrio', 'ventana', 'cristal'] },
]

function heuristicAnalyze(description: string): AnalysisResult {
  const text = description.toLowerCase()
  const match = KEYWORD_RULES.find((rule) => rule.keywords.some((kw) => text.includes(kw)))

  return {
    problem: description.trim(),
    solution: match
      ? 'Según lo que describís, esto lo resuelve un especialista en la categoría que te recomendamos abajo. Pedí el servicio y un Tuki calificado se va a encargar.'
      : 'No pudimos identificar automáticamente la categoría exacta. Contanos un poco más o elegí manualmente el servicio que necesitás desde el inicio.',
    categorySlug: match?.slug ?? null,
  }
}

async function aiAnalyze(description: string, categorySlugs: string[]): Promise<AnalysisResult> {
  const prompt = `Sos "Tuki", el asistente con forma de tucán de una app de servicios del hogar en Argentina.
Un usuario describe un problema en su casa. Tu trabajo:
1. Resumir el problema en una oración clara.
2. Proponer una solución breve y concreta.
3. Elegir la categoría de servicio más adecuada de esta lista (o null si ninguna aplica): ${categorySlugs.join(', ')}.

Respondé SOLO con JSON válido: {"problem": "...", "solution": "...", "categorySlug": "slug-o-null"}

Descripción del usuario: """${description}"""`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  })

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)

  const data = await response.json()
  const parsed = JSON.parse(data.choices[0].message.content)

  return {
    problem: parsed.problem ?? description,
    solution: parsed.solution ?? '',
    categorySlug: categorySlugs.includes(parsed.categorySlug) ? parsed.categorySlug : null,
  }
}

export async function analyzeAndRecommend(params: AnalyzeParams) {
  const { description, latitude, longitude } = params

  const categories = await prisma.serviceCategory.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true },
  })
  const categorySlugs = categories.map((c) => c.slug)

  const analysis = env.OPENAI_API_KEY
    ? await aiAnalyze(description, categorySlugs).catch(() => heuristicAnalyze(description))
    : heuristicAnalyze(description)

  const category = categories.find((c) => c.slug === analysis.categorySlug) ?? null

  let recommendedWorkers: Awaited<ReturnType<typeof getNearbyWorkers>> = []
  if (category && latitude != null && longitude != null) {
    recommendedWorkers = await getNearbyWorkers({
      lat: latitude,
      lng: longitude,
      categoryId: category.id,
      limit: 3,
    })
  }

  return {
    analysis: { problem: analysis.problem, solution: analysis.solution },
    category,
    recommendedWorkers,
  }
}
