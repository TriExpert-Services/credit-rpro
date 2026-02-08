# Credit Repair Pro — API Endpoints Reference

> **Total Endpoints: 149** | Last updated: 2026-02-08  
> Base URL: `https://triexpertservice.com/api`

---

## Table of Contents

- [Route Prefix Mappings](#route-prefix-mappings)
- [Rate Limiting Tiers](#rate-limiting-tiers)
- [Public Endpoints (No Auth)](#public-endpoints-no-auth)
- [Auth (`/api/auth`)](#auth-apiauth)
- [Users (`/api/users`)](#users-apiusers)
- [Clients (`/api/clients`)](#clients-apiclients)
- [Credit Items (`/api/credit-items`)](#credit-items-apicredit-items)
- [Credit Scores (`/api/credit-scores`)](#credit-scores-apicredit-scores)
- [Dashboard (`/api/dashboard`)](#dashboard-apidashboard)
- [Disputes (`/api/disputes`)](#disputes-apidisputes)
- [AI Disputes (`/api/ai-disputes`)](#ai-disputes-apiai-disputes)
- [Documents (`/api/documents`)](#documents-apidocuments)
- [Payments (`/api/payments`)](#payments-apipayments)
- [Subscriptions (`/api/subscriptions`)](#subscriptions-apisubscriptions)
- [Invoices (`/api/invoices`)](#invoices-apiinvoices)
- [Notifications (`/api/notifications`)](#notifications-apinotifications)
- [Onboarding (`/api/onboarding`)](#onboarding-apionboarding)
- [Contracts (`/api/contracts`)](#contracts-apicontracts)
- [Compliance (`/api/compliance`)](#compliance-apicompliance)
- [Credit Report Analysis (`/api/credit-reports`)](#credit-report-analysis-apicredit-reports)
- [Admin Settings (`/api/admin`)](#admin-settings-apiadmin)
- [Process Notes (`/api/notes`)](#process-notes-apinotes)
- [Plaid Integration (`/api/plaid`)](#plaid-integration-apiplaid)
- [Stripe Webhook (`/api/webhooks/stripe`)](#stripe-webhook-apiwebhooksstripe)
- [Monitoring (`/api/monitoring`)](#monitoring-apimonitoring)

---

## Route Prefix Mappings

| Prefix | Route File | Audit Middleware |
|---|---|---|
| `/api/auth` | `auth.js` | — |
| `/api/users` | `users.js` | `auditMiddleware('user')` |
| `/api/clients` | `clients.js` | `auditMiddleware('client')` |
| `/api/credit-scores` | `creditScores.js` | `auditMiddleware('credit_score')` |
| `/api/credit-items` | `creditItems.js` | `auditMiddleware('credit_item')` |
| `/api/disputes` | `disputes.js` | `auditMiddleware('dispute')` |
| `/api/documents` | `documents.js` | `auditMiddleware('document')` |
| `/api/dashboard` | `dashboard.js` | — |
| `/api/payments` | `payments.js` | `auditMiddleware('payment')` |
| `/api/ai-disputes` | `aiDisputes.js` | `auditMiddleware('ai_dispute')` |
| `/api/admin` | `adminSettings.js` | `auditMiddleware('admin_settings')` |
| `/api/contracts` | `contracts.js` | `auditMiddleware('contract')` |
| `/api/invoices` | `invoices.js` | `auditMiddleware('invoice')` |
| `/api/notifications` | `notifications.js` | `auditMiddleware('notification')` |
| `/api/notes` | `processNotes.js` | `auditMiddleware('process_note')` |
| `/api/onboarding` | `onboarding.js` | — |
| `/api/credit-reports` | `creditReportAnalysis.js` | `auditMiddleware('credit_report')` |
| `/api/subscriptions` | `subscriptions.js` | `auditMiddleware('subscription')` |
| `/api/webhooks/stripe` | `stripeWebhook.js` | — |
| `/api/plaid` | `plaid.js` | — |
| `/api/compliance` | `compliance.js` | `auditMiddleware('compliance')` |
| `/api/monitoring` | `monitoring.js` | — |

---

## Rate Limiting Tiers

| Tier | Limit | Window | Applied To |
|---|---|---|---|
| `authLimiter` | 10 req | 15 min | `/api/auth/login`, `/api/auth/register` |
| `sensitiveLimiter` | 30 req | 15 min | `/api/auth/change-password`, `/api/users/:id`, `/api/admin` |
| `writeLimiter` | 60 req | 15 min | `/api/disputes`, `/api/payments`, `/api/subscriptions` |
| `aiLimiter` | 20 req | 15 min | `/api/ai-disputes`, `/api/credit-reports` |
| `uploadLimiter` | 15 req | 15 min | `/api/documents/upload` |
| `generalLimiter` | 200 req | 15 min | All `/api/` routes (default) |

---

## Public Endpoints (No Auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Simple health check — `{status, timestamp}` |
| `GET` | `/` | API root info — `{message, version, status}` |
| `GET` | `/api/monitoring/liveness` | K8s liveness probe |
| `GET` | `/api/monitoring/readiness` | K8s readiness probe (checks DB) |
| `GET` | `/api/subscriptions/plans` | Get available subscription plans |
| `POST` | `/api/webhooks/stripe` | Handle Stripe webhook events |
| `POST` | `/api/plaid/webhook` | Handle Plaid webhook events |

---

## Auth (`/api/auth`)

> 10 endpoints | Rate limited: `authLimiter` on login/register, `sensitiveLimiter` on change-password

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `POST` | `/api/auth/register` | Public | Register new client user |
| 2 | `POST` | `/api/auth/login` | Public | User login with optional 2FA |
| 3 | `POST` | `/api/auth/2fa/setup` | Token | Generate 2FA secret & QR code |
| 4 | `POST` | `/api/auth/2fa/verify` | Token | Verify TOTP code & enable 2FA |
| 5 | `POST` | `/api/auth/2fa/disable` | Token | Disable 2FA |
| 6 | `GET` | `/api/auth/2fa/status` | Token | Get 2FA status |
| 7 | `POST` | `/api/auth/2fa/regenerate-backup` | Token | Regenerate backup codes |
| 8 | `POST` | `/api/auth/change-password` | Token | Change password |
| 9 | `POST` | `/api/auth/logout` | Token | Log out |
| 10 | `POST` | `/api/auth/auth0/sync` | Token | Sync Auth0 user with local DB |

<details>
<summary>Request/Response Details</summary>

**POST /api/auth/register**
```json
// Request
{ "email": "string", "password": "string", "firstName": "string", "lastName": "string", "phone?": "string" }
// Response
{ "token": "jwt", "user": { "id", "email", "firstName", "lastName", "role", "twoFactorEnabled" } }
```

**POST /api/auth/login**
```json
// Request
{ "email": "string", "password": "string", "totpCode?": "string" }
// Response (success)
{ "token": "jwt", "user": { ... } }
// Response (2FA required)
{ "requires2FA": true, "tempToken": "string", "user": { "email" } }
```

**POST /api/auth/2fa/setup**
```json
// Response
{ "secret": "string", "qrCode": "data:image/png;base64,...", "manualEntryKey": "string" }
```

**POST /api/auth/2fa/verify**
```json
// Request
{ "code": "string" }
// Response
{ "enabled": true, "backupCodes": ["string"] }
```

**POST /api/auth/2fa/disable**
```json
// Request
{ "password": "string", "code?": "string" }
// Response
{ "enabled": false }
```

**POST /api/auth/change-password**
```json
// Request
{ "currentPassword": "string", "newPassword": "string" }
```

**POST /api/auth/auth0/sync**
```json
// Request
{ "email": "string", "firstName": "string", "lastName": "string", "auth0Id": "string", "picture?": "string", "emailVerified?": "boolean" }
// Response
{ "user": { ... }, "isNewUser": "boolean" }
```

</details>

---

## Users (`/api/users`)

> 4 endpoints | Audit: `user`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/users/profile` | Token | Get current user profile |
| 2 | `PUT` | `/api/users/profile` | Token | Update user profile |
| 3 | `GET` | `/api/users` | Staff | List all users (paginated) |
| 4 | `DELETE` | `/api/users/:id` | Admin | Delete user and cascaded data |

<details>
<summary>Request/Response Details</summary>

**GET /api/users/profile**
```json
// Response
{ "user": { "id", "email", "first_name", "last_name", "phone", "role", "status", "created_at", "date_of_birth", "address_line_1", "city", "state", "zip_code", "subscription_status" } }
```

**PUT /api/users/profile**
```json
// Request
{ "firstName?": "string", "lastName?": "string", "phone?": "string", "dateOfBirth?": "string", "addressLine1?": "string", "addressLine2?": "string", "city?": "string", "state?": "string", "zipCode?": "string" }
```

**GET /api/users** — Query: `?role=&status=&limit=20&offset=0`
```json
// Response
{ "users": [...], "total": 50, "limit": 20, "offset": 0 }
```

**DELETE /api/users/:id**
```json
// Response
{ "deletedUser": { "id", "email", "name" } }
```

</details>

---

## Clients (`/api/clients`)

> 2 endpoints | Audit: `client`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/clients` | Staff | Get all clients with stats |
| 2 | `GET` | `/api/clients/:id` | Token | Get client details |

<details>
<summary>Request/Response Details</summary>

**GET /api/clients**
```json
// Response
{ "clients": [{ "id", "email", "first_name", "last_name", "phone", "created_at", "subscription_status", "total_items", "total_disputes" }] }
```

**GET /api/clients/:id**
```json
// Response
{ "client": { "id", "email", "first_name", "last_name", "phone", "role", "status", "created_at", "profile_data..." } }
```

</details>

---

## Credit Items (`/api/credit-items`)

> 5 endpoints | Audit: `credit_item`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/credit-items` | Token | Get current user's credit items (paginated) |
| 2 | `GET` | `/api/credit-items/client/:clientId` | Token | Get credit items for specific client |
| 3 | `POST` | `/api/credit-items` | Token | Add new credit item |
| 4 | `PUT` | `/api/credit-items/:id/status` | Token | Update credit item status |
| 5 | `DELETE` | `/api/credit-items/:id` | Token | Delete credit item |

<details>
<summary>Request/Response Details</summary>

**GET /api/credit-items** — Query: `?page=1&limit=50`
```json
// Response
{ "items": [...], "total": 10, "page": 1, "limit": 50 }
```

**POST /api/credit-items**
```json
// Request
{ "clientId": "uuid", "itemType": "string", "creditorName": "string", "accountNumber": "string", "bureau": "string", "balance": "number", "dateOpened": "date", "description": "string" }
// Response
{ "item": { ... } }
```

**PUT /api/credit-items/:id/status**
```json
// Request
{ "status": "string" }
```

</details>

---

## Credit Scores (`/api/credit-scores`)

> 10 endpoints | Audit: `credit_score`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `POST` | `/api/credit-scores` | Token + Zod | Record a new credit score |
| 2 | `GET` | `/api/credit-scores/:clientId/latest` | Token | Get latest scores for all bureaus |
| 3 | `GET` | `/api/credit-scores/:clientId/history/:bureau` | Token | Score history for a bureau |
| 4 | `GET` | `/api/credit-scores/:clientId/trend/:bureau` | Token | Calculate score trend |
| 5 | `GET` | `/api/credit-scores/:clientId/factors` | Token | Score factors analysis |
| 6 | `GET` | `/api/credit-scores/:clientId/comparison` | Token | Bureau score comparison |
| 7 | `GET` | `/api/credit-scores/:clientId/report` | Token | Generate credit report summary |
| 8 | `GET` | `/api/credit-scores/:clientId/anomalies` | Token | Detect score anomalies |
| 9 | `GET` | `/api/credit-scores/:clientId/projections` | Token | Project score improvements |
| 10 | `GET` | `/api/credit-scores/:clientId/detailed-factors` | Token | Detailed FICO factor analysis |

<details>
<summary>Request/Response Details</summary>

**POST /api/credit-scores** — Zod validated: `addCreditScoreSchema`
```json
// Request
{ "clientId": "uuid", "bureau": "equifax|experian|transunion", "score": 300-850, "source?": "string", "notes?": "string" }
// Response
{ "score": { ... } }
```

**GET /api/credit-scores/:clientId/latest**
```json
// Response
{ "scores": [{ "bureau", "score", "recorded_at" }], "bureaus": ["equifax", "experian", "transunion"] }
```

**GET /api/credit-scores/:clientId/history/:bureau** — Query: `?limit=12`
```json
// Response
{ "bureau": "string", "history": [...], "totalRecords": 0 }
```

</details>

---

## Dashboard (`/api/dashboard`)

> 2 endpoints

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/dashboard/client/:clientId` | Token | Client dashboard stats |
| 2 | `GET` | `/api/dashboard/admin/stats` | Staff | Admin dashboard stats |

<details>
<summary>Request/Response Details</summary>

**GET /api/dashboard/client/:clientId**
```json
// Response
{ "currentScores": [...], "itemsSummary": [...], "disputesSummary": [...], "recentActivity": [...], "scoreImprovement": [...] }
```

**GET /api/dashboard/admin/stats**
```json
// Response
{ "totalClients": 0, "activeSubscriptions": 0, "totalDisputes": 0, "monthlyRevenue": 0, "recentClients": [...], "disputesByStatus": [...], "revenueTrend": [...] }
```

</details>

---

## Disputes (`/api/disputes`)

> 4 endpoints | Audit: `dispute` | Rate limited: `writeLimiter`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/disputes/client/:clientId` | Token | Get all disputes for client |
| 2 | `POST` | `/api/disputes` | Token | Create dispute with generated letter |
| 3 | `PUT` | `/api/disputes/:id/status` | Token | Update dispute status/details |
| 4 | `GET` | `/api/disputes/:id` | Token | Get single dispute |

<details>
<summary>Request/Response Details</summary>

**GET /api/disputes/client/:clientId** — Query: `?page=1&limit=20`
```json
// Response
{ "disputes": [...] }
```

**POST /api/disputes**
```json
// Request
{ "clientId": "uuid", "creditItemId": "uuid", "disputeType": "string", "bureau": "string" }
// Response
{ "dispute": { ... } }
```

**PUT /api/disputes/:id/status**
```json
// Request
{ "status?": "string", "sentDate?": "date", "responseDate?": "date", "responseText?": "string", "trackingNumber?": "string" }
```

</details>

---

## AI Disputes (`/api/ai-disputes`)

> 8 endpoints | Audit: `ai_dispute` | Rate limited: `aiLimiter`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/ai-disputes/strategy/:creditItemId` | Token | Get recommended dispute strategy |
| 2 | `GET` | `/api/ai-disputes/strategies/overview` | Token | Get all available strategies |
| 3 | `POST` | `/api/ai-disputes/generate` | Token + Zod | Generate dispute letter via OpenAI |
| 4 | `POST` | `/api/ai-disputes/save` | Token | Save generated letter as draft |
| 5 | `GET` | `/api/ai-disputes/drafts` | Token | Get user's dispute drafts & sent |
| 6 | `GET` | `/api/ai-disputes/:id` | Token | Get specific dispute letter |
| 7 | `PATCH` | `/api/ai-disputes/:id/send` | Token | Mark dispute as sent |
| 8 | `DELETE` | `/api/ai-disputes/:id` | Token | Delete a dispute draft |

<details>
<summary>Request/Response Details</summary>

**GET /api/ai-disputes/strategy/:creditItemId** — Query: `?bureau=equifax`
```json
// Response
{ "creditItem": {...}, "strategy": {...}, "currentRound": 1, "previousResult": null, "scoreImpact": {...}, "allRounds": [...] }
```

**POST /api/ai-disputes/generate** — Zod validated: `generateAIDisputeSchema`
```json
// Request
{ "creditItemId": "uuid", "disputeType": "string", "bureau": "string", "additionalDetails?": "string" }
// Response
{ "letter": "string", "creditItem": {...}, "bureau": "string", "disputeType": "string" }
```

**POST /api/ai-disputes/save**
```json
// Request
{ "creditItemId": "uuid", "content": "string", "disputeType": "string", "bureau": "string" }
// Response
{ "id": "uuid", "status": "draft", "createdAt": "datetime" }
```

</details>

---

## Documents (`/api/documents`)

> 4 endpoints | Audit: `document` | Rate limited: `uploadLimiter` on upload

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `POST` | `/api/documents/upload` | Token | Upload document (multipart) |
| 2 | `GET` | `/api/documents/client/:clientId` | Token | Get client's documents |
| 3 | `GET` | `/api/documents/:id/download` | Token | Download/view a document |
| 4 | `DELETE` | `/api/documents/:id` | Token | Delete document + file |

<details>
<summary>Request/Response Details</summary>

**POST /api/documents/upload** — Content-Type: `multipart/form-data`
```
Fields: document (file), clientId (string), disputeId? (string), documentCategory? (string)
```
```json
// Response
{ "document": { "id", "client_id", "file_name", "file_type", "file_size", "document_category", "uploaded_at" } }
```

</details>

---

## Payments (`/api/payments`)

> 2 endpoints | Audit: `payment` | Rate limited: `writeLimiter`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/payments/client/:clientId` | Token | Get payment history (paginated) |
| 2 | `POST` | `/api/payments` | Staff | Record manual payment |

<details>
<summary>Request/Response Details</summary>

**GET /api/payments/client/:clientId** — Query: `?page=1&limit=20`
```json
// Response
{ "payments": [...], "total": 0, "page": 1, "limit": 20 }
```

**POST /api/payments**
```json
// Request
{ "clientId": "uuid", "amount": "number", "paymentMethod": "string", "description": "string" }
// Response
{ "payment": { ... } }
```

</details>

---

## Subscriptions (`/api/subscriptions`)

> 12 endpoints | Audit: `subscription` | Rate limited: `writeLimiter`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/subscriptions/plans` | **Public** | Get available plans |
| 2 | `GET` | `/api/subscriptions/current` | Token | Get current subscription |
| 3 | `GET` | `/api/subscriptions/access-status` | Token | Check access status |
| 4 | `POST` | `/api/subscriptions/checkout` | Token | Create Stripe checkout session |
| 5 | `POST` | `/api/subscriptions/portal` | Token | Create Stripe customer portal |
| 6 | `POST` | `/api/subscriptions/cancel` | Token | Cancel subscription |
| 7 | `GET` | `/api/subscriptions/payments` | Token | Get payment history |
| 8 | `POST` | `/api/subscriptions/guarantee-claim` | Token | Submit 90-day guarantee refund |
| 9 | `GET` | `/api/subscriptions/admin/stats` | Admin | Revenue statistics |
| 10 | `GET` | `/api/subscriptions/admin/guarantee-claims` | Admin | Get guarantee claims |
| 11 | `POST` | `/api/subscriptions/admin/process-claim/:claimId` | Admin | Process guarantee claim |
| 12 | `GET` | `/api/subscriptions/admin/transactions` | Admin | Get all transactions |

<details>
<summary>Request/Response Details</summary>

**POST /api/subscriptions/checkout**
```json
// Request
{ "planId": "string", "billingCycle?": "monthly|annual" }
// Response
{ "sessionId": "string", "checkoutUrl": "https://checkout.stripe.com/..." }
```

**POST /api/subscriptions/cancel**
```json
// Request
{ "reason": "string", "immediately?": "boolean" }
```

**POST /api/subscriptions/guarantee-claim**
```json
// Request
{ "reason": "string (min 20 chars)" }
// Response
{ "claim": { "serviceDays", "totalPaid", "requestedRefund" } }
```

**POST /api/subscriptions/admin/process-claim/:claimId**
```json
// Request
{ "action": "approve|partial|deny", "refundAmount?": "number", "notes?": "string" }
```

**GET /api/subscriptions/admin/transactions** — Query: `?limit=50&offset=0&startDate=&endDate=`

</details>

---

## Invoices (`/api/invoices`)

> 9 endpoints | Audit: `invoice`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/invoices` | Token | Get invoices (client's own or admin query) |
| 2 | `GET` | `/api/invoices/unpaid` | Admin | Get all unpaid invoices |
| 3 | `GET` | `/api/invoices/stats` | Admin | Get billing statistics |
| 4 | `GET` | `/api/invoices/:id` | Token | Get specific invoice |
| 5 | `POST` | `/api/invoices` | Admin | Generate invoice |
| 6 | `POST` | `/api/invoices/:id/send` | Admin | Send invoice to client |
| 7 | `POST` | `/api/invoices/:id/pay` | Token | Record payment for invoice |
| 8 | `POST` | `/api/invoices/update-overdue` | Admin | Update overdue statuses |
| 9 | `GET` | `/api/invoices/report/:year/:month` | Admin | Monthly billing report |

<details>
<summary>Request/Response Details</summary>

**GET /api/invoices** — Query: `?clientId= (admin)&status=`
```json
// Response
{ "invoices": [...], "totalCount": 0, "totalAmount": 0 }
```

**POST /api/invoices**
```json
// Request
{ "clientId": "uuid", "amount": "number", "description": "string", "billingPeriodStart?": "date", "billingPeriodEnd?": "date" }
// Response
{ "invoice": { ... } }
```

**POST /api/invoices/:id/pay**
```json
// Request
{ "paymentMethod": "string", "stripePaymentId?": "string" }
```

</details>

---

## Notifications (`/api/notifications`)

> 8 endpoints | Audit: `notification`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/notifications` | Token | Get user's notifications |
| 2 | `PATCH` | `/api/notifications/:id/read` | Token | Mark notification as read |
| 3 | `PUT` | `/api/notifications/:id/read` | Token | Mark notification as read (alt) |
| 4 | `DELETE` | `/api/notifications/:id` | Token | Delete a notification |
| 5 | `PUT` | `/api/notifications/read-all` | Token | Mark all as read |
| 6 | `POST` | `/api/notifications/send` | Admin | Send notification to a user |
| 7 | `POST` | `/api/notifications/send-template` | Admin | Send template notification |
| 8 | `GET` | `/api/notifications/stats` | Admin | Notification statistics |

<details>
<summary>Request/Response Details</summary>

**GET /api/notifications** — Query: `?unreadOnly=true`
```json
// Response
{ "notifications": [...], "unreadCount": 0 }
```

**POST /api/notifications/send**
```json
// Request
{ "recipientId": "uuid", "notificationType?": "string", "subject": "string", "message": "string", "channels?": ["email", "in_app"] }
```

**POST /api/notifications/send-template**
```json
// Request
{ "recipientId": "uuid", "templateName": "string", "variables?": {}, "channels?": ["email", "in_app"] }
```

</details>

---

## Onboarding (`/api/onboarding`)

> 9 endpoints

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/onboarding/data` | Token | Get existing onboarding data |
| 2 | `POST` | `/api/onboarding/save-progress` | Token | Save form step progress (1-7) |
| 3 | `GET` | `/api/onboarding/status` | Token | Get onboarding status |
| 4 | `POST` | `/api/onboarding/complete` | Token | Complete onboarding |
| 5 | `GET` | `/api/onboarding/legal-documents` | Token | Get active legal documents |
| 6 | `GET` | `/api/onboarding/legal-documents/:type` | Token | Get specific legal document |
| 7 | `GET` | `/api/onboarding/pending` | Staff | Get all pending onboardings |
| 8 | `GET` | `/api/onboarding/client/:id` | Staff | Get client onboarding details |
| 9 | `POST` | `/api/onboarding/verify/:id` | Staff | Verify client profile |

<details>
<summary>Request/Response Details</summary>

**POST /api/onboarding/save-progress**
```json
// Request
{ "step": 1-7, "data": { ... } }
```

**POST /api/onboarding/complete**
```json
// Request
{
  "firstName": "string", "middleName?": "string", "lastName": "string", "suffix?": "string",
  "dateOfBirth": "date", "ssn": "string", "phone": "string", "alternatePhone?": "string",
  "email": "string", "currentAddress": { ... }, "previousAddresses?": [...],
  "employment": { ... }, "authorizations": { ... },
  "signature": "string", "signatureDate": "date", "ipAddress": "string"
}
```

**POST /api/onboarding/verify/:id**
```json
// Request
{ "verified": "boolean", "notes?": "string" }
```

</details>

---

## Contracts (`/api/contracts`)

> 8 endpoints | Audit: `contract`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/contracts/signed` | Token | Get user's signed contracts |
| 2 | `GET` | `/api/contracts/templates` | Admin | Get all contract templates |
| 3 | `GET` | `/api/contracts/verify/:contractType` | Token | Check if user signed a contract |
| 4 | `GET` | `/api/contracts/:contractType` | Token | Get contract template for signing |
| 5 | `POST` | `/api/contracts/:contractType/sign` | Token | Sign a contract |
| 6 | `POST` | `/api/contracts/templates` | Admin | Create contract template |
| 7 | `GET` | `/api/contracts/compliance/:contractType` | Admin | Get compliance info |
| 8 | `POST` | `/api/contracts/cancel` | Token | Cancel contract (CROA 3-day right) |

<details>
<summary>Request/Response Details</summary>

**POST /api/contracts/:contractType/sign**
```json
// Request
{ "signatureData": "string", "signatureMethod?": "typed|drawn" }
// Response
{ "signature": { ... } }
```

**POST /api/contracts/templates**
```json
// Request
{ "contractType": "string", "templateContent": "string", "effectiveDate": "date" }
```

**POST /api/contracts/cancel**
```json
// Request
{ "reason?": "string", "submittedAt?": "datetime" }
// Response
{ "withinCroaPeriod": "boolean", "cancellationDeadline": "datetime", "message": "string" }
```

</details>

---

## Compliance (`/api/compliance`)

> 7 endpoints | Audit: `compliance`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `POST` | `/api/compliance/sign-contract` | Token | Sign contract with audit trail |
| 2 | `POST` | `/api/compliance/acknowledge-rights` | Token | Record CROA rights acknowledgment |
| 3 | `POST` | `/api/compliance/acknowledge-fees` | Token | Record fee disclosure acknowledgment |
| 4 | `GET` | `/api/compliance/status` | Token | Get compliance status |
| 5 | `GET` | `/api/compliance/events` | Token | Get compliance events |
| 6 | `POST` | `/api/compliance/cancel-contract` | Token | Cancel contract (CROA 3-day rule) |
| 7 | `GET` | `/api/compliance/contract/:contractId/download` | Token | Download signed contract data |

<details>
<summary>Request/Response Details</summary>

**POST /api/compliance/sign-contract**
```json
// Request
{ "contractType?": "string", "signature": "string", "acknowledgments": {}, "signedAt": "datetime", "effectiveDate?": "date" }
// Response
{ "contractId": "uuid", "signedAt": "datetime", "cancellationDeadline": "datetime" }
```

**POST /api/compliance/acknowledge-rights**
```json
// Request
{ "acknowledgedAt?": "datetime", "rightsVersion?": "string", "acknowledgments": {} }
```

**POST /api/compliance/acknowledge-fees**
```json
// Request
{ "planType": "string", "totalAmount": "number", "currency?": "string", "paymentSchedule?": "string", "acknowledgments": {}, "acknowledgedAt?": "datetime" }
```

**POST /api/compliance/cancel-contract**
```json
// Request
{ "contractId": "uuid", "reason": "string", "cancelledAt?": "datetime" }
// Response
{ "contractId": "uuid", "cancelledAt": "datetime", "withinCancellationPeriod": "boolean", "refundEligible": "boolean" }
```

</details>

---

## Credit Report Analysis (`/api/credit-reports`)

> 9 endpoints | Audit: `credit_report` | Rate limited: `aiLimiter`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `POST` | `/api/credit-reports/upload-and-analyze` | Token | Upload & AI-analyze credit reports |
| 2 | `POST` | `/api/credit-reports/analyze/:documentId` | Token | Analyze existing document |
| 3 | `GET` | `/api/credit-reports/items/:clientId` | Token | Get all credit items |
| 4 | `GET` | `/api/credit-reports/scores/:clientId` | Token | Get credit score history |
| 5 | `GET` | `/api/credit-reports/summary/:clientId` | Token | Get complete analysis summary |
| 6 | `POST` | `/api/credit-reports/generate-disputes/:clientId` | Staff | Bulk generate AI dispute letters |
| 7 | `POST` | `/api/credit-reports/add-score` | Token | Manually add credit score |
| 8 | `PUT` | `/api/credit-reports/items/:itemId` | Token | Update a credit item |
| 9 | `DELETE` | `/api/credit-reports/items/:itemId` | Staff | Delete credit item + disputes |

<details>
<summary>Request/Response Details</summary>

**POST /api/credit-reports/upload-and-analyze** — Content-Type: `multipart/form-data`
```
Fields: reports[] (files, max 3), bureaus (JSON array), clientId? (admin only)
```
```json
// Response
{ "bureausAnalyzed": [...], "scores": {...}, "totalItemsFound": 0, "items": [...], "errors": [...] }
```

**POST /api/credit-reports/generate-disputes/:clientId**
```json
// Request
{ "itemIds?": ["uuid"], "disputeType?": "string" }
// Response
{ "disputesGenerated": 0, "disputes": [...], "errors?": [...] }
```

**POST /api/credit-reports/add-score**
```json
// Request
{ "clientId": "uuid", "bureau": "string", "score": "number", "scoreDate?": "date", "notes?": "string" }
```

</details>

---

## Admin Settings (`/api/admin`)

> 8 endpoints | Audit: `admin_settings` | Rate limited: `sensitiveLimiter`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/admin/settings` | Admin | Get all settings (masked) |
| 2 | `GET` | `/api/admin/settings/:key` | Admin | Get specific setting |
| 3 | `POST` | `/api/admin/settings` | Admin | Create/update a setting |
| 4 | `POST` | `/api/admin/settings/test` | Admin | Test an API key |
| 5 | `DELETE` | `/api/admin/settings/:key` | Admin | Delete a setting |
| 6 | `GET` | `/api/admin/integrations/status` | Admin | Get integration statuses |
| 7 | `GET` | `/api/admin/compliance-stats` | Admin | Get compliance statistics |
| 8 | `POST` | `/api/admin/test-email` | Admin | Send test email via SMTP |

<details>
<summary>Request/Response Details</summary>

**POST /api/admin/settings**
```json
// Request
{ "settingKey": "string", "settingValue": "string", "settingType": "string", "description?": "string" }
```

**POST /api/admin/settings/test**
```json
// Request
{ "apiType": "openai|stripe|plaid|smtp", "apiKey": "string" }
// Response
{ "success": "boolean", "message": "string", "details?": {} }
```

</details>

---

## Process Notes (`/api/notes`)

> 10 endpoints | Audit: `process_note`

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/notes/client/:clientId` | Staff | Get all notes for client |
| 2 | `GET` | `/api/notes/client/:clientId/important` | Staff | Get important notes |
| 3 | `GET` | `/api/notes/client/:clientId/timeline` | Staff | Get timeline view |
| 4 | `GET` | `/api/notes/client/:clientId/summary` | Staff | Get process stage summary |
| 5 | `POST` | `/api/notes` | Staff | Create note |
| 6 | `PATCH` | `/api/notes/:id` | Staff | Update note |
| 7 | `DELETE` | `/api/notes/:id` | Staff | Delete note |
| 8 | `POST` | `/api/notes/follow-up` | Staff | Add follow-up action note |
| 9 | `GET` | `/api/notes/client/:clientId/export` | Staff | Export notes |
| 10 | `GET` | `/api/notes/client/:clientId/activity-report` | Staff | Activity report for date range |

<details>
<summary>Request/Response Details</summary>

**GET /api/notes/client/:clientId** — Query: `?stage=&limit=50`
```json
// Response
{ "notes": [...], "totalCount": 0 }
```

**POST /api/notes**
```json
// Request
{ "clientId": "uuid", "processStage": "string", "noteText": "string", "noteCategory?": "string", "isImportant?": "boolean", "relatedEntity?": {} }
```

**POST /api/notes/follow-up**
```json
// Request
{ "clientId": "uuid", "actionDescription": "string", "dueDate?": "date" }
```

</details>

---

## Plaid Integration (`/api/plaid`)

> 8 endpoints

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `POST` | `/api/plaid/create-link-token` | Token | Create Plaid Link token |
| 2 | `POST` | `/api/plaid/exchange-token` | Token | Exchange public token for access |
| 3 | `GET` | `/api/plaid/accounts` | Token | Get linked bank accounts |
| 4 | `GET` | `/api/plaid/verification-status` | Token | Get identity verification status |
| 5 | `POST` | `/api/plaid/refresh-identity` | Token | Refresh identity verification |
| 6 | `POST` | `/api/plaid/get-transactions` | Token | Get recent transactions |
| 7 | `DELETE` | `/api/plaid/accounts/:itemId` | Token | Remove linked bank account |
| 8 | `POST` | `/api/plaid/webhook` | **Public** | Handle Plaid webhook events |

<details>
<summary>Request/Response Details</summary>

**POST /api/plaid/create-link-token**
```json
// Request
{ "products?": ["transactions", "identity"] }
// Response
{ "linkToken": "string", "expiration": "datetime" }
```

**POST /api/plaid/exchange-token**
```json
// Request
{ "publicToken": "string", "metadata?": {} }
// Response
{ "itemId": "string", "message": "string" }
```

**POST /api/plaid/get-transactions**
```json
// Request
{ "days?": 30 }
```

</details>

---

## Stripe Webhook (`/api/webhooks/stripe`)

> 1 endpoint

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `POST` | `/api/webhooks/stripe` | **Public** | Handle Stripe webhook events |

> Uses `express.raw({type: 'application/json'})` — registered before JSON body parser.  
> Validates `stripe-signature` header. Returns `{received: true}`.

---

## Monitoring (`/api/monitoring`)

> 6 endpoints

| # | Method | Path | Auth | Description |
|---|---|---|---|---|
| 1 | `GET` | `/api/monitoring/liveness` | **Public** | K8s liveness probe — `{status: "alive", uptime}` |
| 2 | `GET` | `/api/monitoring/readiness` | **Public** | K8s readiness probe — `{status: "ready", database}` |
| 3 | `GET` | `/api/monitoring/health` | Admin | Comprehensive health check |
| 4 | `GET` | `/api/monitoring/metrics` | Admin | APM performance metrics |
| 5 | `POST` | `/api/monitoring/metrics/reset` | Admin | Reset APM metrics |
| 6 | `GET` | `/api/monitoring/audit-logs` | Admin | Query audit logs (filterable) |

<details>
<summary>Request/Response Details</summary>

**GET /api/monitoring/health**
```json
// Response
{ "status": "healthy|degraded|unhealthy", "checks": { "database": {...}, "memory": {...}, "services": {...} }, "system": { "uptime", "nodeVersion", "memory" } }
```

**GET /api/monitoring/audit-logs** — Query: `?userId=&action=&entityType=&startDate=&endDate=&limit=50&offset=0`
```json
// Response
{ "logs": [...], "total": 0 }
```

</details>

---

## Auth Levels Legend

| Level | Middleware | Description |
|---|---|---|
| **Public** | None | No authentication required |
| **Token** | `authenticateToken` | Any authenticated user |
| **Staff** | `authenticateToken` + `requireStaff` | Staff or Admin role |
| **Admin** | `authenticateToken` + `requireAdmin` | Admin role only |
| **Zod** | `validate(schema)` | Request body validated with Zod schema |

---

## Endpoint Count by Module

| Module | Endpoints |
|---|---|
| Auth | 10 |
| Users | 4 |
| Clients | 2 |
| Credit Items | 5 |
| Credit Scores | 10 |
| Dashboard | 2 |
| Disputes | 4 |
| AI Disputes | 8 |
| Documents | 4 |
| Payments | 2 |
| Subscriptions | 12 |
| Invoices | 9 |
| Notifications | 8 |
| Onboarding | 9 |
| Contracts | 8 |
| Compliance | 7 |
| Credit Reports | 9 |
| Admin Settings | 8 |
| Process Notes | 10 |
| Plaid | 8 |
| Stripe Webhook | 1 |
| Monitoring | 6 |
| Server (inline) | 3 |
| **TOTAL** | **149** |
