'use client'

import { deleteAssetAction } from '@/app/assets/actions'

type Props = {
  assetId: string
  assetName: string
}

export function AssetSectionDeleteButton({ assetId, assetName }: Props) {
  return (
    <form action={deleteAssetAction}>
      <input type="hidden" name="assetId" value={assetId} />
      <button
        type="submit"
        className="text-xs text-terracotta hover:opacity-70 transition-opacity"
        onClick={e => { if (!confirm(`${assetName} verwijderen?`)) e.preventDefault() }}
      >
        Verwijderen
      </button>
    </form>
  )
}
