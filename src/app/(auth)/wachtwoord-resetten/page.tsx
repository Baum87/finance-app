import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RecoverySessionForm } from './RecoverySessionForm'

export default async function WachtwoordResettenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Nieuw wachtwoord instellen</CardTitle>
        </CardHeader>
        <CardContent>
          <RecoverySessionForm actionError={error} />
        </CardContent>
      </Card>
    </main>
  )
}
