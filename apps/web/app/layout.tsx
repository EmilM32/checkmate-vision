import type { Metadata } from "next"
import { Geist_Mono, Outfit } from "next/font/google"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider } from "@/context/i18n-context"
import { getDictionary } from "@/i18n/get-dictionary"
import { resolveRequestLocale } from "@/i18n/resolve-locale"
import { cn } from "@workspace/ui/lib/utils"

export const metadata: Metadata = {
  title: "CheckMate Vision",
  description: "Template scaffold for chess analysis app",
}

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await resolveRequestLocale()
  const dictionary = getDictionary(locale)

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        outfit.variable
      )}
    >
      <body suppressHydrationWarning>
        <I18nProvider locale={locale} dictionary={dictionary}>
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
