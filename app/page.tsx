import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Shield } from "lucide-react"
import { RiscStreamManager } from "@/components/risc-stream-manager"
import { getServiceAccountEmail } from "@/lib/google-auth"

const OAUTH_CLIENT_IDS = (process.env.ALLOWED_CLIENT_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

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
  const receiverUrl =
    process.env.RECEIVER_URL ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/security-event-receiver`
      : "https://risc.intellmeai.com/security-event-receiver")

  const serviceAccount = getServiceAccountEmail()

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Google RISC Receiver</h1>
          <p className="mt-2 text-muted-foreground">
            Real-time Identity and Cross-Account Protection (RISC) Security Events Receiver
          </p>
        </header>

        <div className="grid gap-6">
          {/* Service Status */}
          <Card>
            <CardHeader>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>RISC receiver endpoint configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receiver URL</p>
                <code className="mt-1 block rounded bg-muted px-3 py-2 text-sm break-all">
                  {receiverUrl}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Service Account</p>
                {serviceAccount ? (
                  <code className="mt-1 block rounded bg-muted px-3 py-2 text-sm">
                    {serviceAccount}
                  </code>
                ) : (
                  <p className="mt-1 text-sm text-destructive">
                    ⚠ GOOGLE_SERVICE_ACCOUNT_KEY not configured
                  </p>
                )}
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

          {/* RISC Stream Registration */}
          <RiscStreamManager />

          {/* Registered OAuth Clients */}
          <Card>
            <CardHeader>
              <CardTitle>OAuth Client Filter</CardTitle>
              <CardDescription>
                {OAUTH_CLIENT_IDS.length > 0
                  ? `${OAUTH_CLIENT_IDS.length} client ID(s) configured via ALLOWED_CLIENT_IDS`
                  : "No ALLOWED_CLIENT_IDS set — events from all project clients are accepted"}
              </CardDescription>
            </CardHeader>
            {OAUTH_CLIENT_IDS.length > 0 && (
              <CardContent>
                <ul className="space-y-2">
                  {OAUTH_CLIENT_IDS.map((id) => (
                    <li key={id}>
                      <code className="rounded bg-muted px-2 py-1 text-xs">{id}</code>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>

          {/* Supported Event Types */}
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
