"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Radio, AlertCircle, CheckCircle2 } from "lucide-react"

interface StreamStatus {
  status?: string
  delivery?: { url?: string; delivery_method?: string }
  events_requested?: string[]
  error?: string
  details?: unknown
}

export function RiscStreamManager() {
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null)

  const checkStatus = async () => {
    setLoading(true)
    setActionResult(null)
    try {
      const res = await fetch("/api/risc-stream")
      const data: StreamStatus = await res.json()
      setStreamStatus(data)
    } catch (err) {
      setStreamStatus({ error: err instanceof Error ? err.message : "Failed to fetch stream status" })
    } finally {
      setLoading(false)
    }
  }

  const registerStream = async () => {
    setLoading(true)
    setActionResult(null)
    try {
      const res = await fetch("/api/risc-stream", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setActionResult({ ok: true, message: `Stream registered at: ${data.receiverUrl}` })
        setStreamStatus(data.config || null)
      } else {
        setActionResult({ ok: false, message: data.error || "Registration failed" })
      }
    } catch (err) {
      setActionResult({ ok: false, message: err instanceof Error ? err.message : "Registration failed" })
    } finally {
      setLoading(false)
    }
  }

  const streamIsEnabled =
    streamStatus && !streamStatus.error && streamStatus.status !== "DISABLED"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5" />
          RISC Stream Registration
        </CardTitle>
        <CardDescription>
          Register this receiver with Google so it starts receiving security events.
          Requires <code className="text-xs bg-muted px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY</code> and{" "}
          <code className="text-xs bg-muted px-1 rounded">RECEIVER_URL</code> to be set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action result banner */}
        {actionResult && (
          <div
            className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm ${
              actionResult.ok
                ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {actionResult.ok ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {actionResult.message}
          </div>
        )}

        {/* Current stream status */}
        {streamStatus && !streamStatus.error && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Stream status:</span>
              <Badge variant={streamIsEnabled ? "default" : "secondary"}>
                {streamStatus.status || "ENABLED"}
              </Badge>
            </div>
            {streamStatus.delivery?.url && (
              <div>
                <span className="text-muted-foreground">Registered URL: </span>
                <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">
                  {streamStatus.delivery.url}
                </code>
              </div>
            )}
            {streamStatus.events_requested && streamStatus.events_requested.length > 0 && (
              <div>
                <span className="text-muted-foreground">
                  Subscribed to {streamStatus.events_requested.length} event type(s)
                </span>
              </div>
            )}
          </div>
        )}

        {streamStatus?.error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {streamStatus.error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={checkStatus} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Check Status
          </Button>
          <Button size="sm" onClick={registerStream} disabled={loading}>
            <Radio className="h-4 w-4 mr-2" />
            Register / Update Stream
          </Button>
        </div>

        {!streamStatus && !loading && (
          <p className="text-xs text-muted-foreground">
            Click <strong>Check Status</strong> to see the current Google RISC stream configuration, or{" "}
            <strong>Register / Update Stream</strong> to push the configuration to Google.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
