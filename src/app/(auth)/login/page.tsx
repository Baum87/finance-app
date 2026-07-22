import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { signIn } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Inloggen</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signIn} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mailadres</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
              <Link href="/wachtwoord-vergeten" className="self-end text-xs text-primary hover:underline">
                Wachtwoord vergeten?
              </Link>
            </div>
            {error && (
              <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
            )}
            <Button type="submit" className="w-full">Inloggen</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
