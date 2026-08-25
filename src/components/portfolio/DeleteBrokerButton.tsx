import { deleteBrokerAction } from '@/app/portfolio/_archief-aandelen-etf/actions'
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton'

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
    <ConfirmDeleteButton
      action={deleteBrokerAction}
      hiddenFields={{ brokerId }}
      confirmMessage={message}
      label="Broker verwijderen"
      className="px-4 py-2 rounded-lg border border-terracotta/40 text-sm font-medium text-terracotta hover:bg-terracotta/10 transition-colors"
    />
  )
}
