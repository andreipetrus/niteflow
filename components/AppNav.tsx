'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Moon, Settings, Upload } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/sleep', label: 'Sleep', icon: Moon },
  { href: '/correlations', label: 'Correlations', icon: BarChart3 },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-4 w-56 border-r border-border min-h-screen">
      <div className="mb-6 px-2">
        <span className="text-lg font-semibold tracking-tight">Niteflow</span>
      </div>
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
