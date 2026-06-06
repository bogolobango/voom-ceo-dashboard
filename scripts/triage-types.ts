import { z } from "zod";

export const BUCKETS = [
  "NEW_VENDOR_M2",
  "NEW_VENDOR_M3",
  "NEW_VENDOR_M4",
  "NEW_VENDOR_M5",
  "NEW_VENDOR_FOLLOWUP_D2",
  "BUYER_DISCOVERY",
  "BUYER_BROWSE",
  "BUYER_SPECIFIC_REQUEST",
  "RETURNING_VENDOR",
  "VENDOR_QUESTION",
  "OBJECTION_PRICE",
  "OBJECTION_PAYMENT",
  "OBJECTION_TIME",
  "OBJECTION_TRUST",
  "SPAM_OR_NOISE",
] as const;

export const NEXT_ACTIONS = [
  "MANUAL_LIST_FIRST_PART",
  "SEND_M4_AFTER_LIST",
  "FOLLOWUP_D2",
  "ESCALATE_JUSTICE",
  "ESCALATE_KOFI",
  "NONE",
] as const;

export const STEPS = ["M2", "M3", "M4", "M5", "FOLLOWUP_D2"] as const;
export const OBJECTION_BRANCHES = ["PRICE", "PAYMENT", "TIME", "TRUST"] as const;

export const ExtractedSchema = z.object({
  parts_type: z.string().nullable(),
  shop_name: z.string().nullable(),
  location: z.string().nullable(),
  momo: z.string().nullable(),
  part_for_listing: z.string().nullable(),
  buyer_part_requested: z.string().nullable(),
  buyer_car: z.string().nullable(),
  buyer_region: z.string().nullable(),
});

export const TriageEntrySchema = z.object({
  ts: z.string(),
  thread_id: z.string(),
  sender_name: z.string(),
  bucket: z.enum(BUCKETS),
  step: z.enum(STEPS).nullable(),
  objection_branch: z.enum(OBJECTION_BRANCHES).nullable(),
  extracted: ExtractedSchema,
  draft_text: z.string(),
  draft_text_edited: z.string().nullable(),
  draft_sent: z.boolean(),
  draft_edited_by_jim: z.boolean(),
  next_action: z.enum(NEXT_ACTIONS),
  notes: z.string(),
});

export type TriageEntry = z.infer<typeof TriageEntrySchema>;
export type Bucket = (typeof BUCKETS)[number];
export type NextAction = (typeof NEXT_ACTIONS)[number];
