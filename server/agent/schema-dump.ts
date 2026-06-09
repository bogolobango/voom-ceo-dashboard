// Hand-written schema dump for Agent A1.
// Lists every table and column the agent can reason about, with one-line meanings.
// This file ships as part of the cached system prompt.
//
// When the marketplace schema changes, update this file.
// Live introspection is deferred to A4.

export const SCHEMA_DUMP = `
TABLE vendors  (~330 rows; admin-approved businesses)
  id                      uuid     primary key
  businessName            text     vendor's trade name
  city                    text     'Accra' | 'Tema' | 'Kumasi' | ...
  status                  enum     'pending' | 'approved' | 'rejected' | 'suspended'
  tier                    enum     'free' | 'starter' | 'pro'
  pipelineStage           enum     'lead' | 'contacted' | 'responded' | 'claimed' | 'active' | 'churned'
  verified                boolean  legacy flag, broken (do not cite)
  featured                boolean  shown on homepage
  createdAt               timestamptz
  // Note: phone, ghanaCardNumber, idDocumentUrl are PII — never include in answers.

TABLE products
  id                      uuid     primary key
  vendorId                uuid     -> vendors.id
  title                   text     listing title
  priceGhsCents           bigint   price in GHS cents
  status                  enum     'active' | 'inactive' | 'sold' | 'archived'
  condition               enum     'new' | 'used' | 'refurbished'
  views                   integer  cumulative view count
  whatsappTaps            integer  cumulative WhatsApp click count
  createdAt               timestamptz

TABLE orders
  id                      uuid     primary key
  vendorId                uuid     -> vendors.id
  buyerCity               text     where the buyer is
  totalGhsCents           bigint
  status                  enum     'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  paymentMethod           text     'remitly' | 'cash' | ...
  createdAt               timestamptz
  deliveredAt             timestamptz

TABLE analytics_events (last 90 days only; everything else aggregated)
  id                      uuid     primary key
  eventType               enum     'product_view' | 'vendor_view' | 'search' | 'whatsapp_tap' | 'filter_used' | 'page_leave' | 'signup_*' | ...
  userId                  uuid     nullable for anon
  metadata                jsonb    event-specific payload
  createdAt               timestamptz

TABLE part_requests
  id                      uuid     primary key
  vehicleMake             text     'Toyota' | 'Honda' | ...
  vehicleModel            text
  budgetGhsCents          bigint
  status                  enum     'open' | 'matched' | 'closed'
  createdAt               timestamptz

TABLE users
  id                      uuid     primary key
  role                    enum     'buyer' | 'vendor' | 'admin'
  createdAt               timestamptz
  // Note: phone, email, passwordHash are PII — never include in answers.

TABLE wa_leads
  id                      uuid     primary key
  source                  text     where the lead came from
  status                  enum     'new' | 'contacted' | 'qualified' | 'lost'
  isTest                  boolean  true for synthetic test rows; default false
  createdAt               timestamptz

GLOSSARY (VOOM business terms):
  - "dormant vendor"   = approved + 0 listings + 14+ days since signup
  - "tier-up"          = vendor moving from free -> starter (or starter -> pro)
  - "48K traffic"      = monthly site visits, NOT users or MAUs
  - "Ghana Card-verified" = DO NOT USE; the verified flag is broken (see vendors.verified note)
  - "real lead"        = wa_leads.isTest = false
  - "GHS"              = Ghana Cedi; amounts are stored in cents (divide by 100 for display)

POSTGRES NOTES:
  - camelCase columns must be double-quoted: "businessName", "createdAt", "eventType"
  - enum columns need ::text cast for LIKE: WHERE "status"::text LIKE 'app%'
  - equality on enums does NOT need cast: WHERE "status" = 'approved'
`.trim();
