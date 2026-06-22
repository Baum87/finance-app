'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Bell, LogOut, Menu, X, ChevronDown } from 'lucide-react'
import { signOut } from '@/app/(auth)/login/actions'

const portfolioItems = [
  { href: '/portfolio/aandelen-etf',    label: 'Aandelen & ETFs' },
  { href: '/portfolio/crypto',          label: 'Crypto' },
  { href: '/portfolio/spaarrekeningen', label: 'Spaarrekeningen' },
  { href: '/portfolio/vastgoed',        label: 'Vastgoed' },
  { href: '/portfolio/pensioen',        label: 'Pensioen' },
  { href: '/portfolio/vorderingen',     label: 'Vorderingen' },
]

const navItems = [
  { href: '/',          label: 'Overzicht' },
  { href: '/vermogen',  label: 'Vermogen' },
  { href: '/vastgoed',  label: 'Vastgoed' },
  { href: '/cashflow',  label: 'Cashflow' },
  { href: '/schulden',  label: 'Schulden' },
  { href: '/assets',    label: 'Beheer' },
]

function BeleggingenDropdown() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const isActive = pathname.startsWith('/portfolio')

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className={[
          'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        ].join(' ')}
      >
        Portfolio
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 rounded-xl border border-border bg-card shadow-md py-1 z-50">
          {portfolioItems.map(({ href, label }) => {
            const itemActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={[
                  'block px-3 py-2 text-sm transition-colors',
                  itemActive
                    ? 'text-foreground font-medium bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Topbar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="mx-auto max-w-[1200px] h-16 px-8 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="text-sm font-semibold tracking-tight text-foreground">Finance</span>
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.slice(0, 1).map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  pathname === href
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {label}
              </Link>
            ))}

            <BeleggingenDropdown />

            {navItems.slice(1).map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  pathname === href
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {label}
              </Link>
            ))}
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
          <button
            aria-label={isOpen ? 'Menu sluiten' : 'Menu openen'}
            onClick={() => setIsOpen(prev => !prev)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            {isOpen ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {isOpen && (
        <nav className="md:hidden border-t border-border bg-card px-4 py-2">
          {navItems.slice(0, 1).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setIsOpen(false)}
              className={[
                'block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              ].join(' ')}
            >
              {label}
            </Link>
          ))}
          <div className="px-3 py-1 text-xs font-medium text-muted-foreground mt-1">Portfolio</div>
          {portfolioItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setIsOpen(false)}
              className={[
                'block px-5 py-2 rounded-lg text-sm transition-colors',
                pathname === href
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              ].join(' ')}
            >
              {label}
            </Link>
          ))}
          {navItems.slice(1).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setIsOpen(false)}
              className={[
                'block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              ].join(' ')}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
