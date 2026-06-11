import { Button } from '@/components/ui/button'
import { signOut } from '@/app/login/actions'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">Finance app — Sprint 2.3 komt eraan.</p>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">Uitloggen</Button>
      </form>
    </main>
  )
}
