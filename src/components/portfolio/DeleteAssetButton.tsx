'use client'

import { deleteAssetAction } from '@/app/assets/actions'

type Props = {
  assetId: string
  assetName: string
  redirectTo: string
}

export function DeleteAssetButton({ assetId, assetName, redirectTo }: Props) {
  return (
    <form action={deleteAssetAction}>
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button
        type="submit"
        onClick={e => {
          if (!confirm(`"${assetName}" definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`))
            e.preventDefault()
        }}
        className="px-4 py-2 rounded-lg border border-terracotta/40 text-sm font-medium text-terracotta hover:bg-terracotta/10 transition-colors"
      >
        Rekening verwijderen
      </button>
    </form>
  )
}
