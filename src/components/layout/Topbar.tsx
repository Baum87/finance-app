'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, LogOut } from 'lucide-react'
import { signOut } from '@/app/login/actions'

const navItems = [
  { href: '/',          label: 'Overzicht' },
  { href: '/vermogen',  label: 'Vermogen' },
  { href: '/vastgoed',  label: 'Vastgoed' },
  { href: '/cashflow',  label: 'Cashflow' },
]

export function Topbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 h-16 bg-card border-b border-border">
      <div className="mx-auto max-w-[1200px] h-full px-8 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="text-sm font-semibold tracking-tight text-foreground">Finance</span>
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map(({ href, label }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  ].join(' ')}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <button
            aria-label="Notificaties"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <Bell size={15} />
          </button>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Uitloggen"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
