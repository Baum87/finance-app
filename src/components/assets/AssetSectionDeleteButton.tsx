import { deleteAssetAction } from '@/app/assets/actions'
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton'

type Props = {
  assetId: string
  assetName: string
}

export function AssetSectionDeleteButton({ assetId, assetName }: Props) {
  return (
    <ConfirmDeleteButton
      action={deleteAssetAction}
      hiddenFields={{ assetId }}
      confirmMessage={`${assetName} verwijderen?`}
      label="Verwijderen"
      className="text-xs text-terracotta hover:opacity-70 transition-opacity"
    />
  )
}
