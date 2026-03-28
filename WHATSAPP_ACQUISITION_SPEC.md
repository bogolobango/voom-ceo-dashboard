# VOOM Ghana — WhatsApp Acquisition Bot
## Claude Code Implementation Specification

**Version:** 1.0 · **Date:** March 2026  
**Repo:** `bogolobango/voom-ceo-dashboard`  
**Product:** [voomparts.com](https://voomparts.com) — Ghana's auto spare parts marketplace

---

## 0. How to Use This Document

Feed this file directly into Claude Code from the root of the project:

```bash
claude -p "$(cat WHATSAPP_ACQUISITION_SPEC.md)"
```

Or open Claude Code in the project root and paste the contents. Claude Code should read the existing codebase first (`VendorCRM.tsx`, `routes.ts`, `shared/schema.ts`, `lib/voomApi.ts`) before making any changes. All new code must match the existing patterns exactly.

---

## 1. Goal

Build a **WhatsApp Acquisition module** that lives inside the existing **Outreach CRM** section (`crm` route) of the CEO dashboard. The module enables the CEO of VOOM Ghana to:

1. Discover public WhatsApp group invite links related to car parts, mechanics, and auto enthusiasts in Ghana by scraping the web and social media.
2. Review discovered groups and approve or reject them.
3. Join approved groups via the WhatsApp Business API.
4. Broadcast promotional messages to joined groups using pre-approved templates.
5. Receive and respond to inbound messages from group members in a Lead Inbox.
6. Qualify leads as Vendors or Customers and route them into the existing CRM pipeline.

The workflow is **semi-automated**: the bot discovers and joins, but the CEO approves every step before action is taken.

---

## 2. Existing Codebase Context

### 2.1 Stack
| Layer | Technology |
| :--- | :--- |
| Frontend | React 19, Vite, TypeScript, Wouter (routing) |
| UI Library | Radix UI primitives + custom Arctic Glass design system |
| State / Data | TanStack React Query v5 |
| Backend | Express.js + TypeScript (`server/routes.ts`) |
| Database | PostgreSQL via Drizzle ORM + Supabase client |
| ORM | Drizzle ORM (`shared/schema.ts`) |
| Cache | NodeCache (5-minute TTL on most routes) |

### 2.2 Arctic Glass Design System — Exact Tokens

These values are defined in `client/src/index.css` and must be used verbatim. Do not introduce new colours, fonts, or shadow values.

| Token | Value | Usage |
| :--- | :--- | :--- |
| Primary brand | `#4F46E5` | Buttons, active states, links |
| Emerald | `#059669` | Success, approved, joined |
| Amber | `#D97706` | Warning, pending, follow-up |
| Rose | `#E11D48` | Danger, reject, error |
| Slate dark | `#0F172A` | Headings |
| Slate mid | `#475569` | Body text |
| Slate light | `#94A3B8` | Captions, labels |
| Heading font | `Plus Jakarta Sans` | All `h2`, `h3`, section titles |
| Number font | `Space Grotesk` | KPI values, counts |
| Body font | `Inter` | Table cells, captions |

**Glass card class** (already defined in `index.css`, use as-is):
```css
.glass-card {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 0 0 rgba(255,255,255,1) inset,
              0 8px 32px rgba(79,70,229,0.06),
              0 2px 8px rgba(0,0,0,0.04);
  border-radius: 1.25rem;
}
```

**Reusable local component pattern** (copy from existing sections):
```tsx
function GlassSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="glass-card" style={{ padding: '1.125rem', ...style }}>{children}</div>;
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
        {children}
      </h2>
      {sub && <p style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.125rem' }}>{sub}</p>}
    </div>
  );
}
```

### 2.3 Existing Section: `VendorCRM.tsx`

The target file is `client/src/components/sections/VendorCRM.tsx`. It currently renders:
- A pipeline funnel (6 stages: Not Contacted → Paid)
- Outreach message templates with copy buttons
- A sortable vendor contact table

The new WhatsApp Acquisition module must be added as a **second tab** inside this section, toggled by a tab switcher at the top. The existing CRM content becomes **Tab 1: Vendor Pipeline**. The new module is **Tab 2: WhatsApp Acquisition**.

### 2.4 Files Already Created (Do Not Recreate)

The following files have already been scaffolded and must be imported, not rewritten:

- `server/whatsapp-scraper.ts` — Exports `discoverWhatsAppGroups(options)` and `extractWhatsAppLinks(text)`.
- `server/whatsapp-api.ts` — Exports `sendTextMessage`, `broadcastToGroups`, `verifyWebhookToken`, `processLeadMessage`, `parseWebhookPayload`.
- `shared/schema.ts` — Already contains the new tables: `waGroups`, `waLeads`, `waMessages`, `waBroadcasts`, `waTemplates`, `waScrapeJobs`.

---

## 3. Database Schema Reference

The following tables are already defined in `shared/schema.ts`. Use these exact column names in all API routes and TypeScript types.

### `wa_groups`
```
id              serial PRIMARY KEY
name            varchar(255)
inviteLink      varchar(500) UNIQUE NOT NULL
source          varchar(100)          -- 'google' | 'facebook' | 'instagram' | 'tiktok' | 'web_directory'
sourceUrl       text
keywords        json (string[])
status          enum: 'discovered' | 'approved' | 'joining' | 'joined' | 'rejected' | 'left' | 'failed'
memberCount     integer default 0
waGroupId       varchar(255)          -- Meta group ID after joining
joinedAt        timestamp
lastBroadcastAt timestamp
notes           text
createdAt       timestamp
updatedAt       timestamp
```

### `wa_leads`
```
id                  serial PRIMARY KEY
phone               varchar(30) NOT NULL
name                varchar(255)
profilePicUrl       text
type                enum: 'unknown' | 'vendor' | 'customer'
status              enum: 'new' | 'contacted' | 'qualified' | 'converted' | 'dead'
sourceGroupId       integer (FK → wa_groups.id)
qualificationNotes  text
convertedVendorId   integer (FK → vendors.id)
lastContactedAt     timestamp
createdAt           timestamp
updatedAt           timestamp
```

### `wa_messages`
```
id          serial PRIMARY KEY
leadId      integer (FK → wa_leads.id, nullable)
groupId     integer (FK → wa_groups.id, nullable)
waMessageId varchar(255)
direction   enum: 'inbound' | 'outbound'
content     text NOT NULL
mediaUrl    text
status      varchar(30) default 'sent'
sentAt      timestamp
deliveredAt timestamp
readAt      timestamp
```

### `wa_broadcasts`
```
id              serial PRIMARY KEY
name            varchar(255) NOT NULL
templateName    varchar(100)
messageBody     text NOT NULL
targetGroupIds  json (number[])
status          enum: 'draft' | 'pending_approval' | 'approved' | 'sending' | 'sent' | 'failed'
sentCount       integer default 0
deliveredCount  integer default 0
readCount       integer default 0
scheduledAt     timestamp
sentAt          timestamp
createdAt       timestamp
updatedAt       timestamp
```

### `wa_templates`
```
id              serial PRIMARY KEY
name            varchar(100) NOT NULL
category        varchar(50) default 'marketing'
body            text NOT NULL
variables       json (string[])
metaTemplateId  varchar(255)
status          varchar(30) default 'local'   -- 'local' | 'submitted' | 'approved' | 'rejected'
isDefault       boolean default false
createdAt       timestamp
updatedAt       timestamp
```

---

## 4. TypeScript Type Definitions

Add these types to `client/src/lib/voomApi.ts`:

```typescript
// ── WhatsApp Acquisition Types ──────────────────────────────

export type WaGroupStatus = 'discovered' | 'approved' | 'joining' | 'joined' | 'rejected' | 'left' | 'failed';
export type WaLeadType = 'unknown' | 'vendor' | 'customer';
export type WaLeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'dead';
export type WaMessageDirection = 'inbound' | 'outbound';
export type WaBroadcastStatus = 'draft' | 'pending_approval' | 'approved' | 'sending' | 'sent' | 'failed';

export interface WaGroup {
  id: number;
  name: string | null;
  inviteLink: string;
  source: string | null;
  sourceUrl: string | null;
  keywords: string[] | null;
  status: WaGroupStatus;
  memberCount: number;
  waGroupId: string | null;
  joinedAt: string | null;
  lastBroadcastAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WaLead {
  id: number;
  phone: string;
  name: string | null;
  profilePicUrl: string | null;
  type: WaLeadType;
  status: WaLeadStatus;
  sourceGroupId: number | null;
  qualificationNotes: string | null;
  convertedVendorId: number | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestMessage?: WaMessage | null;
}

export interface WaMessage {
  id: number;
  leadId: number | null;
  groupId: number | null;
  waMessageId: string | null;
  direction: WaMessageDirection;
  content: string;
  mediaUrl: string | null;
  status: string;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface WaTemplate {
  id: number;
  name: string;
  category: string;
  body: string;
  variables: string[] | null;
  metaTemplateId: string | null;
  status: string;
  isDefault: boolean;
  createdAt: string;
}

export interface WaBroadcast {
  id: number;
  name: string;
  templateName: string | null;
  messageBody: string;
  targetGroupIds: number[] | null;
  status: WaBroadcastStatus;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface WaScrapeResult {
  jobId: number;
  linksFound: number;
  linksNew: number;
  groups: WaGroup[];
}

// ── API fetch functions ──────────────────────────────────────

export async function fetchWaGroups(): Promise<WaGroup[]> {
  const res = await fetch('/api/whatsapp/groups');
  if (!res.ok) return [];
  const data = await res.json();
  return data.groups ?? data ?? [];
}

export async function fetchWaLeads(): Promise<WaLead[]> {
  const res = await fetch('/api/whatsapp/leads');
  if (!res.ok) return [];
  const data = await res.json();
  return data.leads ?? data ?? [];
}

export async function fetchWaTemplates(): Promise<WaTemplate[]> {
  const res = await fetch('/api/whatsapp/templates');
  if (!res.ok) return [];
  const data = await res.json();
  return data.templates ?? data ?? [];
}

export async function fetchWaMessages(leadId: number): Promise<WaMessage[]> {
  const res = await fetch(`/api/whatsapp/leads/${leadId}/messages`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages ?? data ?? [];
}

export async function scrapeWaGroups(keywords: string[], platforms: string[]): Promise<WaScrapeResult> {
  const res = await fetch('/api/whatsapp/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords, platforms }),
  });
  if (!res.ok) throw new Error('Scrape failed');
  return res.json();
}

export async function updateWaGroupStatus(id: number, status: WaGroupStatus): Promise<WaGroup> {
  const res = await fetch(`/api/whatsapp/groups/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

export async function sendBroadcast(payload: {
  name: string;
  messageBody: string;
  targetGroupIds: number[];
  templateId?: number;
}): Promise<WaBroadcast> {
  const res = await fetch('/api/whatsapp/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Broadcast failed');
  return res.json();
}

export async function updateWaLeadType(id: number, type: WaLeadType, status?: WaLeadStatus): Promise<WaLead> {
  const res = await fetch(`/api/whatsapp/leads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...(status ? { status } : {}) }),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}
```

---

## 5. Backend API Routes

Add all of the following routes to `server/routes.ts`. Import the utility modules at the top of the file:

```typescript
import { discoverWhatsAppGroups } from './whatsapp-scraper.js';
import { broadcastToGroups, verifyWebhookToken, processLeadMessage, parseWebhookPayload } from './whatsapp-api.js';
```

### Route Definitions

**`POST /api/whatsapp/scrape`**

```
Body:    { keywords: string[], platforms: string[] }
Returns: { jobId, linksFound, linksNew, groups: WaGroup[] }
```

Logic: Call `discoverWhatsAppGroups({ keywords, platforms, serpApiKey: process.env.SERP_API_KEY, apifyApiKey: process.env.APIFY_API_KEY, useMockIfNoKeys: true })`. For each result, upsert into `wa_groups` (skip if `inviteLink` already exists). Return all newly inserted rows. Create a `wa_scrape_jobs` record with the result counts.

---

**`GET /api/whatsapp/groups`**

```
Query:   ?status=discovered|approved|joined (optional filter)
Returns: { groups: WaGroup[], total: number }
```

Logic: Query `wa_groups` ordered by `createdAt DESC`. Apply status filter if provided.

---

**`PATCH /api/whatsapp/groups/:id/status`**

```
Body:    { status: WaGroupStatus, notes?: string }
Returns: WaGroup (updated record)
```

Logic: Update `wa_groups.status` and optionally `notes`. If the new status is `approved`, log to console that a join attempt would be made (mock for now — real join requires OBA). If status is `joined`, set `joinedAt` to now.

---

**`POST /api/whatsapp/broadcast`**

```
Body:    { name: string, messageBody: string, targetGroupIds: number[], templateId?: number }
Returns: WaBroadcast
```

Logic: Insert a `wa_broadcasts` record with status `sending`. Fetch the `waGroupId` for each group in `targetGroupIds` from `wa_groups`. Call `broadcastToGroups(waGroupIds, messageBody)`. Update the broadcast record with `sentCount` and status `sent`. Return the final broadcast record.

---

**`GET /api/whatsapp/leads`**

```
Query:   ?type=vendor|customer|unknown&status=new|contacted|qualified (optional)
Returns: { leads: WaLead[], total: number }
```

Logic: Query `wa_leads` with optional filters, ordered by `createdAt DESC`. For each lead, also fetch the most recent `wa_messages` record and attach it as `latestMessage`.

---

**`GET /api/whatsapp/leads/:id/messages`**

```
Returns: { messages: WaMessage[] }
```

Logic: Query `wa_messages` where `leadId = :id`, ordered by `sentAt ASC`.

---

**`PATCH /api/whatsapp/leads/:id`**

```
Body:    { type?: WaLeadType, status?: WaLeadStatus, qualificationNotes?: string }
Returns: WaLead (updated record)
```

Logic: Update the specified fields on `wa_leads`. If `type` is set to `vendor` and `status` to `converted`, also create a new record in the `vendors` table using the lead's phone number and name (so they appear in the main Vendor CRM pipeline).

---

**`GET /api/whatsapp/templates`**

```
Returns: { templates: WaTemplate[] }
```

Logic: Query all `wa_templates`. If the table is empty, seed it with the default templates below and return them.

**Default templates to seed on first call:**

```json
[
  {
    "name": "Group Intro — Car Parts",
    "category": "marketing",
    "body": "👋 Hello everyone! We're VOOM Parts — Ghana's new online marketplace for genuine auto spare parts.\n\nFind parts for Toyota, Hyundai, Nissan, Mercedes, and more from verified vendors across Ghana.\n\n🔧 Vendors: List your parts FREE at voomparts.com\n🛒 Buyers: Search 10,000+ parts at voomparts.com\n\nDelivery available across all 16 regions. 🇬🇭",
    "variables": [],
    "isDefault": true
  },
  {
    "name": "Vendor Recruitment",
    "category": "marketing",
    "body": "🚗 Attention spare parts dealers & mechanics in Ghana!\n\nAre you selling auto parts? List your inventory on voomparts.com and reach buyers from Accra, Kumasi, Takoradi, and beyond — for FREE.\n\n✅ Free listing (up to 10 parts)\n✅ WhatsApp buyer inquiries directly to you\n✅ No commission on your first 3 sales\n\nRegister now: voomparts.com/vendor",
    "variables": [],
    "isDefault": false
  },
  {
    "name": "Part Request Promo",
    "category": "marketing",
    "body": "🔍 Can't find the car part you need?\n\nPost a *Part Request* on voomparts.com — describe the part, your car model, and your budget. Verified vendors across Ghana will contact you directly with prices!\n\nNo more calling around. Let the parts come to you. 🇬🇭\n👉 voomparts.com",
    "variables": [],
    "isDefault": false
  }
]
```

---

**`GET /api/webhook/whatsapp` (Webhook Verification)**

```
Query:   hub.mode, hub.verify_token, hub.challenge
Returns: hub.challenge (plain text) if token matches, else 403
```

Logic: `if (req.query['hub.mode'] === 'subscribe' && verifyWebhookToken(req.query['hub.verify_token'])) { res.send(req.query['hub.challenge']); } else { res.sendStatus(403); }`

---

**`POST /api/webhook/whatsapp` (Incoming Messages)**

```
Body:    Meta webhook payload
Returns: 200 OK immediately (process async)
```

Logic:
1. Respond `200 OK` immediately (critical — Meta retries if no fast response).
2. Parse the payload with `parseWebhookPayload(body)`.
3. For each message: find or create a `wa_leads` record by `phone`. Save the message to `wa_messages` with `direction: 'inbound'`.
4. Call `processLeadMessage(phone, text)` to get the bot reply.
5. Save the bot reply to `wa_messages` with `direction: 'outbound'`.
6. If `isComplete` is true and `leadData` is present, update the `wa_leads` record with the qualified `type` and `name`.

---

## 6. Frontend UI Specification

### 6.1 File to Modify

`client/src/components/sections/VendorCRM.tsx`

### 6.2 Tab Switcher

At the very top of the `VendorCRM` component's return statement, add a tab switcher before all existing content:

```tsx
const [crmTab, setCrmTab] = useState<'pipeline' | 'whatsapp'>('pipeline');

// Tab switcher UI
<div style={{
  display: 'flex', gap: '0.5rem', marginBottom: '1.25rem',
  background: 'rgba(79,70,229,0.06)', borderRadius: '0.875rem',
  padding: '0.25rem', width: 'fit-content',
}}>
  {(['pipeline', 'whatsapp'] as const).map(tab => (
    <button
      key={tab}
      onClick={() => setCrmTab(tab)}
      style={{
        padding: '0.4rem 1rem', borderRadius: '0.625rem', border: 'none',
        cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        background: crmTab === tab ? '#4F46E5' : 'transparent',
        color: crmTab === tab ? 'white' : '#64748B',
        transition: 'all 0.15s ease',
      }}
    >
      {tab === 'pipeline' ? '📋 Vendor Pipeline' : '💬 WhatsApp Acquisition'}
    </button>
  ))}
</div>

{crmTab === 'pipeline' && <>{/* existing pipeline JSX */}</>}
{crmTab === 'whatsapp' && <WhatsAppAcquisition />}
```

### 6.3 `WhatsAppAcquisition` Component

Create this as a new file: `client/src/components/sections/WhatsAppAcquisition.tsx`

The component has three internal sub-tabs: **Discovery Radar**, **Group Manager**, and **Lead Inbox**.

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWaGroups, fetchWaLeads, fetchWaTemplates, fetchWaMessages,
  scrapeWaGroups, updateWaGroupStatus, sendBroadcast, updateWaLeadType,
  type WaGroup, type WaLead, type WaTemplate, type WaMessage,
} from '../../lib/voomApi';
import { toast } from 'sonner';

type WaTab = 'discovery' | 'groups' | 'inbox';

export function WhatsAppAcquisition() {
  const [waTab, setWaTab] = useState<WaTab>('discovery');
  // ... render sub-tab switcher and the three sub-components
}
```

---

### 6.4 Sub-Component: `DiscoveryRadar`

**Purpose:** Search for new WhatsApp groups and curate them.

**State:**
```tsx
const [keywords, setKeywords] = useState('Ghana car parts mechanics');
const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook', 'google', 'instagram', 'tiktok']);
const [isScanning, setIsScanning] = useState(false);
```

**Data:**
```tsx
const { data: groups = [], refetch } = useQuery({
  queryKey: ['wa-groups', 'discovered'],
  queryFn: () => fetchWaGroups().then(g => g.filter(x => x.status === 'discovered')),
});
```

**Layout:**

1. **Search Panel** (`GlassSection`):
   - A text input for keywords (pre-filled with `"Ghana car parts mechanics auto enthusiasts"`).
   - A row of platform toggle chips: `Facebook`, `Google`, `Instagram`, `TikTok`, `Reddit`. Each chip toggles inclusion. Active chips use `#4F46E5` background, inactive use `rgba(79,70,229,0.08)`.
   - A "🔍 Scan Web" button (primary, `#4F46E5`). On click: call `scrapeWaGroups(keywords.split(','), selectedPlatforms)`. Show a loading spinner. On success: `toast.success('Found X new groups')` and `refetch()`.

2. **Discovery Queue Table** (`GlassSection`):
   - Header: "Discovery Queue" with a badge showing the count of `discovered` groups.
   - Table columns: `Group Name`, `Source`, `Invite Link` (truncated, clickable), `Keywords`, `Found`, `Actions`.
   - Actions column: **Approve** button (green, `#059669`) and **Reject** button (red, `#E11D48`).
   - On Approve: call `updateWaGroupStatus(id, 'approved')`, show `toast.success`, invalidate `['wa-groups']` query.
   - On Reject: call `updateWaGroupStatus(id, 'rejected')`, show `toast.error('Group rejected')`, invalidate query.
   - Source badge colours: `facebook` → `#1877F2`, `google` → `#4285F4`, `instagram` → `#E1306C`, `tiktok` → `#000000`, `web_directory` → `#64748B`.
   - Empty state: "No groups discovered yet. Run a scan to find WhatsApp groups." with a subtle illustration or icon.

---

### 6.5 Sub-Component: `GroupManager`

**Purpose:** Manage approved and joined groups; send broadcasts.

**State:**
```tsx
const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
const [broadcastMessage, setBroadcastMessage] = useState('');
const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
```

**Data:**
```tsx
const { data: groups = [] } = useQuery({
  queryKey: ['wa-groups', 'active'],
  queryFn: () => fetchWaGroups().then(g => g.filter(x => ['approved', 'joining', 'joined'].includes(x.status))),
});
const { data: templates = [] } = useQuery({
  queryKey: ['wa-templates'],
  queryFn: fetchWaTemplates,
});
```

**Layout:**

1. **Stats Row** — Three metric cards side by side:
   - `Approved Groups` (amber, count of status=approved)
   - `Joined Groups` (emerald, count of status=joined)
   - `Total Broadcasts` (indigo, count from a separate query or derived)

2. **Groups Table** (`GlassSection`):
   - Checkbox column for multi-select.
   - Columns: `Group Name`, `Status`, `Members`, `Source`, `Joined`, `Last Broadcast`, `Actions`.
   - Status badge colours: `approved` → amber, `joining` → blue, `joined` → emerald, `failed` → rose.
   - Actions: A "Join" button (only visible for `approved` status groups) that calls `updateWaGroupStatus(id, 'joining')`.
   - When groups are selected, a sticky action bar appears at the bottom with a "📢 Broadcast to X groups" button.

3. **Broadcast Modal** (use Radix `Dialog`):
   - Title: "Send Broadcast Message"
   - Template selector: A dropdown of `wa_templates`. On selection, populate the message textarea.
   - Message textarea (editable, max 1024 chars). Show character count.
   - Preview panel showing the message as it would appear in WhatsApp (white bubble, dark text, rounded corners, `#DCF8C6` background like WhatsApp).
   - Footer: "Cancel" and "Send Broadcast" buttons. On send: call `sendBroadcast({ name, messageBody, targetGroupIds: selectedGroupIds })`. Show progress toast. On success: `toast.success('Broadcast sent to X groups')`.

---

### 6.6 Sub-Component: `LeadInbox`

**Purpose:** View and qualify inbound leads from WhatsApp groups.

**State:**
```tsx
const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
const [filterType, setFilterType] = useState<'all' | 'vendor' | 'customer' | 'unknown'>('all');
```

**Data:**
```tsx
const { data: leads = [] } = useQuery({
  queryKey: ['wa-leads'],
  queryFn: fetchWaLeads,
  refetchInterval: 30_000, // poll every 30s for new messages
});
const { data: messages = [] } = useQuery({
  queryKey: ['wa-messages', selectedLeadId],
  queryFn: () => selectedLeadId ? fetchWaMessages(selectedLeadId) : Promise.resolve([]),
  enabled: !!selectedLeadId,
});
```

**Layout:**

Split-pane layout (flex row, `gap: 1rem`):

**Left Pane — Lead List** (width: 320px, fixed):
- Filter chips at top: `All`, `Vendors`, `Customers`, `Unknown`.
- Scrollable list of lead cards. Each card shows:
  - Avatar (initials from name, or phone last 4 digits if no name).
  - Name (or phone number if no name).
  - Lead type badge (`vendor` → emerald, `customer` → indigo, `unknown` → slate).
  - Latest message preview (truncated to 60 chars).
  - Time since last message (relative: "2h ago").
  - Unread indicator dot (if `status === 'new'`).
- On click: set `selectedLeadId` to that lead's ID.

**Right Pane — Chat View** (flex: 1):
- If no lead selected: empty state "Select a lead to view the conversation."
- Header: Lead name, phone, type badge, status badge.
- **Quick Actions Bar** (below header):
  - "✅ Mark as Vendor" button → calls `updateWaLeadType(id, 'vendor', 'qualified')`, invalidates `['wa-leads']`.
  - "🛒 Mark as Customer" button → calls `updateWaLeadType(id, 'customer', 'qualified')`.
  - "❌ Dead Lead" button → calls `updateWaLeadType(id, lead.type, 'dead')`.
  - "➕ Add to Vendor CRM" button (only visible if type=vendor) → calls `updateWaLeadType(id, 'vendor', 'converted')` which triggers the backend to create a vendor record.
- **Chat Bubbles** (scrollable, most recent at bottom):
  - Inbound messages: left-aligned, `rgba(241,245,249,0.9)` background.
  - Outbound messages: right-aligned, `rgba(79,70,229,0.1)` background.
  - Each bubble shows content, timestamp, and status icon (✓ sent, ✓✓ delivered, ✓✓ read in blue).

---

## 7. Sidebar Navigation Update

In `client/src/components/Sidebar.tsx`, update the `crm` nav item to add a badge showing the count of new leads:

```tsx
// In NAV_ITEMS, update the crm entry:
{ id: 'crm', label: 'Outreach CRM', icon: <IconCRM />, badge: newLeadsCount }
```

To get `newLeadsCount`, fetch it in `Home.tsx` using a new query:
```tsx
const waLeadsQuery = useQuery({
  queryKey: ['wa-leads-count'],
  queryFn: () => fetch('/api/whatsapp/leads?status=new').then(r => r.json()).then(d => d.total ?? 0),
  refetchInterval: 60_000,
});
```

Pass `newLeadsCount={waLeadsQuery.data ?? 0}` to the `Sidebar` component and update the `Sidebar` props interface accordingly.

---

## 8. Environment Variables

Add the following to `.env.example` and `.env`:

```bash
# ── WhatsApp Business API (Meta Cloud API) ──────────────────
# Get these from: https://developers.facebook.com/apps/
WA_PHONE_NUMBER_ID=           # e.g. 123456789012345
WA_ACCESS_TOKEN=              # Permanent system user token
WA_WEBHOOK_TOKEN=voom_webhook_secret_change_me
WA_BUSINESS_ACCOUNT_ID=       # Your WABA ID

# ── Group Discovery APIs (optional — mock data used if absent) ──
SERP_API_KEY=                 # From https://serpapi.com (free tier: 100 searches/month)
APIFY_API_KEY=                # From https://apify.com (free tier available)
```

---

## 9. Meta WhatsApp API Setup Guide

Include this as a collapsible section inside the `WhatsAppAcquisition` component (visible when API keys are not configured), or as a tooltip on a "Setup Guide" button.

### Step 1 — Create a Meta Developer Account
Go to [developers.facebook.com](https://developers.facebook.com) and log in with a Facebook account. Navigate to **My Apps → Create App → Business**.

### Step 2 — Add WhatsApp to Your App
In the app dashboard, click **Add Product** and select **WhatsApp**. This will create a test WhatsApp Business Account (WABA) automatically.

### Step 3 — Register Your Phone Number
Under **WhatsApp → Getting Started**, add your business phone number. Meta will send a verification code via SMS or voice call. This number must not be registered on any WhatsApp app — it must be a dedicated API number.

### Step 4 — Generate a Permanent Access Token
In **Business Settings → System Users**, create a system user with `FULL_CONTROL` permission over your WABA. Generate a token and save it as `WA_ACCESS_TOKEN`.

### Step 5 — Configure the Webhook
Under **WhatsApp → Configuration**, set the Webhook URL to your deployed server's endpoint: `https://yourdomain.com/api/webhook/whatsapp`. Set the Verify Token to match `WA_WEBHOOK_TOKEN`. Subscribe to: `messages`, `message_deliveries`, `message_reads`, `group_lifecycle_update`, `group_participants_update`.

### Step 6 — Apply for Official Business Account (OBA)
The Groups API requires OBA (green checkmark) status. Apply via **Business Manager → Security Center → Start Verification**. You will need: a registered business name, a business website (voomparts.com qualifies), and a Facebook Business Page. Approval typically takes 3–7 business days.

### Step 7 — Test in Sandbox
Until OBA is approved, use the Meta test number provided in the dashboard to send and receive messages. The mock data in the scraper module allows full UI testing without any API keys.

---

## 10. Acceptance Criteria

The implementation is complete when all of the following are true:

| # | Criterion |
| :--- | :--- |
| 1 | The Outreach CRM section has a tab switcher with "Vendor Pipeline" and "WhatsApp Acquisition" tabs. |
| 2 | The Discovery Radar renders a keyword input, platform toggles, and a Scan button. |
| 3 | Clicking Scan calls `POST /api/whatsapp/scrape` and displays results in the Discovery Queue table. |
| 4 | Approve/Reject buttons update the group status and reflect immediately in the UI. |
| 5 | The Group Manager shows groups with `approved` or `joined` status with correct badges. |
| 6 | The Broadcast modal opens, allows template selection, previews the message, and calls `POST /api/whatsapp/broadcast`. |
| 7 | The Lead Inbox renders a split-pane with a lead list and a chat view. |
| 8 | Clicking a lead shows their message history with correct inbound/outbound bubble styling. |
| 9 | "Mark as Vendor" and "Mark as Customer" buttons update the lead type and show a toast. |
| 10 | "Add to Vendor CRM" converts the lead to a vendor record visible in the Vendor Pipeline tab. |
| 11 | All components use the Arctic Glass design system tokens (no new colours or fonts introduced). |
| 12 | All API routes return mock data gracefully when `WA_PHONE_NUMBER_ID` and `WA_ACCESS_TOKEN` are not set. |
| 13 | The sidebar `crm` nav item shows a badge with the count of new (unread) leads. |
| 14 | The `.env.example` file is updated with all new WhatsApp environment variables. |

---

## 11. File Change Summary

| File | Action |
| :--- | :--- |
| `shared/schema.ts` | ✅ Already updated — new WA tables added |
| `server/whatsapp-scraper.ts` | ✅ Already created |
| `server/whatsapp-api.ts` | ✅ Already created |
| `server/routes.ts` | **Add** — all 9 new `/api/whatsapp/*` routes |
| `client/src/lib/voomApi.ts` | **Add** — WA types and fetch functions |
| `client/src/components/sections/VendorCRM.tsx` | **Modify** — add tab switcher, import `WhatsAppAcquisition` |
| `client/src/components/sections/WhatsAppAcquisition.tsx` | **Create** — main container with sub-tabs |
| `client/src/components/Sidebar.tsx` | **Modify** — add `newLeadsCount` badge prop |
| `client/src/pages/Home.tsx` | **Modify** — add `waLeadsQuery`, pass count to Sidebar |
| `.env.example` | **Modify** — add WA and scraper API key variables |
