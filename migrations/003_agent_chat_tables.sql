-- Migration: Agent A1 chat + query layer tables
-- Run this in the Supabase SQL Editor (Dashboard > SQL > New Query)
--
-- Creates three tables: agent_threads, agent_messages, agent_daily_spend.
-- All A1 chat traffic logs here. Used by A4 for telemetry rollups.

CREATE TABLE IF NOT EXISTS agent_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_threads_last_message
  ON agent_threads(last_message_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content       TEXT NOT NULL,
  tool_calls    JSONB,
  tool_results  JSONB,
  tokens_in     INTEGER,
  tokens_out    INTEGER,
  cost_cents    NUMERIC(10, 4),
  latency_ms    INTEGER,
  feedback      SMALLINT NOT NULL DEFAULT 0 CHECK (feedback IN (-1, 0, 1)),
  page_context  JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_thread
  ON agent_messages(thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_messages_feedback
  ON agent_messages(feedback) WHERE feedback <> 0;

CREATE TABLE IF NOT EXISTS agent_daily_spend (
  day           DATE PRIMARY KEY,
  cents_spent   NUMERIC(10, 4) NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
