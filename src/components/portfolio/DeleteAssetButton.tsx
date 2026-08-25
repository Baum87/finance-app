import { deleteAssetAction } from '@/app/assets/actions'
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton'

type Props = {
  assetId: string
  assetName: string
  redirectTo: string
}

export function DeleteAssetButton({ assetId, assetName, redirectTo }: Props) {
  return (
    <ConfirmDeleteButton
      action={deleteAssetAction}
      hiddenFields={{ assetId, redirectTo }}
      confirmMessage={`"${assetName}" definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`}
      label="Rekening verwijderen"
      className="px-4 py-2 rounded-lg border border-terracotta/40 text-sm font-medium text-terracotta hover:bg-terracotta/10 transition-colors"
    />
  )
}
