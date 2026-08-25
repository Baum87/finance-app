'use client'

type Props = {
  action: (formData: FormData) => Promise<void>
  hiddenFields: Record<string, string>
  confirmMessage: string
  label: string
  className: string
}

/** Gedeelde skelet voor delete-knoppen: form + hidden fields + confirm() vóór submit. */
export function ConfirmDeleteButton({ action, hiddenFields, confirmMessage, label, className }: Props) {
  return (
    <form action={action}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        className={className}
        onClick={e => { if (!confirm(confirmMessage)) e.preventDefault() }}
      >
        {label}
      </button>
    </form>
  )
}
