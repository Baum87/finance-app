'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createBrokerAction } from '@/app/portfolio/_archief-aandelen-etf/actions'

export default function NieuweBrokerPage() {
  const [state, formAction, isPending] = useActionState(createBrokerAction, null)

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link href="/portfolio/aandelen-etf" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Aandelen &amp; ETFs
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Broker toevoegen</h1>
        </div>

        <div className="max-w-md rounded-3xl border border-border bg-card p-8">
          <form action={formAction} className="space-y-6">
            {state?.error && (
              <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
                {state.error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Naam broker <span className="text-terracotta">*</span></Label>
              <Input id="name" name="name" placeholder="DEGIRO" autoFocus />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? 'Opslaan…' : 'Broker toevoegen'}
              </button>
              <Link href="/portfolio/aandelen-etf" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Annuleren
              </Link>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
