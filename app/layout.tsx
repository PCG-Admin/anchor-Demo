import type React from "react"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { ConditionalNav } from "@/components/conditional-nav"
import { Toaster } from "@/components/ui/toaster"
import type { Metadata } from "next"
import { AuthProvider } from "@/contexts/auth-context"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Invoices - Professional Time & Billing Management",
  description: "Modern accounting practice management system",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-gradient-to-br from-slate-50 via-[#e8eef5] to-[#dce6f0] min-h-screen">
        <AuthProvider>
          <ConditionalNav />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
