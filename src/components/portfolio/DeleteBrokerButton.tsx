'use client'

import { deleteBrokerAction } from '@/app/portfolio/aandelen-etf/actions'

export function DeleteBrokerButton({ brokerId, brokerName }: { brokerId: string; brokerName: string }) {
  return (
    <form action={deleteBrokerAction}>
      <input type="hidden" name="brokerId" value={brokerId} />
      <button
        type="submit"
        onClick={e => { if (!confirm(`Broker "${brokerName}" verwijderen?`)) e.preventDefault() }}
        className="px-4 py-2 rounded-lg border border-terracotta/40 text-sm font-medium text-terracotta hover:bg-terracotta/10 transition-colors"
      >
        Broker verwijderen
      </button>
    </form>
  )
}
