'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

type Props = {
  netWorthStr: string
  deltaStr: string | null
  deltaPositive: boolean
  illiquidStr: string | null
  illiquidLabel: string
  liabilitiesStr: string | null
  realEstateStr: string | null
}

const MASK = '•••••'

export function NetWorthAmount({
  netWorthStr, deltaStr, deltaPositive, illiquidStr, illiquidLabel, liabilitiesStr, realEstateStr,
}: Props) {
  const [hidden, setHidden] = useState(false)

  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">Netto vermogen</p>
        <button
          type="button"
          onClick={() => setHidden(!hidden)}
          aria-label={hidden ? 'Bedrag tonen' : 'Bedrag verbergen'}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <p className="mt-1 text-3xl font-semibold text-foreground">
        {hidden ? MASK : netWorthStr}
      </p>
      {deltaStr && (
        <p className={`mt-0.5 text-sm font-medium ${deltaPositive ? 'text-sage' : 'text-terracotta'}`}>
          {hidden ? MASK : deltaStr} afgelopen 30 dagen
        </p>
      )}
      {illiquidStr && (
        <p className="mt-0.5 text-sm text-muted-foreground">
          waarvan {hidden ? MASK : illiquidStr} illiquide ({illiquidLabel})
        </p>
      )}
      {liabilitiesStr && (
        <p className="mt-0.5 text-sm text-muted-foreground">
          waarvan −{hidden ? MASK : liabilitiesStr} schulden (<Link href="/schulden" className="underline hover:opacity-70">bekijk</Link>)
        </p>
      )}
      {realEstateStr && (
        <p className="mt-0.5 text-sm text-muted-foreground">
          Vastgoed apart: {hidden ? MASK : realEstateStr} (niet meegeteld in netto vermogen)
        </p>
      )}
    </div>
  )
}
