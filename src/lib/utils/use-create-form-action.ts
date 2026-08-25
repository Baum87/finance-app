'use client'

import { useRef, useState } from 'react'
import type { ActionState } from '@/app/assets/actions'

/** Gedeelde submit-logica voor create-formulieren met een { error }-Server Action:
 * toont de foutmelding bij mislukking, reset het formulier bij succes. */
export function useCreateFormAction(
  action: (formData: FormData) => Promise<ActionState>,
  onSuccess?: () => void,
) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const result = await action(formData)
    if (result?.error) {
      setError(result.error)
      return
    }
    setError(null)
    formRef.current?.reset()
    onSuccess?.()
  }

  return { formRef, error, handleSubmit }
}
