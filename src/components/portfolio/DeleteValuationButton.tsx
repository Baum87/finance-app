import { deleteValuationAction } from '@/app/assets/actions'
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton'

type Props = {
  valuationId: string
  redirectTo: string
}

export function DeleteValuationButton({ valuationId, redirectTo }: Props) {
  return (
    <ConfirmDeleteButton
      action={deleteValuationAction}
      hiddenFields={{ valuationId, redirectTo }}
      confirmMessage="Snapshot verwijderen?"
      label="Verwijderen"
      className="text-xs text-terracotta hover:opacity-70 transition-opacity"
    />
  )
}
