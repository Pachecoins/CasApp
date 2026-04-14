import { PrismaClient, EquipmentTier } from '@prisma/client'

const prisma = new PrismaClient()

// ─── MVP SERVICE CATEGORIES ───────────────────────────────────────────────────
// Strict MVP scope: Jardinería + Piletas/Piscinas only.
// Prices in ARS. Premium tier is ~40% higher per the product spec.
// addonDefinitions drive the interactive quoter UI.

const categories = [
  {
    name: 'Jardinería',
    slug: 'jardineria',
    description: 'Corte de pasto, poda, canteros, yuyos y recolección de hojas',
    iconUrl: '/icons/gardening.svg',
    // STANDARD base price for a SMALL lot (~100 m²)
    basePriceStandard: 4500,
    // PREMIUM base price for a SMALL lot (advanced machinery)
    basePricePremium: 7200,
    // Additional cost per m² beyond the SMALL threshold (100 m²)
    pricePerM2Standard: 18,
    pricePerM2Premium: 30,
    addonDefinitions: JSON.stringify([
      {
        key: 'tall_grass',
        label: 'Pasto muy crecido',
        description: 'Pasto de más de 15 cm de altura',
        surchargeType: 'percent',
        value: 20,
      },
      {
        key: 'remove_weeds',
        label: 'Sacar yuyos / malezas',
        description: 'Extracción manual de malezas de canteros',
        surchargeType: 'flat',
        value: 1500,
      },
      {
        key: 'leaf_collection',
        label: 'Recolección de hojas',
        description: 'Barrido y embolsado de hojas secas',
        surchargeType: 'flat',
        value: 1000,
      },
      {
        key: 'hedge_trimming',
        label: 'Poda de arbustos / canteros',
        description: 'Recorte y forma de setos y arbustos bajos',
        surchargeType: 'flat',
        value: 2000,
      },
      {
        key: 'sweep_paths',
        label: 'Barrido de senderos y accesos',
        description: 'Limpieza de caminos, entradas y patios',
        surchargeType: 'flat',
        value: 800,
      },
    ]),
  },
  {
    name: 'Piletas / Piscinas',
    slug: 'piletas',
    description: 'Limpieza, mantenimiento y tratamiento químico de piletas',
    iconUrl: '/icons/pool.svg',
    basePriceStandard: 5500,
    basePricePremium: 8500,
    // Pool size beyond "small" is measured by volume/surface — m² of water surface
    pricePerM2Standard: 40,
    pricePerM2Premium: 65,
    addonDefinitions: JSON.stringify([
      {
        key: 'chemical_treatment',
        label: 'Tratamiento químico completo',
        description: 'Análisis y corrección de pH, cloro y alcalinidad',
        surchargeType: 'flat',
        value: 3000,
      },
      {
        key: 'algae_removal',
        label: 'Eliminación de algas',
        description: 'Cepillado de paredes y tratamiento antialgas',
        surchargeType: 'flat',
        value: 2500,
      },
      {
        key: 'filter_cleaning',
        label: 'Limpieza de filtros',
        description: 'Desmontaje, limpieza y rearme del sistema de filtrado',
        surchargeType: 'flat',
        value: 1800,
      },
      {
        key: 'vacuum',
        label: 'Aspirado de fondo',
        description: 'Aspirado manual completo del fondo de la pileta',
        surchargeType: 'flat',
        value: 1200,
      },
    ]),
  },
]

// ─── SEED WORKERS (dev/test only) ─────────────────────────────────────────────

async function seedDemoWorkers(categoryMap: Record<string, string>) {
  const demoWorkers = [
    {
      email: 'juan.jardinero@tuki.app',
      firstName: 'Juan',
      lastName: 'Ramírez',
      categorySlug: 'jardineria',
      tier: EquipmentTier.STANDARD,
      bio: 'Jardinero con 5 años de experiencia en jardines residenciales.',
      isVerified: true,
      identityVerified: true,
    },
    {
      email: 'carlos.premiun@tuki.app',
      firstName: 'Carlos',
      lastName: 'Mendoza',
      categorySlug: 'jardineria',
      tier: EquipmentTier.PREMIUM,
      bio: 'Jardinería profesional con tractor y robot cortacésped.',
      isVerified: true,
      identityVerified: true,
      insuranceVerified: true,
    },
    {
      email: 'maria.piletas@tuki.app',
      firstName: 'María',
      lastName: 'González',
      categorySlug: 'piletas',
      tier: EquipmentTier.STANDARD,
      bio: 'Técnica en mantenimiento de piletas y tratamiento del agua.',
      isVerified: true,
      identityVerified: true,
      insuranceVerified: true,
    },
  ]

  for (const w of demoWorkers) {
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash('Tuki1234!', 10)

    const user = await prisma.user.upsert({
      where: { email: w.email },
      update: {},
      create: {
        email: w.email,
        passwordHash,
        firstName: w.firstName,
        lastName: w.lastName,
        role: 'WORKER',
        workerProfile: {
          create: {
            bio: w.bio,
            isAvailable: true,
            isVerified: w.isVerified ?? false,
            identityVerified: w.identityVerified ?? false,
            insuranceVerified: w.insuranceVerified ?? false,
            currentLatitude: -34.6037 + (Math.random() - 0.5) * 0.1,
            currentLongitude: -58.3816 + (Math.random() - 0.5) * 0.1,
            workerServices: {
              create: {
                categoryId: categoryMap[w.categorySlug],
                equipmentTier: w.tier,
                yearsExperience: 3,
              },
            },
          },
        },
      },
    })

    console.log(`  Worker created: ${user.firstName} ${user.lastName} (${w.categorySlug} / ${w.tier})`)
  }
}

async function main() {
  console.log('🌱 Seeding TUKI MVP database...')

  // 1. Upsert categories
  const categoryMap: Record<string, string> = {}

  for (const cat of categories) {
    const record = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        iconUrl: cat.iconUrl,
        basePriceStandard: cat.basePriceStandard,
        basePricePremium: cat.basePricePremium,
        pricePerM2Standard: cat.pricePerM2Standard,
        pricePerM2Premium: cat.pricePerM2Premium,
        addonDefinitions: cat.addonDefinitions,
      },
      create: cat,
    })
    categoryMap[cat.slug] = record.id
    console.log(`  Category: ${record.name} (id: ${record.id})`)
  }

  console.log(`✅ ${categories.length} service categories seeded`)

  // 2. Seed demo workers (skip in production)
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n🔧 Seeding demo workers...')
    await seedDemoWorkers(categoryMap)
    console.log('✅ Demo workers seeded')
  }

  console.log('\n🎉 Seed complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
