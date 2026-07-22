import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { requestPasswordReset } from './actions'

export default async function WachtwoordVergetenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const { error, sent } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Wachtwoord vergeten</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-muted-foreground">
              Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten
              een e-mail met een link om je wachtwoord opnieuw in te stellen.
            </p>
          ) : (
            <form action={requestPasswordReset} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-mailadres</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              {error && (
                <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
              )}
              <Button type="submit" className="w-full">Reset-link versturen</Button>
            </form>
          )}
          <Link href="/login" className="mt-4 block text-center text-sm text-primary hover:underline">
            Terug naar inloggen
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
