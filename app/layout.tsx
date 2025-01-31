import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Image from 'next/image'

const inter = Inter({ subsets: ['latin'] })

// add favicon using the image server-icon-512.png

export const metadata: Metadata = {
  title: 'Sharkcicle Minecraft Server',
  description: 'Join our thriving Minecraft community!',
}
// Hello
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      
      <body className={`${inter.className} bg-[#1A1C1E]`}>
        {/* Header with Logo */}
              <header className="container mx-auto pt-8 pb-4 px-4 bg-[#1A1C1E]">
                <div className="flex justify-center">
                  <Image
                    src="/server-icon-512.png"
                    alt="Server Logo"
                    width={400}
                    height={120}
                    className="h-[120px] w-auto"
                    priority
                  />
                </div>
              </header>
        {children}
        </body>
    </html>
  )
}

