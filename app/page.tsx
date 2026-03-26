import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Shield } from "lucide-react"

const OAUTH_CLIENT_IDS = [
  "512852924896-bipo81kgpes320pivlunlh8897bsn038",
  "512852924896-mkfn3gbgltmp9u55dspqmbag3oljv726",
  "512852924896-2nhh354ns3ulgpgah3snafp24pt9n347",
  "512852924896-h10347q881ir4un05lfkqt4q7b9csc9p",
  "512852924896-tprr4bk7p19mtetb1r5i0la6aiav1qn7",
  "512852924896-dprrp9mcgpoh40cqk91i30qqr67ijtj5",
  "512852924896-4qdklbl5oihtr51hbr9uo2indbri944l",
]

const SUPPORTED_EVENTS = [
  { name: "Sessions Revoked", description: "User sessions invalidated" },
  { name: "Tokens Revoked", description: "OAuth tokens revoked" },
  { name: "Account Disabled", description: "User account disabled by Google" },
  { name: "Account Enabled", description: "User account re-enabled" },
  { name: "Credential Change Required", description: "Password reset required" },
  { name: "Account Purged", description: "User account permanently deleted" },
  { name: "Verification", description: "Endpoint verification test" },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Google RISC for InTellMe</h1>
          <p className="mt-2 text-muted-foreground">
            Real-time Identity Security Events Receiver
          </p>
        </header>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>RISC receiver endpoint configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receiver URL</p>
                <code className="mt-1 block rounded bg-muted px-3 py-2 text-sm">
                  https://risc.intellmeai.com/security-event-receiver
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Service Account</p>
                <code className="mt-1 block rounded bg-muted px-3 py-2 text-sm">
                  risc-admin@intellmeprojects.iam.gserviceaccount.com
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant="default" className="mt-1 bg-green-600">Active</Badge>
              </div>
              <div className="pt-2">
                <Button asChild>
                  <Link href="/events">
                    <Shield className="h-4 w-4 mr-2" />
                    View Security Events Log
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registered OAuth Clients</CardTitle>
              <CardDescription>{OAUTH_CLIENT_IDS.length} client IDs configured</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {OAUTH_CLIENT_IDS.map((id) => (
                  <li key={id}>
                    <code className="rounded bg-muted px-2 py-1 text-xs">{id}</code>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supported Event Types</CardTitle>
              <CardDescription>Security events this service handles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {SUPPORTED_EVENTS.map((event) => (
                  <div key={event.name} className="rounded-lg border p-3">
                    <p className="font-medium text-foreground">{event.name}</p>
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
