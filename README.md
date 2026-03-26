# Google RISC Security Event Receiver

A production-ready [Next.js](https://nextjs.org) application that implements Google's **RISC (Risk and Incident Sharing and Collaboration) Cross-Account Protection** receiver.  It accepts security-event tokens pushed by Google, verifies them with Google's public keys, stores them in memory, and renders a live dashboard.

---

## Table of Contents

1. [What is Google RISC / Cross-Account Protection?](#1-what-is-google-risc--cross-account-protection)
2. [Architecture overview](#2-architecture-overview)
3. [Pre-requisites](#3-pre-requisites)
4. [GCP setup](#4-gcp-setup)
   - [4.1 Enable the RISC API](#41-enable-the-risc-api)
   - [4.2 Create a service account](#42-create-a-service-account)
   - [4.3 Grant the service account access](#43-grant-the-service-account-access)
   - [4.4 Download the service account key](#44-download-the-service-account-key)
5. [OAuth consent screen setup](#5-oauth-consent-screen-setup)
6. [Application setup](#6-application-setup)
   - [6.1 Clone & install](#61-clone--install)
   - [6.2 Environment variables](#62-environment-variables)
   - [6.3 Run locally](#63-run-locally)
7. [Deploy to Vercel](#7-deploy-to-vercel)
8. [Register the RISC stream with Google](#8-register-the-risc-stream-with-google)
   - [8.1 Via the dashboard](#81-via-the-dashboard)
   - [8.2 Via the API](#82-via-the-api)
   - [8.3 Via curl](#83-via-curl)
9. [How to verify the integration](#9-how-to-verify-the-integration)
10. [API reference](#10-api-reference)
11. [Supported event types](#11-supported-event-types)
12. [Production considerations](#12-production-considerations)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. What is Google RISC / Cross-Account Protection?

[Google's Cross-Account Protection](https://developers.google.com/identity/protocols/risc) (part of the OpenID RISC spec) lets your application receive real-time security events about Google accounts that have signed in to your service.  When something notable happens to a user's Google account — their sessions are revoked, their password is changed, their account is disabled — Google pushes a signed **Security Event Token (SET)** to your registered receiver endpoint.

Your application must then act on those events (e.g., sign the user out, force a password reset, or disable the account in your system).

---

## 2. Architecture overview

```
Google RISC API ──(HTTPS POST with JWT/SET)──► /security-event-receiver
                                                   │
                                                   ▼
                                            Verify JWT signature
                                            (Google JWKS at googleapis.com)
                                                   │
                                                   ▼
                                            In-memory event store
                                                   │
                                                   ▼
                                            Dashboard at /events

Service Account ◄──── /api/risc-stream (GET/POST) ──── Admin dashboard
```

| Path | Description |
|---|---|
| `POST /security-event-receiver` | Receives and verifies Google RISC security events |
| `GET  /security-event-receiver` | Health check |
| `GET  /api/events` | List stored events (JSON) |
| `DELETE /api/events` | Clear all stored events |
| `GET  /api/risc-stream` | Fetch current RISC stream config from Google |
| `POST /api/risc-stream` | Register / update RISC stream with Google |
| `DELETE /api/risc-stream` | Disable the RISC stream |
| `/` | Admin dashboard |
| `/events` | Live security events log |

---

## 3. Pre-requisites

- **Node.js 18+** (or the version your hosting platform requires)
- **pnpm** (or npm / yarn)
- A **Google Cloud project** with at least one OAuth 2.0 client that uses Google Sign-In
- A domain with a valid **HTTPS** certificate (required by Google — `localhost` works only for testing with a tunnel such as [ngrok](https://ngrok.com))

---

## 4. GCP setup

### 4.1 Enable the RISC API

1. Open [Google Cloud Console](https://console.cloud.google.com) and select your project.
2. Go to **APIs & Services → Library**.
3. Search for **"RISC API"** (also known as *Identity Toolkit API* or *RISC Configuration API*) and click **Enable**.

   Direct link: `https://console.cloud.google.com/apis/library/risc.googleapis.com`

### 4.2 Create a service account

1. Go to **IAM & Admin → Service Accounts**.
2. Click **+ Create Service Account**.
3. Name it something like `risc-admin`, fill in a description, and click **Create and Continue**.
4. Skip the "Grant access" step for now (done in [section 4.3](#43-grant-the-service-account-access)).
5. Click **Done**.

### 4.3 Grant the service account access

The service account needs permission to call Google's RISC Configuration API.  Google does **not** use IAM roles for RISC — instead you authorise the service account in the **OAuth Consent Screen** settings.

1. In Cloud Console go to **APIs & Services → OAuth consent screen**.
2. Scroll to the **"Domain verification"** or **"RISC configuration"** section.  
   *(The exact label varies by console version.)*
3. Under **"Security event receiver"** click **Add service account**.
4. Enter the email address of the service account you just created (e.g., `risc-admin@your-project.iam.gserviceaccount.com`).
5. Click **Save**.

> **Alternative (API method)** — call `POST https://risc.googleapis.com/v1beta/stream:update` from the service account to self-authorise.  The first call may fail with a 403 until the consent-screen step above is done.

### 4.4 Download the service account key

1. In **IAM & Admin → Service Accounts** click your new service account.
2. Go to the **Keys** tab → **Add Key → Create new key**.
3. Choose **JSON** and click **Create**.  A `.json` file will download.
4. Keep this file safe — you will paste its contents into the `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable.

---

## 5. OAuth consent screen setup

Each OAuth 2.0 client in your project automatically benefits from RISC once the stream is registered.  Make sure your OAuth consent screen is configured:

1. **APIs & Services → OAuth consent screen** → choose **External** (or **Internal** for GSuite).
2. Fill in **App name**, **User support email**, and **Developer contact information**.
3. Under **Scopes** ensure `openid`, `email`, and `profile` are listed (required for Google Sign-In).
4. **Save and continue**.

Google will send RISC events for accounts that have authorised your OAuth clients.

---

## 6. Application setup

### 6.1 Clone & install

```bash
git clone https://github.com/GooseyPrime/v0-google-risc-security-event-receiver.git
cd v0-google-risc-security-event-receiver
pnpm install
```

### 6.2 Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `RECEIVER_URL` | **Yes** | Full HTTPS URL of your receiver endpoint, e.g. `https://your-app.vercel.app/security-event-receiver`.  Must exactly match the URL registered with Google. |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | **Yes** | Contents of the downloaded service account JSON key file.  Paste the entire JSON as a single line, or Base64-encode it first. |
| `NEXT_PUBLIC_APP_URL` | No | Base URL of the app (no trailing slash).  Used to derive `RECEIVER_URL` if that variable is not set. |
| `ALLOWED_CLIENT_IDS` | No | Comma-separated list of OAuth client IDs (full IDs including `.apps.googleusercontent.com`).  If omitted, events from all clients in the project are accepted. |

**Encoding the service account key as Base64** (optional — avoids escaping issues):

```bash
# macOS / Linux
base64 -i path/to/service-account.json | tr -d '\n'

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

Paste the resulting string as the value of `GOOGLE_SERVICE_ACCOUNT_KEY`.

### 6.3 Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Tip:** Google requires an HTTPS URL to push events.  Use [ngrok](https://ngrok.com) to expose your local server:
> ```bash
> ngrok http 3000
> # Copy the https://... URL and use it as RECEIVER_URL
> ```

---

## 7. Deploy to Vercel

1. Push the repository to GitHub (it already is).
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo.
3. In **Environment Variables** add:
   - `RECEIVER_URL` → `https://<your-vercel-domain>/security-event-receiver`
   - `GOOGLE_SERVICE_ACCOUNT_KEY` → the service account JSON (raw or Base64)
   - `ALLOWED_CLIENT_IDS` → (optional) comma-separated client IDs
4. Deploy.
5. After deployment, proceed to [step 8](#8-register-the-risc-stream-with-google).

> **Note:** This app uses an **in-memory** event store.  Serverless deployments (Vercel, Cloud Run, etc.) restart frequently, so events are lost on restart.  For production use, replace `lib/events-store.ts` with a database (see [section 12](#12-production-considerations)).

---

## 8. Register the RISC stream with Google

Once deployed (and `GOOGLE_SERVICE_ACCOUNT_KEY` + `RECEIVER_URL` are set), you must tell Google where to send events.

### 8.1 Via the dashboard

1. Open your deployed app (e.g., `https://your-app.vercel.app`).
2. Find the **RISC Stream Registration** card.
3. Click **Register / Update Stream**.
4. A success message will confirm the stream is active.

### 8.2 Via the API

```bash
curl -X POST https://your-app.vercel.app/api/risc-stream
```

Example success response:

```json
{
  "success": true,
  "receiverUrl": "https://your-app.vercel.app/security-event-receiver",
  "config": {
    "status": "ENABLED",
    "delivery": {
      "delivery_method": "https://schemas.openid.net/secevent/risc/delivery-method/push",
      "url": "https://your-app.vercel.app/security-event-receiver"
    },
    "events_requested": [...]
  }
}
```

### 8.3 Via curl (directly against Google's API)

If you prefer to call Google's API directly using a service account access token:

```bash
# 1. Get an access token (requires gcloud CLI)
ACCESS_TOKEN=$(gcloud auth print-access-token --impersonate-service-account=risc-admin@your-project.iam.gserviceaccount.com)

# 2. Register the stream
curl -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "delivery": {
      "delivery_method": "https://schemas.openid.net/secevent/risc/delivery-method/push",
      "url": "https://your-app.vercel.app/security-event-receiver"
    },
    "events_requested": [
      "https://schemas.openid.net/secevent/risc/event-type/sessions-revoked",
      "https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked",
      "https://schemas.openid.net/secevent/risc/event-type/account-disabled",
      "https://schemas.openid.net/secevent/risc/event-type/account-enabled",
      "https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required",
      "https://schemas.openid.net/secevent/risc/event-type/account-purged"
    ]
  }' \
  https://risc.googleapis.com/v1beta/stream:update
```

---

## 9. How to verify the integration

Google provides a verification mechanism.  After registering the stream you can trigger a test event:

```bash
# Get an access token
ACCESS_TOKEN=$(gcloud auth print-access-token --impersonate-service-account=risc-admin@your-project.iam.gserviceaccount.com)

# Trigger a verification event
curl -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state": "test-state-12345"}' \
  https://risc.googleapis.com/v1beta/stream:verify
```

If the verification succeeds, a **Verification** event will appear in the `/events` dashboard within a few seconds.

---

## 10. API reference

### `POST /security-event-receiver`

Receives a Google-signed Security Event Token (SET / JWT).  Called automatically by Google — you do not need to call this manually.

- **Content-Type:** `application/jwt` (raw JWT in body)
- **200 / 202:** Event accepted
- **400:** Missing or malformed token
- **401:** JWT signature verification failed

### `GET /security-event-receiver`

Health check.  Returns the configured audience URL.

### `GET /api/events?limit=50&offset=0`

List stored events (newest first).

### `DELETE /api/events`

Clear all events from memory.

### `GET /api/risc-stream`

Fetch the current RISC stream configuration from Google (requires service account).

### `POST /api/risc-stream`

Register or update the RISC stream (requires service account + `RECEIVER_URL`).

### `DELETE /api/risc-stream`

Disable the RISC stream.

---

## 11. Supported event types

| Event URI | Label | Recommended action |
|---|---|---|
| `.../risc/event-type/sessions-revoked` | Sessions Revoked | Invalidate all active sessions for the user |
| `.../oauth/event-type/tokens-revoked` | Tokens Revoked | Revoke all OAuth tokens for the user |
| `.../risc/event-type/account-disabled` | Account Disabled | Disable the user account in your system |
| `.../risc/event-type/account-enabled` | Account Enabled | Re-enable the user account |
| `.../risc/event-type/account-credential-change-required` | Credential Change Required | Force a password reset or re-authentication |
| `.../risc/event-type/account-purged` | Account Purged | Delete or anonymise the user's data |
| `.../risc/event-type/verification` | Verification | No action required — endpoint health check |

---

## 12. Production considerations

### Replace the in-memory store

`lib/events-store.ts` uses a simple in-memory array.  In a serverless environment this is reset on every cold start.  Replace it with a persistent store:

- **Vercel Postgres / Neon** — add `@neondatabase/serverless` and swap `addEvent` / `getEvents` for SQL queries.
- **Supabase** — use `@supabase/supabase-js`.
- **Redis (Upstash)** — suitable for high-volume event streams.

### Add a webhook secret / HMAC verification

Google signs events with its private key (verified via JWKS), which provides strong authenticity guarantees.  No additional HMAC secret is needed, but you should ensure `RECEIVER_URL` is not guessable.

### Rate limiting

Add rate limiting to `POST /security-event-receiver` to protect against denial-of-service attacks.  Vercel's [Edge Middleware](https://vercel.com/docs/functions/edge-middleware) or [Upstash Rate Limit](https://github.com/upstash/ratelimit) are good options.

### Handle events asynchronously

For high event volumes, enqueue events to a job queue (e.g., BullMQ, Inngest, or a Cloud Tasks queue) rather than processing synchronously in the API handler.  Return `202 Accepted` immediately after enqueuing.

### Rotate service account keys

Service account keys are long-lived credentials.  Rotate them periodically via Cloud Console → IAM & Admin → Service Accounts → Keys, and update the `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable.

### Multi-project / multi-client support

Each Google Cloud project has one RISC stream configuration.  If you manage multiple projects (each with its own service account), deploy separate instances of this application — one per project — or parameterise the service account key selection.

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 Unauthorized` from receiver | JWT audience mismatch | Ensure `RECEIVER_URL` exactly matches the URL registered with Google (including protocol and path) |
| `403 Forbidden` from `/api/risc-stream` | Service account not authorised | Complete step [4.3](#43-grant-the-service-account-access) |
| `GOOGLE_SERVICE_ACCOUNT_KEY not configured` warning | Missing env var | Set the variable in `.env.local` or your hosting platform |
| Events not appearing after registration | Stream not yet active | Wait 1–2 minutes after registering; trigger a verification event (section 9) |
| `Token verification failed` | Clock skew or wrong JWKS | Ensure your server clock is accurate; check that `RECEIVER_URL` and the registered URL match |
| Verification event never arrives | Endpoint not reachable | Confirm the URL is publicly reachable over HTTPS; check firewall/DNS settings |

---

## Built with

- [Next.js 16](https://nextjs.org) — app framework
- [jose](https://github.com/panva/jose) — JWT / JWKS verification and service account authentication
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Vercel Analytics](https://vercel.com/analytics) — usage analytics

---

<a href="https://v0.app/chat/api/kiro/clone/GooseyPrime/v0-google-risc-security-event-receiver" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>

