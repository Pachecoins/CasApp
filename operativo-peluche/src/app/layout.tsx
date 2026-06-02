import type { Metadata, Viewport } from 'next'
import { Inter, Stardos_Stencil } from 'next/font/google'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const stardosStencil = Stardos_Stencil({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-stardos' })

export const metadata: Metadata = {
  title: 'Operativo Peluche',
  description: 'Ejército de peluches rescatados de máquinas garra',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#0e0e0e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${stardosStencil.variable}`}>
      <body className="min-h-screen bg-base text-bone antialiased">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  )
}
