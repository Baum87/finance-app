'use client'

import { deleteBrokerAction } from '@/app/portfolio/aandelen-etf/actions'

export function DeleteBrokerButton({ brokerId, brokerName, positionCount = 0 }: {
  brokerId: string
  brokerName: string
  /** Aantal posities dat bij deze broker hoort — bepaalt de waarschuwingstekst. */
  positionCount?: number
}) {
  const message = positionCount > 0
    ? `Broker "${brokerName}" verwijderen? De ${positionCount} positie${positionCount !== 1 ? 's' : ''} blijven bestaan, maar vallen daarna onder "Overig".`
    : `Broker "${brokerName}" verwijderen?`

  return (
    <form action={deleteBrokerAction}>
      <input type="hidden" name="brokerId" value={brokerId} />
      <button
        type="submit"
        onClick={e => { if (!confirm(message)) e.preventDefault() }}
        className="px-4 py-2 rounded-lg border border-terracotta/40 text-sm font-medium text-terracotta hover:bg-terracotta/10 transition-colors"
      >
        Broker verwijderen
      </button>
    </form>
  )
}
