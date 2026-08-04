import { EnrichNav } from '@/components/enrich/EnrichNav'
import { headers } from 'next/headers'

export default async function EnrichLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const pathname = headersList.get('x-next-url') || headersList.get('x-invoke-path') || ''
  const isLandingPage = pathname === '/' || pathname === ''

  return (
    <div className="min-h-screen bg-background">
      {!isLandingPage && <EnrichNav />}
      {isLandingPage ? (
        children
      ) : (
        <main className="container mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
      )}
    </div>
  )
}
