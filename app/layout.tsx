import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from 'next-themes' // Importamos el proveedor

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'E-Learning AI',
  description: 'Plataforma de aprendizaje potenciada por IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Envolvemos la app con el ThemeProvider */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}