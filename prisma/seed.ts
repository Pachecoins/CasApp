import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const categories = [
  {
    name: 'Jardinería',
    slug: 'jardineria',
    description: 'Corte de pasto, poda de árboles y arbustos, diseño de jardines',
    basePrice: 3500,
    scheduledPrice: 2800,
    iconUrl: '/icons/gardening.svg',
  },
  {
    name: 'Piletas / Piscinas',
    slug: 'piletas',
    description: 'Limpieza, mantenimiento y tratamiento de agua de piletas',
    basePrice: 4500,
    scheduledPrice: 3600,
    iconUrl: '/icons/pool.svg',
  },
  {
    name: 'Limpieza del hogar',
    slug: 'limpieza',
    description: 'Limpieza general, limpieza profunda, limpieza post-obra',
    basePrice: 3000,
    scheduledPrice: 2400,
    iconUrl: '/icons/cleaning.svg',
  },
  {
    name: 'Plomería',
    slug: 'plomeria',
    description: 'Reparación de cañerías, instalaciones sanitarias',
    basePrice: 5000,
    scheduledPrice: 4000,
    iconUrl: '/icons/plumbing.svg',
  },
  {
    name: 'Electricidad',
    slug: 'electricidad',
    description: 'Instalaciones eléctricas, reparaciones, tableros',
    basePrice: 5500,
    scheduledPrice: 4400,
    iconUrl: '/icons/electricity.svg',
  },
  {
    name: 'Pintura',
    slug: 'pintura',
    description: 'Pintura interior y exterior, empapelado',
    basePrice: 4000,
    scheduledPrice: 3200,
    iconUrl: '/icons/painting.svg',
  },
  {
    name: 'Carpintería',
    slug: 'carpinteria',
    description: 'Muebles a medida, reparaciones, instalación de aberturas',
    basePrice: 4500,
    scheduledPrice: 3600,
    iconUrl: '/icons/carpentry.svg',
  },
  {
    name: 'Control de plagas',
    slug: 'plagas',
    description: 'Fumigación, control de insectos y roedores',
    basePrice: 6000,
    scheduledPrice: 4800,
    iconUrl: '/icons/pest-control.svg',
  },
  {
    name: 'Aire acondicionado',
    slug: 'aire-acondicionado',
    description: 'Instalación, mantenimiento y reparación de aires acondicionados',
    basePrice: 5500,
    scheduledPrice: 4400,
    iconUrl: '/icons/ac.svg',
  },
]

async function main() {
  console.log('🌱 Seeding database...')

  for (const category of categories) {
    await prisma.serviceCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    })
  }

  console.log(`✅ Created ${categories.length} service categories`)
  console.log('🎉 Seed complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
