'use client'

interface DeleteLiabilityButtonProps {
  liabilityId: string
  name: string
  action: (formData: FormData) => Promise<void>
}

export function DeleteLiabilityButton({ liabilityId, name, action }: DeleteLiabilityButtonProps) {
  return (
    <form action={action}>
      <input type="hidden" name="liabilityId" value={liabilityId} />
      <button
        type="submit"
        className="text-xs text-muted-foreground hover:text-terracotta transition-colors"
        onClick={(e) => {
          if (!confirm(`'${name}' verwijderen?`)) e.preventDefault()
        }}
      >
        Verwijderen
      </button>
    </form>
  )
}
