"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RefreshCw, Trash2, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, XCircle, Shield } from "lucide-react"
import Link from "next/link"

interface SecurityEvent {
  id: string
  jti: string
  eventType: string
  eventData: Record<string, unknown>
  subject?: {
    subject_type?: string
    iss?: string
    sub?: string
  }
  receivedAt: string
  issuer: string
}

interface EventsResponse {
  events: SecurityEvent[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  "https://schemas.openid.net/secevent/risc/event-type/sessions-revoked": {
    label: "Sessions Revoked",
    variant: "destructive",
    icon: XCircle,
  },
  "https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked": {
    label: "Tokens Revoked",
    variant: "destructive",
    icon: XCircle,
  },
  "https://schemas.openid.net/secevent/risc/event-type/account-disabled": {
    label: "Account Disabled",
    variant: "destructive",
    icon: XCircle,
  },
  "https://schemas.openid.net/secevent/risc/event-type/account-enabled": {
    label: "Account Enabled",
    variant: "default",
    icon: CheckCircle2,
  },
  "https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required": {
    label: "Credential Change Required",
    variant: "secondary",
    icon: AlertCircle,
  },
  "https://schemas.openid.net/secevent/risc/event-type/account-purged": {
    label: "Account Purged",
    variant: "destructive",
    icon: Trash2,
  },
  "https://schemas.openid.net/secevent/risc/event-type/verification": {
    label: "Verification",
    variant: "outline",
    icon: CheckCircle2,
  },
}

function getEventConfig(eventType: string) {
  return EVENT_TYPE_CONFIG[eventType] || {
    label: eventType.split("/").pop() || "Unknown",
    variant: "secondary" as const,
    icon: Shield,
  }
}

function EventRow({ event }: { event: SecurityEvent }) {
  const [expanded, setExpanded] = useState(false)
  const config = getEventConfig(event.eventType)
  const Icon = config.icon

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <Icon className="h-4 w-4 flex-shrink-0" />
        <Badge variant={config.variant} className="flex-shrink-0">
          {config.label}
        </Badge>
        <span className="text-sm text-muted-foreground truncate flex-1">
          {event.subject?.sub || "No subject"}
        </span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {new Date(event.receivedAt).toLocaleString()}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pl-11 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Event ID:</span>
              <code className="ml-2 text-xs bg-muted px-1 py-0.5 rounded">{event.id}</code>
            </div>
            <div>
              <span className="text-muted-foreground">JTI:</span>
              <code className="ml-2 text-xs bg-muted px-1 py-0.5 rounded">{event.jti}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Issuer:</span>
              <code className="ml-2 text-xs bg-muted px-1 py-0.5 rounded">{event.issuer}</code>
            </div>
            {event.subject?.iss && (
              <div>
                <span className="text-muted-foreground">Client ID:</span>
                <code className="ml-2 text-xs bg-muted px-1 py-0.5 rounded break-all">{event.subject.iss}</code>
              </div>
            )}
          </div>
          <Separator />
          <div>
            <span className="text-sm text-muted-foreground">Event Data:</span>
            <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
              {JSON.stringify(event.eventData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EventsPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [pagination, setPagination] = useState({ total: 0, hasMore: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/events?limit=50")
      if (!res.ok) throw new Error("Failed to fetch events")
      const data: EventsResponse = await res.json()
      setEvents(data.events)
      setPagination({ total: data.pagination.total, hasMore: data.pagination.hasMore })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchEvents, 30000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear all events?")) return
    try {
      await fetch("/api/events", { method: "DELETE" })
      fetchEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear events")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <h1 className="text-xl font-semibold">Security Events Log</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear} disabled={loading || events.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Received Security Events
            </CardTitle>
            <CardDescription>
              {pagination.total} event{pagination.total !== 1 ? "s" : ""} received from Google RISC
              {events.length > 0 && ` (showing ${events.length})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="p-4 mb-4 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            
            {loading && events.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                Loading events...
              </div>
            ) : events.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No security events received yet</p>
                <p className="text-sm mt-1">Events will appear here when Google sends them to your receiver endpoint.</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="border rounded-md">
                  {events.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
