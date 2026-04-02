// ============================================================
// VOOM Ghana Marketplace — Full Database Schema (Drizzle ORM)
// ============================================================

import { integer, pgEnum, pgTable, text, timestamp, varchar, decimal, boolean, json, serial } from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["user", "admin", "vendor"]);
export const vendorStatusEnum = pgEnum("vendor_status", ["pending", "approved", "rejected", "suspended"]);
export const productConditionEnum = pgEnum("product_condition", ["new", "used", "refurbished"]);
export const productStatusEnum = pgEnum("product_status", ["active", "inactive", "out_of_stock"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]);
export const paymentMethodEnum = pgEnum("payment_method", ["pay_on_delivery", "mobile_money", "card"]);
export const paymentStatusEnum = pgEnum("payment_status", ["unpaid", "paid", "refunded"]);
export const notificationTypeEnum = pgEnum("notification_type", ["order", "vendor", "system", "inventory"]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["whatsapp_login"]);
export const vendorTierEnum = pgEnum("vendor_tier", ["free", "starter", "pro", "business", "enterprise"]);
export const partRequestStatusEnum = pgEnum("part_request_status", ["open", "fulfilled", "closed"]);
export const analyticsEventTypeEnum = pgEnum("analytics_event_type", [
  "product_view", "whatsapp_tap", "wishlist_add", "cart_add", "search", "order_created",
  "page_view", "session_start",
]);

