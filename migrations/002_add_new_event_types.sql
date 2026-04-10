-- Migration: Add new analytics event types
-- Run this in the Supabase SQL Editor (Dashboard > SQL > New Query)
--
-- The marketplace now tracks 3 new event types. The DB enum needs
-- to accept them or INSERT will fail with an invalid enum error.

ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'vendor_view';
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'filter_used';
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'page_leave';
