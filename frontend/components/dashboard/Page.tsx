type PageProps = {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function Page({ title, subtitle, children }: PageProps) {
  return (
    <div className="mx-auto w-full max-w-7xl py-2 sm:py-4">
      <header className="mb-4 sm:mb-6">
        <h1 className="font-display font-semibold text-2xl md:text-3xl tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
      </header>

      <section>
        {children}
      </section>
    </div>
  )
}
