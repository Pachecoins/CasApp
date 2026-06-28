import { prisma } from '../config/prisma.js'

export async function listCourses(workerUserId?: string) {
  const courses = await prisma.course.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!workerUserId) return courses.map((c) => ({ ...c, isFreeForMe: false, enrollment: null }))

  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) return courses.map((c) => ({ ...c, isFreeForMe: false, enrollment: null }))

  const enrollments = await prisma.courseEnrollment.findMany({ where: { workerId: worker.id } })
  const byCourseId = new Map(enrollments.map((e) => [e.courseId, e]))

  return courses.map((c) => ({
    ...c,
    isFreeForMe: c.freeAboveRating != null && worker.rating >= c.freeAboveRating,
    enrollment: byCourseId.get(c.id) ?? null,
  }))
}

export async function enroll(workerUserId: string, courseId: string) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  const course = await prisma.course.findUnique({ where: { id: courseId } })
  if (!course || !course.isActive) throw new Error('Curso no disponible')

  const existing = await prisma.courseEnrollment.findUnique({
    where: { courseId_workerId: { courseId, workerId: worker.id } },
  })
  if (existing) throw new Error('Ya estás inscripto en este curso')

  const isFree = course.priceCents === 0 || (course.freeAboveRating != null && worker.rating >= course.freeAboveRating)

  return prisma.courseEnrollment.create({
    data: {
      courseId,
      workerId: worker.id,
      isFree,
      status: isFree ? 'ACTIVE' : 'PENDING',
      paymentStatus: isFree ? 'RELEASED' : 'PENDING',
    },
    include: { course: true },
  })
}

export async function getMyEnrollments(workerUserId: string) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  return prisma.courseEnrollment.findMany({
    where: { workerId: worker.id },
    include: { course: true },
    orderBy: { createdAt: 'desc' },
  })
}
