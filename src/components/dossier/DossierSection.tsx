import type { ReactNode } from 'react'

type Props = {
  number: number
  title: string
  description?: string
  children: ReactNode
}

export function DossierSection({ number, title, description, children }: Props) {
  return (
    <section className="space-y-4 break-before-auto">
      <div className="border-b border-border pb-2">
        <h2 className="text-lg font-semibold text-foreground">
          <span className="text-muted-foreground mr-2">{number}.</span>{title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export function DossierEmpty({ children = 'Nog niets vastgelegd.' }: { children?: ReactNode }) {
  return <p className="text-sm text-muted-foreground italic">{children}</p>
}
