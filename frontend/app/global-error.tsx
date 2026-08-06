'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">
        <main className="grid min-h-screen place-items-center px-6">
          <section className="w-full max-w-md border border-border bg-card p-8">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The error has been reported. You can try loading the page again.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 h-11 border border-border bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
