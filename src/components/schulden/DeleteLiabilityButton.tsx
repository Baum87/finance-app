import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton'

interface DeleteLiabilityButtonProps {
  liabilityId: string
  name: string
  action: (formData: FormData) => Promise<void>
}

export function DeleteLiabilityButton({ liabilityId, name, action }: DeleteLiabilityButtonProps) {
  return (
    <ConfirmDeleteButton
      action={action}
      hiddenFields={{ liabilityId }}
      confirmMessage={`'${name}' verwijderen?`}
      label="Verwijderen"
      className="text-xs text-muted-foreground hover:text-terracotta transition-colors"
    />
  )
}
