'use client'

interface DeleteRecurringItemButtonProps {
  itemId: string
  name: string
  action: (formData: FormData) => Promise<void>
}

export function DeleteRecurringItemButton({ itemId, name, action }: DeleteRecurringItemButtonProps) {
  return (
    <form action={action}>
      <input type="hidden" name="itemId" value={itemId} />
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