// ── Users ──────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"),
  role: userRoleEnum("role").default("user").notNull(),
  isVerified: boolean("isVerified").default(false),
  otpCode: varchar("otpCode", { length: 8 }),
  otpExpiresAt: timestamp("otpExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ── OTP Codes ──────────────────────────────────────────────

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull(),
  code: varchar("code", { length: 8 }).notNull(),
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Password Reset Tokens ──────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Vendors ────────────────────────────────────────────────

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  businessName: varchar("businessName", { length: 255 }).notNull(),
  description: text("description"),
  phone: varchar("phone", { length: 20 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 20 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  region: varchar("region", { length: 100 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  logoUrl: text("logoUrl"),
  coverUrl: text("coverUrl"),
  status: vendorStatusEnum("status").default("pending").notNull(),
  verified: boolean("verified").default(false).notNull(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  totalSales: integer("totalSales").default(0),
  ghanaCardNumber: varchar("ghanaCardNumber", { length: 20 }),
  idDocumentUrl: text("idDocumentUrl"),
  businessRegUrl: text("businessRegUrl"),
  tier: vendorTierEnum("tier").default("free").notNull(),
  tierExpiresAt: timestamp("tierExpiresAt"),
  tierTrialUsed: boolean("tierTrialUsed").default(false),
  isFeatured: boolean("isFeatured").default(false),
  featuredUntil: timestamp("featuredUntil"),
  featuredCategoryId: integer("featuredCategoryId"),
  claimToken: varchar("claimToken", { length: 64 }).unique(),
  claimTokenExpiresAt: timestamp("claimTokenExpiresAt"),
  claimStatus: text("claimStatus").default("unclaimed"),
  ghanaCardFrontUrl: text("ghanaCardFrontUrl"),
  ghanaCardBackUrl: text("ghanaCardBackUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ── Categories ─────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  icon: varchar("icon", { length: 50 }),
  parentId: integer("parentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Products ───────────────────────────────────────────────

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendorId").notNull(),
  categoryId: integer("categoryId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("GHS").notNull(),
  sku: varchar("sku", { length: 100 }),
  brand: varchar("brand", { length: 100 }),
  condition: productConditionEnum("condition").default("new").notNull(),
  vehicleMake: varchar("vehicleMake", { length: 100 }),
  vehicleModel: varchar("vehicleModel", { length: 100 }),
  yearFrom: integer("yearFrom"),
  yearTo: integer("yearTo"),
  oemPartNumber: varchar("oemPartNumber", { length: 255 }),
  quantity: integer("quantity").default(0).notNull(),
  minOrderQty: integer("minOrderQty").default(1),
  images: json("images").$type<string[]>(),
  status: productStatusEnum("status").default("active").notNull(),
  featured: boolean("featured").default(false),
  views: integer("views").default(0),
  whatsappTaps: integer("whatsappTaps").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ── Cart Items ─────────────────────────────────────────────

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  productId: integer("productId").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ── Orders ─────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("orderNumber", { length: 20 }).notNull().unique(),
  userId: integer("userId").notNull(),
  vendorId: integer("vendorId").notNull(),
  status: orderStatusEnum("status").default("pending").notNull(),
  paymentMethod: paymentMethodEnum("paymentMethod").default("pay_on_delivery").notNull(),
  paymentStatus: paymentStatusEnum("paymentStatus").default("unpaid").notNull(),
  paymentReference: varchar("paymentReference", { length: 255 }),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("GHS").notNull(),
  shippingAddress: text("shippingAddress"),
  shippingCity: varchar("shippingCity", { length: 100 }),
  shippingRegion: varchar("shippingRegion", { length: 100 }),
  buyerPhone: varchar("buyerPhone", { length: 20 }),
  buyerName: varchar("buyerName", { length: 255 }),
  notes: text("notes"),
  commissionAmount: decimal("commissionAmount", { precision: 12, scale: 2 }),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 4 }).default("0.1200"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ── Order Items ────────────────────────────────────────────

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  productId: integer("productId").notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).notNull(),
});

// ── Reviews ────────────────────────────────────────────────

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  vendorId: integer("vendorId").notNull(),
  productId: integer("productId"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  verifiedPurchase: boolean("verifiedPurchase").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Notifications ──────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: notificationTypeEnum("type").default("system").notNull(),
  read: boolean("read").default(false).notNull(),
  link: varchar("link", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Waitlist ───────────────────────────────────────────────

export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  productId: integer("productId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Vendor Storefronts ─────────────────────────────────────

export const vendorStorefronts = pgTable("vendor_storefronts", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendorId").notNull().unique(),
  bannerUrl: text("bannerUrl"),
  logoUrl: text("logoUrl"),
  tagline: varchar("tagline", { length: 255 }),
  storeDescription: text("storeDescription"),
  operatingHours: text("operatingHours"),
  returnPolicy: text("returnPolicy"),
  specializations: json("specializations").$type<string[]>(),
  socialWhatsapp: varchar("socialWhatsapp", { length: 20 }),
  socialInstagram: varchar("socialInstagram", { length: 100 }),
  socialFacebook: varchar("socialFacebook", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ── Wishlists ──────────────────────────────────────────────

export const wishlists = pgTable("wishlists", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  productId: integer("productId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Part Requests ──────────────────────────────────────────

export const partRequests = pgTable("part_requests", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  guestName: varchar("guestName", { length: 100 }),
  contactPhone: varchar("contactPhone", { length: 20 }).notNull(),
  make: varchar("make", { length: 100 }),
  model: varchar("model", { length: 100 }),
  year: integer("year"),
  partName: varchar("partName", { length: 255 }).notNull(),
  description: text("description"),
  budget: varchar("budget", { length: 50 }),
  status: varchar("status", { length: 20 }).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Analytics Events ───────────────────────────────────────

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  eventType: analyticsEventTypeEnum("eventType").notNull(),
  productId: integer("productId"),
  vendorId: integer("vendorId"),
  userId: integer("userId"),
  visitorId: varchar("visitorId", { length: 64 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Vendor Payouts ─────────────────────────────────────────

export const vendorPayouts = pgTable("vendor_payouts", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendorId").notNull(),
  orderId: integer("orderId"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  flutterwaveRef: varchar("flutterwaveRef", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Subscription Events ────────────────────────────────────

export const subscriptionEvents = pgTable("subscription_events", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendorId").notNull(),
  event: varchar("event", { length: 30 }).notNull(),
  fromTier: varchar("fromTier", { length: 20 }),
  toTier: varchar("toTier", { length: 20 }),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Rate Limits ────────────────────────────────────────────

export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 255 }).primaryKey(),
  count: integer("count").notNull().default(1),
  resetAt: timestamp("resetAt").notNull(),
});

// ── Admin Audit Logs ───────────────────────────────────────

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actorId").notNull(),
  actorRole: varchar("actorRole", { length: 20 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("targetType", { length: 50 }),
  targetId: integer("targetId"),
  previousState: json("previousState"),
  newState: json("newState"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Processed Webhooks (idempotency) ───────────────────────

export const processedWebhooks = pgTable("processed_webhooks", {
  eventId: varchar("eventId", { length: 255 }).primaryKey(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

// ── Type Exports ───────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type PartRequest = typeof partRequests.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type VendorPayout = typeof vendorPayouts.$inferSelect;
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;

// ── WhatsApp Acquisition ────────────────────────────────────

export const waGroupStatusEnum = pgEnum("wa_group_status", ["discovered", "approved", "joining", "joined", "rejected", "left", "failed"]);
export const waLeadTypeEnum = pgEnum("wa_lead_type", ["unknown", "vendor", "customer"]);
export const waLeadStatusEnum = pgEnum("wa_lead_status", ["new", "contacted", "qualified", "converted", "dead"]);
export const waMessageDirectionEnum = pgEnum("wa_message_direction", ["inbound", "outbound"]);
export const waBroadcastStatusEnum = pgEnum("wa_broadcast_status", ["draft", "pending_approval", "approved", "sending", "sent", "failed"]);

export const waGroups = pgTable("wa_groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  inviteLink: varchar("inviteLink", { length: 500 }).notNull().unique(),
  source: varchar("source", { length: 100 }),
  sourceUrl: text("sourceUrl"),
  keywords: json("keywords").$type<string[]>(),
  status: waGroupStatusEnum("status").default("discovered").notNull(),
  memberCount: integer("memberCount").default(0),
  waGroupId: varchar("waGroupId", { length: 255 }),
  joinedAt: timestamp("joinedAt"),
  lastBroadcastAt: timestamp("lastBroadcastAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const waLeads = pgTable("wa_leads", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 30 }).notNull(),
  name: varchar("name", { length: 255 }),
  profilePicUrl: text("profilePicUrl"),
  type: waLeadTypeEnum("type").default("unknown").notNull(),
  status: waLeadStatusEnum("status").default("new").notNull(),
  sourceGroupId: integer("sourceGroupId"),
  qualificationNotes: text("qualificationNotes"),
  convertedVendorId: integer("convertedVendorId"),
  lastContactedAt: timestamp("lastContactedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const waMessages = pgTable("wa_messages", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId"),
  groupId: integer("groupId"),
  waMessageId: varchar("waMessageId", { length: 255 }),
  direction: waMessageDirectionEnum("direction").notNull(),
  content: text("content").notNull(),
  mediaUrl: text("mediaUrl"),
  status: varchar("status", { length: 30 }).default("sent"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
});

export const waBroadcasts = pgTable("wa_broadcasts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  templateName: varchar("templateName", { length: 100 }),
  messageBody: text("messageBody").notNull(),
  targetGroupIds: json("targetGroupIds").$type<number[]>(),
  status: waBroadcastStatusEnum("status").default("draft").notNull(),
  sentCount: integer("sentCount").default(0),
  deliveredCount: integer("deliveredCount").default(0),
  readCount: integer("readCount").default(0),
  scheduledAt: timestamp("scheduledAt"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const waTemplates = pgTable("wa_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).default("marketing"),
  body: text("body").notNull(),
  variables: json("variables").$type<string[]>(),
  metaTemplateId: varchar("metaTemplateId", { length: 255 }),
  status: varchar("status", { length: 30 }).default("local"),
  isDefault: boolean("isDefault").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const waScrapeJobs = pgTable("wa_scrape_jobs", {
  id: serial("id").primaryKey(),
  keywords: json("keywords").$type<string[]>().notNull(),
  platforms: json("platforms").$type<string[]>().notNull(),
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  linksFound: integer("linksFound").default(0),
  linksNew: integer("linksNew").default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
