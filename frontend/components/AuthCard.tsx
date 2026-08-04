"use client"

import { cn } from "@/lib/utils"
import { OmniDialLogoStatic } from "@/components/landing/OmniDialLogo"

type Size = "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl"

const sizeClass: Record<Size, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
}

export default function AuthCard({
  title,
  subtitle,
  children,
  size = "md",
  className = "",
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  size?: Size
  className?: string
}) {
  const marketingHref = process.env.NEXT_PUBLIC_MARKETING_URL || "/"

  return (
    <div className="min-h-screen w-full flex flex-col">
      {/* Header with logo */}
      <header className="p-6">
        <a href={marketingHref} className="inline-flex items-center gap-2.5">
          <OmniDialLogoStatic size={32} color="currentColor" className="text-foreground" />
          <span className="font-medium text-lg tracking-tight text-foreground">OmniDial</span>
        </a>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className={cn("w-full", sizeClass[size], className)}>
          {/* Title section */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-medium text-foreground tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-muted-foreground font-light">
                {subtitle}
              </p>
            )}
          </div>

          {/* Card container */}
          <div className="rounded-2xl border border-border bg-card/50 p-6 md:p-8">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} OmniDial. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
