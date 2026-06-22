'use client'

import { deleteMortgageBalanceAction } from '@/app/assets/actions'

type Props = {
  balanceId: string
  redirectTo: string
}

export function DeleteMortgageBalanceButton({ balanceId, redirectTo }: Props) {
  return (
    <form action={deleteMortgageBalanceAction}>
      <input type="hidden" name="balanceId" value={balanceId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button
        type="submit"
        onClick={e => { if (!confirm('Saldo-snapshot verwijderen?')) e.preventDefault() }}
        className="text-xs text-terracotta hover:opacity-70 transition-opacity"
      >
        Verwijderen
      </button>
    </form>
  )
}
