import type { Metadata } from "next"
import { Cormorant_Garamond, DM_Sans } from "next/font/google"
import "./globals.css"
import Provider from "@/components/session-provider"

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
})

export const metadata: Metadata = {
  title: "My Dashboard",
  description: "Personal tools dashboard",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable}`}>
      <body className="antialiased">
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
