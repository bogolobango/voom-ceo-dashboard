-- ================================================================
-- VOOM Ghana — WhatsApp Acquisition Module Migration
-- Run this in your Supabase dashboard → SQL Editor
-- ================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE wa_group_status AS ENUM ('discovered','approved','joining','joined','rejected','left','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wa_lead_type AS ENUM ('unknown','vendor','customer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wa_lead_status AS ENUM ('new','contacted','qualified','converted','dead');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wa_message_direction AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wa_broadcast_status AS ENUM ('draft','pending_approval','approved','sending','sent','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- wa_groups
CREATE TABLE IF NOT EXISTS public.wa_groups (
  id              serial PRIMARY KEY,
  name            varchar(255),
  "inviteLink"    varchar(500) NOT NULL UNIQUE,
  source          varchar(100),
  "sourceUrl"     text,
  keywords        json,
  status          wa_group_status NOT NULL DEFAULT 'discovered',
  "memberCount"   integer DEFAULT 0,
  "waGroupId"     varchar(255),
  "joinedAt"      timestamptz,
  "lastBroadcastAt" timestamptz,
  notes           text,
  "createdAt"     timestamptz NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz NOT NULL DEFAULT now()
);

-- wa_leads
CREATE TABLE IF NOT EXISTS public.wa_leads (
  id                    serial PRIMARY KEY,
  phone                 varchar(30) NOT NULL,
  name                  varchar(255),
  "profilePicUrl"       text,
  type                  wa_lead_type NOT NULL DEFAULT 'unknown',
  status                wa_lead_status NOT NULL DEFAULT 'new',
  "sourceGroupId"       integer REFERENCES public.wa_groups(id),
  "qualificationNotes"  text,
  "convertedVendorId"   integer,
  "lastContactedAt"     timestamptz,
  "createdAt"           timestamptz NOT NULL DEFAULT now(),
  "updatedAt"           timestamptz NOT NULL DEFAULT now()
);

-- wa_messages
CREATE TABLE IF NOT EXISTS public.wa_messages (
  id              serial PRIMARY KEY,
  "leadId"        integer REFERENCES public.wa_leads(id),
  "groupId"       integer REFERENCES public.wa_groups(id),
  "waMessageId"   varchar(255),
  direction       wa_message_direction NOT NULL,
  content         text NOT NULL,
  "mediaUrl"      text,
  status          varchar(30) DEFAULT 'sent',
  "sentAt"        timestamptz NOT NULL DEFAULT now(),
  "deliveredAt"   timestamptz,
  "readAt"        timestamptz
);

-- wa_broadcasts
CREATE TABLE IF NOT EXISTS public.wa_broadcasts (
  id                  serial PRIMARY KEY,
  name                varchar(255) NOT NULL,
  "templateName"      varchar(100),
  "messageBody"       text NOT NULL,
  "targetGroupIds"    json,
  status              wa_broadcast_status NOT NULL DEFAULT 'draft',
  "sentCount"         integer DEFAULT 0,
  "deliveredCount"    integer DEFAULT 0,
  "readCount"         integer DEFAULT 0,
  "scheduledAt"       timestamptz,
  "sentAt"            timestamptz,
  "createdAt"         timestamptz NOT NULL DEFAULT now(),
  "updatedAt"         timestamptz NOT NULL DEFAULT now()
);

-- wa_templates
CREATE TABLE IF NOT EXISTS public.wa_templates (
  id                serial PRIMARY KEY,
  name              varchar(100) NOT NULL,
  category          varchar(50) DEFAULT 'marketing',
  body              text NOT NULL,
  variables         json,
  "metaTemplateId"  varchar(255),
  status            varchar(30) DEFAULT 'local',
  "isDefault"       boolean DEFAULT false,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz NOT NULL DEFAULT now()
);

-- wa_scrape_jobs
CREATE TABLE IF NOT EXISTS public.wa_scrape_jobs (
  id              serial PRIMARY KEY,
  keywords        json NOT NULL,
  platforms       json NOT NULL,
  status          varchar(30) NOT NULL DEFAULT 'pending',
  "linksFound"    integer DEFAULT 0,
  "linksNew"      integer DEFAULT 0,
  "errorMessage"  text,
  "startedAt"     timestamptz,
  "completedAt"   timestamptz,
  "createdAt"     timestamptz NOT NULL DEFAULT now()
);
