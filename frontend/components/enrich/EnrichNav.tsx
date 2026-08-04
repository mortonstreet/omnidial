'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Upload, Users, ArrowRight, Settings } from 'lucide-react'

const navItems = [
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/push', label: 'Push', icon: ArrowRight },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function EnrichNav() {
  const pathname = usePathname()

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-6xl flex items-center justify-between px-4 h-14">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-emerald-500">Enrich</span>
          <span className="text-xs text-muted-foreground">by OmniDial</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
