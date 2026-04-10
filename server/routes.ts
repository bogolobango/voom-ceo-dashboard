import express, { Router } from "express";
import NodeCache from "node-cache";
import { randomBytes } from "crypto";
import { supabase } from "./supabase.js";
import { safeLogError } from "./index.js";
import { discoverWhatsAppGroups } from "./whatsapp-scraper.js";
import { broadcastToGroups, verifyWebhookToken, processLeadMessage, parseWebhookPayload, sendTextMessage } from "./whatsapp-api.js";
import { loadWaConfig, saveWaConfig } from "./wa-config.js";

const router = Router();

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const CACHE_KEYS = {
  stats: "api:stats",
  revenue: "api:revenue",
  growth: "api:growth",
  categories: "api:categories",
  briefing: "api:briefing",
  vendorHealth: "api:vendor-health",
};

const MAX_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 500;

function parsePagination(query: Record<string, any>) {
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const offset = Math.max(0, parseInt(query.offset, 10) || 0);
  return { limit, offset };
}

function dbUnavailable(res: any): boolean {
  if (!supabase) {
    res.json({ source: "offline" });
    return true;
  }
  return false;
}

function isTableMissing(error: any): boolean {
  const msg: string = error?.message || error?.details || "";
  return msg.includes("schema cache") || msg.includes("does not exist") || error?.code === "42P01" || error?.code === "PGRST116";
}

// ─── Dashboard Stats ────────────────────────────────────────

router.get("/api/stats", async (_req, res) => {
  if (dbUnavailable(res)) return;
  const cached = cache.get(CACHE_KEYS.stats);
  if (cached) return res.json(cached);

  try {
    const [
      { count: totalUsers },
      { count: totalVendors },
      { count: totalProducts },
      { count: totalOrders },
      { count: totalCategories },
      { count: totalPartRequests },
    ] = await Promise.all([
      supabase!.from("users").select("*", { count: "exact", head: true }),
      supabase!.from("vendors").select("*", { count: "exact", head: true }),
      supabase!.from("products").select("*", { count: "exact", head: true }),
      supabase!.from("orders").select("*", { count: "exact", head: true }),
      supabase!.from("categories").select("*", { count: "exact", head: true }),
      supabase!.from("part_requests").select("*", { count: "exact", head: true }),
    ]);

    const { count: pendingVendors } = await supabase!
      .from("vendors")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { data: revenueData } = await supabase!
      .from("orders")
      .select("totalAmount, commissionAmount");

    const totalRevenue = (revenueData || []).reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);
    const totalCommission = (revenueData || []).reduce((sum: number, o: any) => sum + (Number(o.commissionAmount) || 0), 0);

    const result = {
      source: "database",
      totalUsers: totalUsers ?? 0,
      totalVendors: totalVendors ?? 0,
      totalProducts: totalProducts ?? 0,
      totalOrders: totalOrders ?? 0,
      totalCategories: totalCategories ?? 0,
      totalPartRequests: totalPartRequests ?? 0,
      pendingVendors: pendingVendors ?? 0,
      totalRevenue: String(totalRevenue),
      totalCommission: String(totalCommission),
    };
    cache.set(CACHE_KEYS.stats, result);
    res.json(result);
  } catch (error) {
    safeLogError("Stats query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Vendors ────────────────────────────────────────────────

router.get("/api/vendors", async (req, res) => {
  if (dbUnavailable(res)) return;
  const { limit, offset } = parsePagination(req.query);

  try {
    const { data: allVendors, error } = await supabase!
      .from("vendors")
      .select("id, userId, businessName, phone, whatsapp, city, region, status, verified, rating, totalSales, tier, isFeatured, claimToken, claimTokenExpiresAt, claimStatus, createdAt")
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const vendorIds = (allVendors || []).map((v: any) => v.id);
    let productMap = new Map<number, number>();
    let orderMap = new Map<number, { count: number; revenue: number }>();

    if (vendorIds.length > 0) {
      const { data: productCounts } = await supabase!
        .from("products")
        .select("vendorId")
        .in("vendorId", vendorIds);

      for (const p of productCounts || []) {
        productMap.set(p.vendorId, (productMap.get(p.vendorId) || 0) + 1);
      }

      const { data: orderRows } = await supabase!
        .from("orders")
        .select("vendorId, totalAmount")
        .in("vendorId", vendorIds);

      for (const o of orderRows || []) {
        const existing = orderMap.get(o.vendorId) || { count: 0, revenue: 0 };
        orderMap.set(o.vendorId, {
          count: existing.count + 1,
          revenue: existing.revenue + (Number(o.totalAmount) || 0),
        });
      }
    }

    const vendorData = (allVendors || []).map((v: any) => {
      const oStats = orderMap.get(v.id);
      return {
        id: v.id,
        userId: v.userId ?? null,
        businessName: v.businessName,
        phone: v.phone,
        whatsapp: v.whatsapp,
        city: v.city,
        region: v.region,
        status: v.status,
        verified: v.verified,
        rating: v.rating != null ? String(v.rating) : null,
        totalSales: v.totalSales || 0,
        totalRevenue: oStats?.revenue ?? 0,
        totalListings: productMap.get(v.id) || 0,
        tier: v.tier,
        isFeatured: v.isFeatured,
        claimToken: v.claimToken ?? null,
        claimTokenExpiresAt: v.claimTokenExpiresAt ?? null,
        claimStatus: v.claimStatus ?? 'unclaimed',
        createdAt: v.createdAt,
      };
    });

    res.json({ source: "database", data: vendorData, pagination: { limit, offset } });
  } catch (error) {
    safeLogError("Vendors query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Orders ─────────────────────────────────────────────────

router.get("/api/orders", async (req, res) => {
  if (dbUnavailable(res)) return;
  const { limit, offset } = parsePagination(req.query);

  try {
    const { data: rows, error } = await supabase!
      .from("orders")
      .select("id, orderNumber, totalAmount, commissionAmount, currency, status, paymentMethod, paymentStatus, shippingCity, shippingRegion, buyerName, buyerPhone, vendorId, createdAt")
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const vendorIds = [...new Set((rows || []).map((o: any) => o.vendorId).filter(Boolean))];
    let vendorNameMap = new Map<number, string>();

    if (vendorIds.length > 0) {
      const { data: vendorNames } = await supabase!
        .from("vendors")
        .select("id, businessName")
        .in("id", vendorIds);
      for (const v of vendorNames || []) {
        vendorNameMap.set(v.id, v.businessName);
      }
    }

    const orderData = (rows || []).map((o: any) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      totalAmount: String(o.totalAmount),
      commissionAmount: o.commissionAmount ? String(o.commissionAmount) : null,
      currency: o.currency,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      shippingCity: o.shippingCity,
      shippingRegion: o.shippingRegion,
      buyerName: o.buyerName,
      buyerPhone: o.buyerPhone,
      vendorName: vendorNameMap.get(o.vendorId) || null,
      createdAt: o.createdAt,
    }));

    res.json({ source: "database", data: orderData, pagination: { limit, offset } });
  } catch (error) {
    safeLogError("Orders query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Products ───────────────────────────────────────────────

router.get("/api/products", async (req, res) => {
  if (dbUnavailable(res)) return;
  const { limit, offset } = parsePagination(req.query);

  try {
    const { data: allProducts, error } = await supabase!
      .from("products")
      .select("id, vendorId, categoryId, name, price, currency, brand, condition, vehicleMake, vehicleModel, oemPartNumber, quantity, status, views, whatsappTaps, createdAt")
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const catIds = [...new Set((allProducts || []).map((p: any) => p.categoryId).filter(Boolean))];
    let catNameMap = new Map<number, string>();

    if (catIds.length > 0) {
      const { data: cats } = await supabase!
        .from("categories")
        .select("id, name")
        .in("id", catIds);
      for (const c of cats || []) catNameMap.set(c.id, c.name);
    }

    const productData = (allProducts || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: String(p.price),
      currency: p.currency,
      brand: p.brand,
      condition: p.condition,
      vehicleMake: p.vehicleMake,
      vehicleModel: p.vehicleModel,
      oemPartNumber: p.oemPartNumber ?? null,
      quantity: p.quantity,
      status: p.status,
      views: p.views,
      whatsappTaps: p.whatsappTaps,
      categoryName: catNameMap.get(p.categoryId) || null,
      vendorId: p.vendorId,
      createdAt: p.createdAt,
    }));

    res.json({ source: "database", data: productData, pagination: { limit, offset } });
  } catch (error) {
    safeLogError("Products query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Categories ─────────────────────────────────────────────

router.get("/api/categories", async (_req, res) => {
  if (dbUnavailable(res)) return;
  const cached = cache.get(CACHE_KEYS.categories);
  if (cached) return res.json(cached);

  try {
    const { data: allCategories, error } = await supabase!
      .from("categories")
      .select("id, name, slug, icon, parentId")
      .order("name");

    if (error) throw error;

    const { data: prodCounts } = await supabase!
      .from("products")
      .select("categoryId");

    const countMap = new Map<number, number>();
    for (const p of prodCounts || []) {
      if (p.categoryId) countMap.set(p.categoryId, (countMap.get(p.categoryId) || 0) + 1);
    }

    const data = (allCategories || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      parentId: c.parentId,
      productCount: countMap.get(c.id) || 0,
    }));

    const result = { source: "database", data };
    cache.set(CACHE_KEYS.categories, result);
    res.json(result);
  } catch (error) {
    safeLogError("Categories query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Part Requests ──────────────────────────────────────────

router.get("/api/part-requests", async (req, res) => {
  if (dbUnavailable(res)) return;
  const { limit, offset } = parsePagination(req.query);

  try {
    const { data: allRequests, error } = await supabase!
      .from("part_requests")
      .select("id, guestName, contactPhone, make, model, year, partName, description, budget, status, createdAt")
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const data = (allRequests || []).map((r: any) => ({
      id: r.id,
      guestName: r.guestName,
      contactPhone: r.contactPhone,
      make: r.make,
      model: r.model,
      year: r.year,
      partName: r.partName,
      description: r.description,
      budget: r.budget,
      status: r.status,
      createdAt: r.createdAt,
    }));

    res.json({ source: "database", data, pagination: { limit, offset } });
  } catch (error) {
    safeLogError("Part requests query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Revenue Analytics ──────────────────────────────────────

router.get("/api/revenue", async (_req, res) => {
  if (dbUnavailable(res)) return;
  const cached = cache.get(CACHE_KEYS.revenue);
  if (cached) return res.json(cached);

  try {
    const { data: allOrders } = await supabase!
      .from("orders")
      .select("totalAmount, commissionAmount, status, paymentMethod, shippingRegion, createdAt");

    const orders = allOrders || [];
    const totalRevenue = orders.reduce((s: number, o: any) => s + (Number(o.totalAmount) || 0), 0);
    const totalCommission = orders.reduce((s: number, o: any) => s + (Number(o.commissionAmount) || 0), 0);

    const byStatusMap = new Map<string, { total: number; count: number }>();
    const byPaymentMap = new Map<string, { total: number; count: number }>();
    const byRegionMap = new Map<string, { total: number; count: number }>();
    const dailyMap = new Map<string, { revenue: number; commission: number; orders: number }>();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const o of orders) {
      const status = o.status || "unknown";
      const bs = byStatusMap.get(status) || { total: 0, count: 0 };
      byStatusMap.set(status, { total: bs.total + Number(o.totalAmount || 0), count: bs.count + 1 });

      const method = o.paymentMethod || "unknown";
      const bm = byPaymentMap.get(method) || { total: 0, count: 0 };
      byPaymentMap.set(method, { total: bm.total + Number(o.totalAmount || 0), count: bm.count + 1 });

      const region = o.shippingRegion || "Unknown";
      const br = byRegionMap.get(region) || { total: 0, count: 0 };
      byRegionMap.set(region, { total: br.total + Number(o.totalAmount || 0), count: br.count + 1 });

      if (o.createdAt >= thirtyDaysAgo) {
        const date = o.createdAt.slice(0, 10);
        const bd = dailyMap.get(date) || { revenue: 0, commission: 0, orders: 0 };
        dailyMap.set(date, {
          revenue: bd.revenue + Number(o.totalAmount || 0),
          commission: bd.commission + Number(o.commissionAmount || 0),
          orders: bd.orders + 1,
        });
      }
    }

    const result = {
      source: "database",
      data: {
        totalRevenue,
        totalCommission,
        byStatus: [...byStatusMap.entries()].map(([status, v]) => ({ status, total: String(v.total), count: v.count })),
        byPaymentMethod: [...byPaymentMap.entries()].map(([method, v]) => ({ method, total: v.total, count: v.count })),
        byRegion: [...byRegionMap.entries()]
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 10)
          .map(([region, v]) => ({ region, total: v.total, count: v.count })),
        dailyRevenue: [...dailyMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, v]) => ({ date, revenue: v.revenue, commission: v.commission, orders: v.orders })),
      },
    };
    cache.set(CACHE_KEYS.revenue, result, 600);
    res.json(result);
  } catch (error) {
    safeLogError("Revenue query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Growth Analytics ───────────────────────────────────────

router.get("/api/growth", async (_req, res) => {
  if (dbUnavailable(res)) return;
  const cached = cache.get(CACHE_KEYS.growth);
  if (cached) return res.json(cached);

  try {
    const [{ data: vendorsRaw }, { data: ordersRaw }, { data: productsRaw }, { data: tierRaw }] = await Promise.all([
      // Only count approved vendors for growth (pending/rejected inflate the number)
      supabase!.from("vendors").select("createdAt, tier").eq("status", "approved"),
      // Only count non-cancelled orders for growth
      supabase!.from("orders").select("createdAt, totalAmount").neq("status", "cancelled"),
      supabase!.from("products").select("createdAt"),
      supabase!.from("vendors").select("tier").eq("status", "approved"),
    ]);

    const monthKey = (d: string) => d.slice(0, 7);

    const vendorByMonth = new Map<string, number>();
    for (const v of vendorsRaw || []) {
      const m = monthKey(v.createdAt);
      vendorByMonth.set(m, (vendorByMonth.get(m) || 0) + 1);
    }

    const orderByMonth = new Map<string, { count: number; revenue: number }>();
    for (const o of ordersRaw || []) {
      const m = monthKey(o.createdAt);
      const existing = orderByMonth.get(m) || { count: 0, revenue: 0 };
      orderByMonth.set(m, { count: existing.count + 1, revenue: existing.revenue + Number(o.totalAmount || 0) });
    }

    const productByMonth = new Map<string, number>();
    for (const p of productsRaw || []) {
      const m = monthKey(p.createdAt);
      productByMonth.set(m, (productByMonth.get(m) || 0) + 1);
    }

    const tierCount = new Map<string, number>();
    for (const v of tierRaw || []) {
      const t = v.tier || "none";
      tierCount.set(t, (tierCount.get(t) || 0) + 1);
    }

    const result = {
      source: "database",
      data: {
        vendorGrowth: [...vendorByMonth.entries()].sort().map(([month, count]) => ({ month, count })),
        orderGrowth: [...orderByMonth.entries()].sort().map(([month, v]) => ({ month, count: v.count, revenue: v.revenue })),
        productGrowth: [...productByMonth.entries()].sort().map(([month, count]) => ({ month, count })),
        tierDistribution: [...tierCount.entries()].map(([tier, count]) => ({ tier, count })),
      },
    };
    cache.set(CACHE_KEYS.growth, result, 900);
    res.json(result);
  } catch (error) {
    safeLogError("Growth query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Health Check ────────────────────────────────────────────

router.get("/api/health", async (_req, res) => {
  if (!supabase) {
    return res.json({
      status: "ok",
      database: "not_configured",
      hint: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables",
    });
  }
  try {
    const { count, error } = await supabase.from("users").select("*", { count: "exact", head: true });
    if (error) throw error;
    res.json({ status: "ok", database: "connected", userCount: count });
  } catch (error: any) {
    safeLogError("Health check error", error);
    res.json({ status: "ok", database: "error", error: "Database connection failed" });
  }
});

// ─── Morning Briefing ───────────────────────────────────────

// Monthly subscription prices in GH₵. Override via TIER_PRICES_JSON env var.
// Example: TIER_PRICES_JSON='{"starter":150,"pro":250,"business":900,"enterprise":2500}'
const TIER_PRICES: Record<string, number> = process.env.TIER_PRICES_JSON
  ? JSON.parse(process.env.TIER_PRICES_JSON)
  : { starter: 100, pro: 200, business: 800, enterprise: 2000 };

router.get("/api/briefing", async (_req, res) => {
  if (dbUnavailable(res)) return;
  const cached = cache.get(CACHE_KEYS.briefing);
  if (cached) return res.json(cached);

  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const yesterdayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 86400000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 86400000).toISOString();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000).toISOString();
    const nowISO = now.toISOString();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // All queries in a single Promise.all for minimum latency
    const [
      { count: todaySearches },
      { count: todayWhatsappTaps },
      { count: todayProductViews },
      { count: todayNewVendors },
      { count: todayPartRequests },
      { count: yesterdaySearches },
      { count: yesterdayWhatsappTaps },
      { count: yesterdayProductViews },
      { count: yesterdayNewVendors },
      { count: yesterdayPartRequests },
      { data: recentSearchEvents },
      { data: expiringVendorsRaw },
      { data: paidVendorsRaw },
      { count: todayNewUsers },
      { count: totalUsers },
      { count: yesterdayNewUsers },
      { data: productViewEvents },
    ] = await Promise.all([
      supabase!.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "search").gte("createdAt", todayStart),
      supabase!.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "whatsapp_tap").gte("createdAt", todayStart),
      supabase!.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "product_view").gte("createdAt", todayStart),
      supabase!.from("vendors").select("*", { count: "exact", head: true }).gte("createdAt", todayStart),
      supabase!.from("part_requests").select("*", { count: "exact", head: true }).gte("createdAt", todayStart),
      supabase!.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "search").gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
      supabase!.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "whatsapp_tap").gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
      supabase!.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "product_view").gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
      supabase!.from("vendors").select("*", { count: "exact", head: true }).gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
      supabase!.from("part_requests").select("*", { count: "exact", head: true }).gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
      supabase!.from("analytics_events").select("metadata").eq("eventType", "search").gte("createdAt", twentyFourHoursAgo),
      supabase!.from("vendors").select("id, businessName, tier, tierExpiresAt, tierTrialUsed").neq("tier", "free").gte("tierExpiresAt", nowISO).lte("tierExpiresAt", sevenDaysFromNow),
      supabase!.from("vendors").select("userId, tier, tierExpiresAt, status").neq("tier", "free"),
      supabase!.from("users").select("*", { count: "exact", head: true }).gte("createdAt", todayStart),
      supabase!.from("users").select("*", { count: "exact", head: true }),
      supabase!.from("users").select("*", { count: "exact", head: true }).gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
      supabase!.from("analytics_events").select("productId").eq("eventType", "product_view").gte("createdAt", thirtyDaysAgo).not("productId", "is", null),
    ]);

    // Process search events
    const queryCountMap = new Map<string, number>();
    const queryResultMap = new Map<string, number>();
    const zeroResultMap = new Map<string, number>();
    for (const evt of recentSearchEvents || []) {
      const meta = evt.metadata as Record<string, unknown> | null;
      if (!meta) continue;
      const query = meta.query as string | undefined;
      if (!query) continue;
      queryCountMap.set(query, (queryCountMap.get(query) || 0) + 1);
      const resultCount = (meta.resultCount ?? meta.results ?? 0) as number;
      queryResultMap.set(query, resultCount);
      if (resultCount === 0) {
        zeroResultMap.set(query, (zeroResultMap.get(query) || 0) + 1);
      }
    }
    const topSearches = [...queryCountMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count, results: queryResultMap.get(query) ?? 0 }));
    const zeroResultSearches = [...zeroResultMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([query, count]) => ({ query, count }));

    const expiringVendors = (expiringVendorsRaw || []).map((v: any) => ({
      id: v.id,
      businessName: v.businessName,
      tier: v.tier,
      tierExpiresAt: v.tierExpiresAt,
      tierTrialUsed: v.tierTrialUsed ?? false,
    }));

    // MRR: only count vendors who are approved AND have a real userId (excludes test accounts)
    // A vendor with userId=0 is a test/placeholder account
    let activePaidVendors = 0;
    let mrr = 0;
    for (const v of paidVendorsRaw || []) {
      // Skip test accounts (userId null/0 or not approved)
      if (!v.userId || v.userId === 0 || (v.status && v.status !== "approved")) continue;
      if (!v.tierExpiresAt || v.tierExpiresAt > nowISO) {
        activePaidVendors++;
        mrr += TIER_PRICES[v.tier] || 0;
      }
    }

    // Top product categories by 30-day views
    let topCategories: { name: string; views: number }[] = [];
    const productIdCounts = new Map<number, number>();
    for (const evt of productViewEvents || []) {
      const pid = (evt as any).productId;
      if (pid) productIdCounts.set(pid, (productIdCounts.get(pid) || 0) + 1);
    }
    const topProductIds = [...productIdCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id]) => id);
    if (topProductIds.length > 0) {
      const { data: productsData } = await supabase!.from("products").select("id, categoryId").in("id", topProductIds);
      if (productsData && productsData.length > 0) {
        const catCounts = new Map<number, number>();
        for (const p of productsData as any[]) {
          if (p.categoryId) catCounts.set(p.categoryId, (catCounts.get(p.categoryId) || 0) + (productIdCounts.get(p.id) || 0));
        }
        const topCatIds = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
        if (topCatIds.length > 0) {
          const { data: catsData } = await supabase!.from("categories").select("id, name").in("id", topCatIds);
          topCategories = topCatIds.map(id => ({
            name: (catsData as any[])?.find((c) => c.id === id)?.name || `Category ${id}`,
            views: catCounts.get(id) || 0,
          }));
        }
      }
    }

    const result = {
      source: "database",
      data: {
        todaySearches: todaySearches ?? 0,
        todayWhatsappTaps: todayWhatsappTaps ?? 0,
        todayProductViews: todayProductViews ?? 0,
        todayNewVendors: todayNewVendors ?? 0,
        todayPartRequests: todayPartRequests ?? 0,
        yesterdaySearches: yesterdaySearches ?? 0,
        yesterdayWhatsappTaps: yesterdayWhatsappTaps ?? 0,
        yesterdayProductViews: yesterdayProductViews ?? 0,
        yesterdayNewVendors: yesterdayNewVendors ?? 0,
        yesterdayPartRequests: yesterdayPartRequests ?? 0,
        todayNewUsers: todayNewUsers ?? 0,
        yesterdayNewUsers: yesterdayNewUsers ?? 0,
        totalUsers: totalUsers ?? 0,
        topSearches,
        zeroResultSearches,
        expiringVendors,
        activePaidVendors,
        mrr,
        topCategories,
      },
    };
    cache.set(CACHE_KEYS.briefing, result, 300);
    res.json(result);
  } catch (error) {
    safeLogError("Briefing query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Analytics Events ───────────────────────────────────────

router.get("/api/analytics-events", async (req, res) => {
  if (dbUnavailable(res)) return;
  const { limit, offset } = parsePagination(req.query);

  try {
    const { data: events, error } = await supabase!
      .from("analytics_events")
      .select("id, eventType, metadata, createdAt")
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({ source: "database", data: events || [], pagination: { limit, offset } });
  } catch (error) {
    safeLogError("Analytics events query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Analytics: Users ───────────────────────────────────────

router.get("/api/analytics/users/:id", async (req, res) => {
  if (dbUnavailable(res)) return;
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

  try {
    const [{ data: userData }, { data: activityData }] = await Promise.all([
      supabase!.from("users").select("id, openId, name, email, phone, loginMethod, role, isVerified, createdAt, updatedAt, lastSignedIn").eq("id", userId).single(),
      supabase!.from("analytics_events").select("id, eventType, productId, metadata, createdAt").eq("userId", userId).order("createdAt", { ascending: false }).limit(150),
    ]);

    const productIds = [...new Set(((activityData || []) as any[]).filter(e => e.productId).map(e => e.productId))];
    const productNames: Record<number, string> = {};
    if (productIds.length > 0) {
      const { data: prods } = await supabase!.from("products").select("id, name").in("id", productIds);
      for (const p of (prods || []) as any[]) productNames[p.id] = p.name;
    }

    const activity = ((activityData || []) as any[]).map(e => ({
      id: e.id, eventType: e.eventType, productId: e.productId,
      productName: e.productId ? (productNames[e.productId] || null) : null,
      metadata: e.metadata, createdAt: e.createdAt,
    }));

    res.json({ source: "database", data: { user: userData, activity } });
  } catch (error) {
    safeLogError("User detail query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.get("/api/analytics/users", async (_req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const [{ data: usersData }, { data: eventsData }] = await Promise.all([
      supabase!.from("users").select("id, openId, name, email, phone, loginMethod, role, isVerified, createdAt, updatedAt, lastSignedIn").order("createdAt", { ascending: false }),
      supabase!.from("analytics_events").select("userId, eventType, createdAt").order("createdAt", { ascending: false }),
    ]);

    const userActivity = new Map<number, { views: number; searches: number; waTaps: number; total: number; lastSeen: string | null }>();
    for (const evt of (eventsData || []) as any[]) {
      if (!evt.userId) continue;
      if (!userActivity.has(evt.userId)) userActivity.set(evt.userId, { views: 0, searches: 0, waTaps: 0, total: 0, lastSeen: null });
      const u = userActivity.get(evt.userId)!;
      u.total++;
      if (!u.lastSeen || evt.createdAt > u.lastSeen) u.lastSeen = evt.createdAt;
      if (evt.eventType === "product_view") u.views++;
      else if (evt.eventType === "search") u.searches++;
      else if (evt.eventType === "whatsapp_tap") u.waTaps++;
    }

    const users = ((usersData || []) as any[]).map(u => ({
      ...u,
      activityCounts: userActivity.get(u.id) || { views: 0, searches: 0, waTaps: 0, total: 0, lastSeen: null },
    }));

    res.json({ source: "database", data: users });
  } catch (error) {
    safeLogError("Analytics users query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Analytics: Update User Role ────────────────────────────

router.patch("/api/analytics/users/:id/role", async (req, res) => {
  if (dbUnavailable(res)) return;
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });
  const { role } = req.body;
  const validRoles = ["user", "vendor", "driver", "admin"];
  if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role. Must be one of: " + validRoles.join(", ") });
  try {
    const { error } = await supabase!.from("users")
      .update({ role, updatedAt: new Date().toISOString() })
      .eq("id", userId);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, userId, role });
  } catch (error) {
    safeLogError("Update user role error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Analytics: Verify User ─────────────────────────────────

router.patch("/api/analytics/users/:id/verify", async (req, res) => {
  if (dbUnavailable(res)) return;
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });
  try {
    const { error } = await supabase!.from("users")
      .update({ isVerified: true, updatedAt: new Date().toISOString() })
      .eq("id", userId);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, userId });
  } catch (error) {
    safeLogError("Verify user error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Analytics: Products ────────────────────────────────────

router.get("/api/analytics/visitors", async (_req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const [{ data: eventsData }, { count: totalUsers }] = await Promise.all([
      supabase!.from("analytics_events").select("visitorId, userId, eventType, createdAt").order("createdAt", { ascending: false }),
      supabase!.from("users").select("*", { count: "exact", head: true }),
    ]);

    const visitorSet = new Set<string>();
    const loggedInVisitorSet = new Set<string>();
    const anonVisitorSet = new Set<string>();
    const visitorActivity = new Map<string, { views: number; searches: number; waTaps: number; lastSeen: string | null }>();

    for (const evt of (eventsData || []) as any[]) {
      const vid = evt.visitorId as string | null;
      if (!vid) continue;
      visitorSet.add(vid);
      if (evt.userId) loggedInVisitorSet.add(vid);
      else anonVisitorSet.add(vid);

      if (!visitorActivity.has(vid)) visitorActivity.set(vid, { views: 0, searches: 0, waTaps: 0, lastSeen: null });
      const va = visitorActivity.get(vid)!;
      if (!va.lastSeen || evt.createdAt > va.lastSeen) va.lastSeen = evt.createdAt;
      if (evt.eventType === "product_view") va.views++;
      else if (evt.eventType === "search") va.searches++;
      else if (evt.eventType === "whatsapp_tap") va.waTaps++;
    }

    const topVisitors = [...visitorActivity.entries()]
      .sort((a, b) => (b[1].views + b[1].searches + b[1].waTaps) - (a[1].views + a[1].searches + a[1].waTaps))
      .slice(0, 20)
      .map(([visitorId, stats]) => ({ visitorId, isAnon: !loggedInVisitorSet.has(visitorId), ...stats }));

    res.json({
      source: "database",
      data: {
        totalVisitors: visitorSet.size,
        loggedInVisitors: loggedInVisitorSet.size,
        anonVisitors: anonVisitorSet.size,
        registeredUsers: totalUsers ?? 0,
        registrationRate: visitorSet.size > 0 ? (loggedInVisitorSet.size / visitorSet.size) : 0,
        topVisitors,
      },
    });
  } catch (error) {
    safeLogError("Visitor analytics query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Analytics: Conversion Funnel (views → wishlist → cart → orders) ──────────

router.get("/api/analytics/funnel", async (_req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const [
      { count: totalViews },
      { count: wishlistAdds },
      { count: cartAdds },
      { count: totalOrders },
    ] = await Promise.all([
      supabase!.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "product_view"),
      supabase!.from("wishlists").select("*", { count: "exact", head: true }),
      supabase!.from("cart_items").select("*", { count: "exact", head: true }),
      supabase!.from("orders").select("*", { count: "exact", head: true }),
    ]);

    const views = totalViews ?? 0;
    const wishlists = wishlistAdds ?? 0;
    const carts = cartAdds ?? 0;
    const orders = totalOrders ?? 0;

    res.json({
      source: "database",
      data: {
        views,
        wishlists,
        carts,
        orders,
        viewToWishlist: views > 0 ? wishlists / views : 0,
        wishlistToCart: wishlists > 0 ? carts / wishlists : 0,
        cartToOrder: carts > 0 ? orders / carts : 0,
        viewToOrder: views > 0 ? orders / views : 0,
      },
    });
  } catch (error) {
    safeLogError("Funnel analytics query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.get("/api/analytics/products", async (req, res) => {
  if (dbUnavailable(res)) return;
  const timeRange = (req.query.timeRange as string) || "30d";
  const now = new Date();
  let startDate: string | null = null;
  if (timeRange === "1d") startDate = new Date(now.getTime() - 86400000).toISOString();
  else if (timeRange === "7d") startDate = new Date(now.getTime() - 7 * 86400000).toISOString();
  else if (timeRange === "30d") startDate = new Date(now.getTime() - 30 * 86400000).toISOString();

  try {
    const buildQ = (et: string) => {
      let q = supabase!.from("analytics_events").select("id, userId, productId, eventType, metadata, createdAt").eq("eventType", et);
      if (startDate) q = q.gte("createdAt", startDate);
      return q;
    };

    const [{ data: viewEvents }, { data: searchEvents }, { data: waTapEvents }, { data: allProducts }] = await Promise.all([
      buildQ("product_view"), buildQ("search"), buildQ("whatsapp_tap"),
      supabase!.from("products").select("id, name, price, imageUrl, categoryId, vendorId, status").limit(500),
    ]);

    const productViewCounts = new Map<number, { views: number; lastViewed: string | null; viewers: Set<number> }>();
    for (const evt of (viewEvents || []) as any[]) {
      if (!evt.productId) continue;
      if (!productViewCounts.has(evt.productId)) productViewCounts.set(evt.productId, { views: 0, lastViewed: null, viewers: new Set() });
      const p = productViewCounts.get(evt.productId)!;
      p.views++;
      if (!p.lastViewed || evt.createdAt > p.lastViewed) p.lastViewed = evt.createdAt;
      if (evt.userId) p.viewers.add(evt.userId);
    }
    const productWaTaps = new Map<number, number>();
    for (const evt of (waTapEvents || []) as any[]) {
      if (evt.productId) productWaTaps.set(evt.productId, (productWaTaps.get(evt.productId) || 0) + 1);
    }

    const catIds = [...new Set(((allProducts || []) as any[]).filter(p => p.categoryId).map(p => p.categoryId))];
    const catNames: Record<number, string> = {};
    if (catIds.length > 0) {
      const { data: catsData } = await supabase!.from("categories").select("id, name").in("id", catIds);
      for (const c of (catsData || []) as any[]) catNames[c.id] = c.name;
    }

    const productMap = new Map<number, any>();
    for (const p of (allProducts || []) as any[]) productMap.set(p.id, { ...p, categoryName: p.categoryId ? (catNames[p.categoryId] || null) : null });

    const topProducts = [...productViewCounts.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, 20)
      .map(([productId, stats]) => {
        const p = productMap.get(productId);
        const waTaps = productWaTaps.get(productId) || 0;
        return { productId, productName: p?.name || `Product ${productId}`, categoryId: p?.categoryId || null, categoryName: p?.categoryName || null, vendorId: p?.vendorId || null, price: p?.price || null, imageUrl: p?.imageUrl || null, views: stats.views, uniqueViewers: stats.viewers.size, waTaps, conversionRate: stats.views > 0 ? waTaps / stats.views : 0, lastViewed: stats.lastViewed };
      });

    const viewedIds = new Set(productViewCounts.keys());
    const deadStock = ((allProducts || []) as any[]).filter(p => !viewedIds.has(p.id) && p.status !== "deleted").slice(0, 20)
      .map(p => ({ productId: p.id, productName: p.name, categoryId: p.categoryId, categoryName: p.categoryId ? (catNames[p.categoryId] || null) : null, vendorId: p.vendorId, price: p.price, imageUrl: p.imageUrl, views: 0, uniqueViewers: 0, waTaps: 0, conversionRate: 0, lastViewed: null }));

    const catViewCounts = new Map<number, number>();
    for (const [productId, stats] of productViewCounts) {
      const p = productMap.get(productId);
      if (p?.categoryId) catViewCounts.set(p.categoryId, (catViewCounts.get(p.categoryId) || 0) + stats.views);
    }
    const categoryTrends = [...catViewCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([catId, views]) => ({ name: catNames[catId] || `Category ${catId}`, views, change: 0 }));

    res.json({
      source: "database",
      data: {
        timeRange,
        funnel: { searches: (searchEvents || []).length, views: (viewEvents || []).length, waTaps: (waTapEvents || []).length, searchToView: (searchEvents || []).length > 0 ? (viewEvents || []).length / (searchEvents || []).length : 0, viewToWA: (viewEvents || []).length > 0 ? (waTapEvents || []).length / (viewEvents || []).length : 0 },
        topProducts, deadStock, categoryTrends,
      },
    });
  } catch (error) {
    safeLogError("Analytics products query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Vendor Health ──────────────────────────────────────────

router.get("/api/vendor-health", async (_req, res) => {
  if (dbUnavailable(res)) return;
  const cached = cache.get(CACHE_KEYS.vendorHealth);
  if (cached) return res.json(cached);

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get approved vendors
    const { data: vendors, error: vendorError } = await supabase!
      .from("vendors")
      .select("id, businessName, tier, city, createdAt")
      .eq("status", "approved");

    if (vendorError) throw vendorError;

    const vendorList = vendors || [];
    if (vendorList.length === 0) {
      const result = { source: "database", data: [] };
      cache.set(CACHE_KEYS.vendorHealth, result, 600);
      return res.json(result);
    }

    const vendorIds = vendorList.map((v: any) => v.id);

    // Fetch products, whatsapp taps, and product views in parallel
    const [{ data: productsRaw }, { data: whatsappEventsRaw }, { data: viewEventsRaw }] = await Promise.all([
      supabase!.from("products").select("vendorId").in("vendorId", vendorIds),
      supabase!.from("analytics_events").select("vendorId").eq("eventType", "whatsapp_tap").gte("createdAt", thirtyDaysAgo).in("vendorId", vendorIds),
      supabase!.from("analytics_events").select("vendorId").eq("eventType", "product_view").gte("createdAt", thirtyDaysAgo).in("vendorId", vendorIds),
    ]);

    // Count products per vendor
    const productCountMap = new Map<number, number>();
    for (const p of productsRaw || []) {
      productCountMap.set(p.vendorId, (productCountMap.get(p.vendorId) || 0) + 1);
    }

    // Count whatsapp taps per vendor
    const whatsappCountMap = new Map<number, number>();
    for (const e of whatsappEventsRaw || []) {
      if (e.vendorId) whatsappCountMap.set(e.vendorId, (whatsappCountMap.get(e.vendorId) || 0) + 1);
    }

    // Count product views per vendor
    const viewCountMap = new Map<number, number>();
    for (const e of viewEventsRaw || []) {
      if (e.vendorId) viewCountMap.set(e.vendorId, (viewCountMap.get(e.vendorId) || 0) + 1);
    }

    const data = vendorList.map((v: any) => {
      const productCount = productCountMap.get(v.id) || 0;
      const whatsappTaps30d = whatsappCountMap.get(v.id) || 0;
      const productViews30d = viewCountMap.get(v.id) || 0;

      // Health score: 0-100
      // Products listed: up to 30 points (1 point per product, max 30)
      // WhatsApp taps 30d: up to 35 points (1 point per tap, max 35)
      // Product views 30d: up to 35 points (0.35 points per view, max 35)
      const productScore = Math.min(productCount, 30);
      const whatsappScore = Math.min(whatsappTaps30d, 35);
      const viewScore = Math.min(Math.round(productViews30d * 0.35), 35);
      const healthScore = Math.min(productScore + whatsappScore + viewScore, 100);

      return {
        id: v.id,
        businessName: v.businessName,
        tier: v.tier,
        city: v.city,
        productCount,
        whatsappTaps30d,
        productViews30d,
        healthScore,
        lastActive: v.createdAt,
      };
    });

    const result = { source: "database", data };
    cache.set(CACHE_KEYS.vendorHealth, result, 600);
    res.json(result);
  } catch (error) {
    safeLogError("Vendor health query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Vendor Detail Endpoints ─────────────────────────────────────────────────

router.get("/api/verification-queue", async (_req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const { data, error } = await supabase!.from("vendors")
      .select("id, businessName, phone, city, region, status, verified, ghanaCardNumber, idDocumentUrl, businessRegUrl, logoUrl, createdAt, updatedAt")
      .eq("verified", false)
      .neq("status", "rejected")
      .or("ghanaCardNumber.not.is.null,idDocumentUrl.not.is.null,businessRegUrl.not.is.null")
      .order("createdAt", { ascending: false })
      .limit(100);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ source: "database", data: data || [] });
  } catch (error) {
    safeLogError("Verification queue error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.patch("/api/vendors/:id/verify", async (req, res) => {
  if (dbUnavailable(res)) return;
  const vendorId = parseInt(req.params.id, 10);
  if (isNaN(vendorId)) return res.status(400).json({ error: "Invalid vendor ID" });
  const { approved } = req.body;
  try {
    const updateFields: Record<string, any> = {
      verified: approved === true,
      updatedAt: new Date().toISOString(),
    };
    if (approved === false) updateFields.status = "rejected";
    const { data, error } = await supabase!.from("vendors")
      .update(updateFields).eq("id", vendorId).select().single();
    if (error) return res.status(400).json({ error: error.message });

    // When a claim is approved, promote the linked user to vendor role
    if (approved === true && data?.userId) {
      await syncVendorUserRole(data.userId, data.phone);
      await supabase!.from("vendors").update({ claimStatus: "claimed" }).eq("id", vendorId).eq("claimStatus", "unclaimed");
    }

    res.json({ source: "database", data });
  } catch (error) {
    safeLogError("Vendor verify error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.get("/api/vendors/:id", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) {
      return res.status(400).json({ error: "Invalid vendor ID" });
    }

    const { data: vendor, error: vendorError } = await supabase!
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const { count: productCount } = await supabase!
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("vendorId", vendorId);

    const { data: orders } = await supabase!
      .from("orders")
      .select("id, totalAmount, commissionAmount")
      .eq("vendorId", vendorId);

    const orderCount = orders?.length ?? 0;
    const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0) ?? 0;

    res.json({
      source: "database",
      data: {
        ...vendor,
        totalListings: productCount ?? 0,
        totalOrders: orderCount,
        totalRevenue,
      },
    });
  } catch (error) {
    safeLogError("Vendor detail query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.get("/api/vendors/:id/orders", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) {
      return res.status(400).json({ error: "Invalid vendor ID" });
    }

    const { data, error } = await supabase!
      .from("orders")
      .select("id, orderNumber, totalAmount, commissionAmount, currency, status, paymentMethod, paymentStatus, buyerName, buyerPhone, createdAt")
      .eq("vendorId", vendorId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    res.json({ source: "database", data: data ?? [] });
  } catch (error) {
    safeLogError("Vendor orders query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.get("/api/vendors/:id/payouts", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) {
      return res.status(400).json({ error: "Invalid vendor ID" });
    }

    const { data, error } = await supabase!
      .from("vendor_payouts")
      .select("*")
      .eq("vendorId", vendorId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    res.json({ source: "database", data: data ?? [] });
  } catch (error) {
    safeLogError("Vendor payouts query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.get("/api/vendors/:id/notifications", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) {
      return res.status(400).json({ error: "Invalid vendor ID" });
    }

    const { data: vendor, error: vendorError } = await supabase!
      .from("vendors")
      .select("userId")
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const { data, error } = await supabase!
      .from("notifications")
      .select("*")
      .eq("userId", vendor.userId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    res.json({ source: "database", data: data ?? [] });
  } catch (error) {
    safeLogError("Vendor notifications query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.get("/api/vendors/:id/subscription-events", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) {
      return res.status(400).json({ error: "Invalid vendor ID" });
    }

    const { data, error } = await supabase!
      .from("subscription_events")
      .select("*")
      .eq("vendorId", vendorId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    res.json({ source: "database", data: data ?? [] });
  } catch (error) {
    safeLogError("Vendor subscription events query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.patch("/api/vendors/:id/profile", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) return res.status(400).json({ error: "Invalid vendor ID" });
    const allowed = ["businessName", "phone", "whatsapp", "email", "address", "ghanaCardNumber"];
    const updateFields: Record<string, any> = { updatedAt: new Date().toISOString() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateFields[key] = String(req.body[key]).trim() || null;
    }
    const { data, error } = await supabase!
      .from("vendors").update(updateFields).eq("id", vendorId).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Vendor not found" });
    cache.del(CACHE_KEYS.stats);
    res.json(data);
  } catch (error) {
    safeLogError("Vendor profile update error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.patch("/api/vendors/:id/status", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) {
      return res.status(400).json({ error: "Invalid vendor ID" });
    }

    const { status } = req.body;
    const validStatuses = ["approved", "pending", "rejected", "suspended"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be one of: " + validStatuses.join(", ") });
    }

    const { data, error } = await supabase!
      .from("vendors")
      .update({ status, updatedAt: new Date().toISOString() })
      .eq("id", vendorId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // When approving a vendor, ensure their linked user account is promoted
    if (status === "approved" && data.userId) {
      await syncVendorUserRole(data.userId, data.phone);
      // Also mark claimStatus as claimed if userId is set
      await supabase!.from("vendors").update({ claimStatus: "claimed" }).eq("id", vendorId).eq("claimStatus", "unclaimed");
    }

    cache.del(CACHE_KEYS.stats);
    cache.del(CACHE_KEYS.vendorHealth);
    cache.del(CACHE_KEYS.briefing);
    cache.del(CACHE_KEYS.growth);

    res.json(data);
  } catch (error) {
    safeLogError("Vendor status update error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.patch("/api/vendors/:id/pipeline-stage", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) return res.status(400).json({ error: "Invalid vendor ID" });

    const { pipelineStage } = req.body;
    const validStages = ["lead", "contacted", "responded", "claimed", "onboarding", "active", "paid", "churned"];
    if (!validStages.includes(pipelineStage)) {
      return res.status(400).json({ error: "Invalid stage. Must be one of: " + validStages.join(", ") });
    }

    const { data, error } = await supabase!
      .from("vendors")
      .update({ pipeline_stage: pipelineStage, updatedAt: new Date().toISOString() })
      .eq("id", vendorId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Vendor not found" });
    res.json(data);
  } catch (error) {
    safeLogError("Vendor pipeline stage update error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.patch("/api/vendors/:id/tier", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) {
      return res.status(400).json({ error: "Invalid vendor ID" });
    }

    const { tier, tierExpiresAt } = req.body;
    const validTiers = ["free", "starter", "pro", "business", "enterprise"];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: "Invalid tier. Must be one of: " + validTiers.join(", ") });
    }

    const updateFields: Record<string, any> = {
      tier,
      updatedAt: new Date().toISOString(),
    };
    if (tierExpiresAt !== undefined) {
      if (typeof tierExpiresAt !== "string" || isNaN(Date.parse(tierExpiresAt))) {
        return res.status(400).json({ error: "tierExpiresAt must be a valid ISO 8601 date string" });
      }
      updateFields.tierExpiresAt = tierExpiresAt;
    }

    const { data, error } = await supabase!
      .from("vendors")
      .update(updateFields)
      .eq("id", vendorId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    cache.del(CACHE_KEYS.stats);
    cache.del(CACHE_KEYS.vendorHealth);
    cache.del(CACHE_KEYS.briefing);
    cache.del(CACHE_KEYS.growth);

    res.json(data);
  } catch (error) {
    safeLogError("Vendor tier update error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.patch("/api/vendors/:id/featured", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) {
      return res.status(400).json({ error: "Invalid vendor ID" });
    }

    const { isFeatured, featuredUntil, featuredCategoryId } = req.body;
    if (typeof isFeatured !== "boolean") {
      return res.status(400).json({ error: "isFeatured must be a boolean" });
    }

    const updateFields: Record<string, any> = {
      isFeatured,
      updatedAt: new Date().toISOString(),
    };
    if (featuredUntil !== undefined) {
      if (typeof featuredUntil !== "string" || isNaN(Date.parse(featuredUntil))) {
        return res.status(400).json({ error: "featuredUntil must be a valid ISO 8601 date string" });
      }
      updateFields.featuredUntil = featuredUntil;
    }
    if (featuredCategoryId !== undefined) {
      if (typeof featuredCategoryId !== "number" || !Number.isInteger(featuredCategoryId) || featuredCategoryId < 1) {
        return res.status(400).json({ error: "featuredCategoryId must be a positive integer" });
      }
      updateFields.featuredCategoryId = featuredCategoryId;
    }

    const { data, error } = await supabase!
      .from("vendors")
      .update(updateFields)
      .eq("id", vendorId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    cache.del(CACHE_KEYS.stats);
    cache.del(CACHE_KEYS.vendorHealth);
    cache.del(CACHE_KEYS.briefing);
    cache.del(CACHE_KEYS.growth);

    res.json(data);
  } catch (error) {
    safeLogError("Vendor featured update error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

router.post("/api/vendors/:id/notifications", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) {
      return res.status(400).json({ error: "Invalid vendor ID" });
    }

    const { data: vendor, error: vendorError } = await supabase!
      .from("vendors")
      .select("userId")
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const { title, message, type } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "title and message are required" });
    }
    if (typeof title !== "string" || title.length > 255) {
      return res.status(400).json({ error: "title must be a string with max 255 characters" });
    }
    if (typeof message !== "string" || message.length > 10000) {
      return res.status(400).json({ error: "message must be a string with max 10000 characters" });
    }

    const validTypes = ["order", "vendor", "system", "inventory"];
    const insertFields: Record<string, any> = {
      userId: vendor.userId,
      title,
      message,
    };
    if (type !== undefined) {
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: "type must be one of: " + validTypes.join(", ") });
      }
      insertFields.type = type;
    }

    const { data, error } = await supabase!
      .from("notifications")
      .insert(insertFields)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    safeLogError("Vendor notification create error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── GET /api/settings/wa-keys ───────────────────────────────────────────────
router.get("/api/settings/wa-keys", async (_req, res) => {
  const cfg = loadWaConfig();
  res.json({
    status: {
      phoneNumberId:     !!cfg.phoneNumberId,
      accessToken:       !!cfg.accessToken,
      webhookToken:      !!cfg.webhookToken,
      businessAccountId: !!cfg.businessAccountId,
    },
  });
});

// ─── POST /api/settings/wa-keys ──────────────────────────────────────────────
router.post("/api/settings/wa-keys", async (req, res) => {
  try {
    const { phoneNumberId, accessToken, webhookToken, businessAccountId } = req.body ?? {};
    const current = loadWaConfig();
    const updated = {
      phoneNumberId:     phoneNumberId?.trim()     || current.phoneNumberId,
      accessToken:       accessToken?.trim()       || current.accessToken,
      webhookToken:      webhookToken?.trim()      || current.webhookToken,
      businessAccountId: businessAccountId?.trim() || current.businessAccountId,
    };
    saveWaConfig(updated);
    res.json({
      success: true,
      status: {
        phoneNumberId:     !!updated.phoneNumberId,
        accessToken:       !!updated.accessToken,
        webhookToken:      !!updated.webhookToken,
        businessAccountId: !!updated.businessAccountId,
      },
    });
  } catch (error) {
    safeLogError("Save WA keys error", error);
    res.status(500).json({ error: "Failed to save keys" });
  }
});

// ─── POST /api/settings/wa-test ──────────────────────────────────────────────
router.post("/api/settings/wa-test", async (_req, res) => {
  try {
    const cfg = loadWaConfig();
    if (!cfg.phoneNumberId || !cfg.accessToken) {
      return res.status(400).json({ success: false, message: "Phone Number ID and Access Token are required" });
    }
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${cfg.accessToken}` } }
    );
    const data = await r.json() as Record<string, unknown>;
    if (r.ok && data.display_phone_number) {
      res.json({ success: true, message: `Connected — ${data.verified_name ?? ""} (${data.display_phone_number})` });
    } else {
      const errMsg = (data.error as Record<string, unknown>)?.message ?? "Invalid credentials";
      res.status(400).json({ success: false, message: String(errMsg) });
    }
  } catch (error) {
    safeLogError("WA test error", error);
    res.status(500).json({ success: false, message: "Connection test failed" });
  }
});

// ─── Internal: promote a user to vendor role when linked to a vendor ─────────
async function syncVendorUserRole(userId: number, vendorPhone?: string | null) {
  if (!userId) return;
  const update: Record<string, unknown> = {
    role: "vendor",
    isVerified: true,
    updatedAt: new Date().toISOString(),
  };
  if (vendorPhone) {
    // Only back-fill phone if the user doesn't already have one
    const { data: u } = await supabase!.from("users").select("phone").eq("id", userId).single();
    if (!u?.phone) update.phone = vendorPhone;
  }
  await supabase!.from("users").update(update).eq("id", userId);
}

// ─── Internal: get or create a claim token for a vendor ─────────────────────
async function getOrCreateClaimToken(vendorId: number): Promise<{ token: string; claimUrl: string } | null> {
  const { data: vendor, error } = await supabase!
    .from("vendors")
    .select("id, claimToken, claimTokenExpiresAt, claimStatus")
    .eq("id", vendorId)
    .single();
  if (error || !vendor) return null;

  const now = new Date();
  const hasValidToken =
    vendor.claimToken &&
    vendor.claimStatus === "unclaimed" &&
    vendor.claimTokenExpiresAt &&
    new Date(vendor.claimTokenExpiresAt) > now;

  if (hasValidToken) {
    return { token: vendor.claimToken, claimUrl: `https://voomparts.com/claim/${vendor.claimToken}` };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateErr } = await supabase!
    .from("vendors")
    .update({ claimToken: token, claimTokenExpiresAt: expiresAt, claimStatus: "unclaimed", updatedAt: now.toISOString() })
    .eq("id", vendorId);
  if (updateErr) return null;

  return { token, claimUrl: `https://voomparts.com/claim/${token}` };
}

// ─── POST /api/vendors/:id/generate-claim-link ───────────────────────────────
router.post("/api/vendors/:id/generate-claim-link", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) return res.status(400).json({ error: "Invalid vendor ID" });
    const result = await getOrCreateClaimToken(vendorId);
    if (!result) return res.status(404).json({ error: "Vendor not found or token generation failed" });
    res.json(result);
  } catch (error) {
    safeLogError("Generate claim link error", error);
    res.status(500).json({ error: "Failed to generate claim link" });
  }
});

// ─── GET /api/vendors/outreach-invites ──────────────────────────────────────
router.get("/api/vendors/outreach-invites", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const { data, error } = await supabase!
      .from("analytics_events")
      .select("vendorId, createdAt")
      .eq("eventType", "whatsapp_tap")
      .filter("metadata->>'source'", "eq", "outreach_invite")
      .not("vendorId", "is", null)
      .order("createdAt", { ascending: false });
    if (error) throw error;
    // Return only the most recent invite per vendorId
    const seen = new Map<number, string>();
    for (const row of data || []) {
      if (!seen.has(row.vendorId)) seen.set(row.vendorId, row.createdAt);
    }
    const result = Array.from(seen.entries()).map(([vendorId, invitedAt]) => ({ vendorId, invitedAt }));
    res.json(result);
  } catch (error) {
    safeLogError("Outreach invites fetch error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── POST /api/vendors/:id/outreach-invite ───────────────────────────────────
router.post("/api/vendors/:id/outreach-invite", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) return res.status(400).json({ error: "Invalid vendor ID" });

    const { data: vendor, error: vErr } = await supabase!
      .from("vendors")
      .select("id, businessName, phone, whatsapp, userId")
      .eq("id", vendorId)
      .single();
    if (vErr || !vendor) return res.status(404).json({ error: "Vendor not found" });

    // Get or generate a secure claim link
    const claimResult = await getOrCreateClaimToken(vendorId);
    const claimUrl = claimResult?.claimUrl ?? `https://voomparts.com/vendors/${vendorId}`;

    // Build WhatsApp number (prefer whatsapp field, fall back to phone)
    const rawPhone = (vendor.whatsapp || vendor.phone || "").replace(/\D/g, "");
    let waNumber = rawPhone;
    if (rawPhone.startsWith("233")) waNumber = rawPhone;
    else if (rawPhone.startsWith("0") && rawPhone.length === 10) waNumber = "233" + rawPhone.slice(1);
    else if (rawPhone.length === 9) waNumber = "233" + rawPhone;

    const vendorPageUrl = `https://voomparts.com/vendors/${vendorId}`;
    const message =
      `Hi! 👋 Your shop, *${vendor.businessName}*, is already live on VOOM Ghana — Ghana's #1 online auto-parts marketplace.\n\n` +
      `Buyers across all 16 regions can already find you. Click the link below to claim your page in 2 minutes and start managing your listings:\n\n` +
      `👉 ${claimUrl}\n\n` +
      `The link expires in 7 days. It's completely free.\n\n` +
      `— VOOM Ghana Team 🚗`;

    const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

    // Record invite event
    await supabase!.from("analytics_events").insert({
      eventType: "whatsapp_tap",
      vendorId,
      metadata: { source: "outreach_invite", vendorPageUrl, claimUrl, waNumber },
    });

    res.json({ whatsappUrl, vendorPageUrl, claimUrl });
  } catch (error) {
    safeLogError("Outreach invite error", error);
    res.status(500).json({ error: "Failed to process invite" });
  }
});

// ─── POST /api/vendors/invite ───────────────────────────────────────────────
router.post("/api/vendors/invite", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const { businessName, phone, city } = req.body;
    if (!businessName || typeof businessName !== "string" || businessName.trim().length === 0) {
      return res.status(400).json({ error: "businessName is required" });
    }
    if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
      return res.status(400).json({ error: "phone is required" });
    }

    const cleanPhone = phone.trim();
    const cleanName = businessName.trim();

    // Format phone to international WhatsApp format (Ghana)
    const digitsOnly = cleanPhone.replace(/[\s\-\(\)+]/g, "");
    let waNumber = digitsOnly;
    if (digitsOnly.startsWith("233")) waNumber = digitsOnly;
    else if (digitsOnly.startsWith("0") && digitsOnly.length === 10) waNumber = "233" + digitsOnly.slice(1);
    else if (digitsOnly.length === 9) waNumber = "233" + digitsOnly;

    const inviteText = encodeURIComponent(
      `Hello! 👋 You've been invited to join VOOM Ghana as a verified auto-parts vendor.\n\n` +
      `Business: *${cleanName}*\n\n` +
      `Your account has been created and is pending activation. ` +
      `Our team will contact you within 24 hours to complete your onboarding.\n\n` +
      `Welcome to VOOM Ghana! 🚗`
    );
    const whatsappUrl = `https://wa.me/${waNumber}?text=${inviteText}`;

    // Always store in +233XXXXXXXXX format to satisfy DB pattern constraint
    const storedPhone = "+" + waNumber;

    const insertFields: Record<string, any> = {
      businessName: cleanName,
      phone: storedPhone,
      whatsapp: storedPhone,
      status: "pending",
      verified: false,
    };
    if (city && typeof city === "string" && city.trim()) {
      insertFields.city = city.trim();
    }

    // Check for existing vendor with same phone before inserting
    const { data: existing } = await supabase!
      .from("vendors")
      .select("id, businessName")
      .or(`phone.eq.${storedPhone},whatsapp.eq.${storedPhone}`)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({
        error: `"${existing.businessName}" is already in the system. Find them in the Vendors list and use the WA button on their row to send the invite.`,
        code: "ALREADY_EXISTS",
        existingVendor: { id: existing.id, businessName: existing.businessName },
      });
    }

    const { data, error } = await supabase!
      .from("vendors")
      .insert(insertFields)
      .select()
      .single();

    if (error) {
      safeLogError("Vendor invite insert error", error);
      const isDuplicate = (error as any)?.code === "23505";
      return res.status(isDuplicate ? 409 : 500).json({
        error: isDuplicate
          ? "A vendor with this phone number already exists in the system."
          : "Failed to create vendor record",
      });
    }

    return res.status(201).json({ vendor: data, whatsappUrl });
  } catch (error) {
    safeLogError("Vendor invite error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Supply-Demand Gap Matrix ────────────────────────────────────────────────

router.get("/api/analytics/supply-demand", async (_req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Get zero-result and low-result searches (last 7 days)
    const { data: searchEvents } = await supabase!
      .from("analytics_events")
      .select("metadata")
      .eq("eventType", "search")
      .gte("createdAt", sevenDaysAgo);

    const queryMap = new Map<string, { count: number; results: number; hasResultCount: boolean }>();
    for (const e of searchEvents || []) {
      const meta = e.metadata as Record<string, unknown> | null;
      if (!meta?.query) continue;
      const q = (meta.query as string).toLowerCase().trim();
      if (q.length < 2) continue;
      const existing = queryMap.get(q) || { count: 0, results: 0, hasResultCount: false };
      existing.count++;
      // Only treat as zero-result if the metadata explicitly includes a result count
      const rc = meta.resultCount ?? meta.results ?? undefined;
      if (rc !== undefined) {
        existing.hasResultCount = true;
        existing.results = Math.max(existing.results, rc as number);
      }
      queryMap.set(q, existing);
    }

    // Zero-result searches: only count queries that explicitly reported 0 results
    // If resultCount was never sent, we can't classify it as zero-result
    const gaps = [...queryMap.entries()]
      .filter(([, d]) => d.hasResultCount && d.results === 0)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30)
      .map(([query, d]) => ({ query, searchCount: d.count }));

    // Count queries with confirmed result counts for accurate zero-result rate
    const queriesWithResultCount = [...queryMap.values()].filter(d => d.hasResultCount);
    const confirmedZeroResult = queriesWithResultCount.filter(d => d.results === 0).length;

    // Get vendors in pipeline with their specializations
    const { data: allVendors } = await supabase!
      .from("vendors")
      .select("id, businessName, phone, whatsapp, city, status");

    const vendorList = allVendors || [];

    // Get products to understand which makes/categories each vendor covers
    const { data: allProducts } = await supabase!
      .from("products")
      .select("vendorId, name, vehicleMake, vehicleModel, categoryId");

    // Build vendor specialization index
    const vendorSpecs = new Map<number, Set<string>>();
    for (const p of allProducts || []) {
      const pid = (p as any).vendorId;
      if (!vendorSpecs.has(pid)) vendorSpecs.set(pid, new Set());
      const specs = vendorSpecs.get(pid)!;
      if ((p as any).vehicleMake) specs.add(((p as any).vehicleMake as string).toLowerCase());
      if ((p as any).vehicleModel) specs.add(((p as any).vehicleModel as string).toLowerCase());
      if ((p as any).name) {
        const words = ((p as any).name as string).toLowerCase().split(/\s+/);
        words.forEach(w => { if (w.length > 3) specs.add(w); });
      }
    }

    // Match gaps to vendors
    const gapsWithMatches = gaps.map(gap => {
      const queryWords = gap.query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const matches = vendorList
        .map((v: any) => {
          const specs = vendorSpecs.get(v.id);
          if (!specs) return null;
          const matchScore = queryWords.filter(w => [...specs].some(s => s.includes(w) || w.includes(s))).length;
          if (matchScore === 0) return null;
          return { vendorId: v.id, businessName: v.businessName, phone: v.phone, whatsapp: v.whatsapp, city: v.city, status: v.status, matchScore };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.matchScore - a.matchScore)
        .slice(0, 3);
      return { ...gap, matchedVendors: matches };
    });

    // All searches summary
    const allSearches = [...queryMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 50)
      .map(([query, d]) => ({ query, searchCount: d.count, resultCount: d.results }));

    res.json({
      source: "database",
      data: {
        gaps: gapsWithMatches,
        topSearches: allSearches,
        totalSearches: searchEvents?.length ?? 0,
        uniqueQueries: queryMap.size,
        // Only calculate zero-result rate from searches that actually report result counts
        zeroResultRate: queriesWithResultCount.length > 0
          ? Math.round((confirmedZeroResult / queriesWithResultCount.length) * 100)
          : 0,
        // Flag: are search events sending result counts?
        resultCountTracked: queriesWithResultCount.length > 0,
        queriesWithResultData: queriesWithResultCount.length,
      },
    });
  } catch (error) {
    safeLogError("Supply-demand gap query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Unit Economics ──────────────────────────────────────────────────────────

router.get("/api/analytics/unit-economics", async (_req, res) => {
  if (dbUnavailable(res)) return;
  try {
    // Vendor lifecycle data
    const { data: allVendors } = await supabase!
      .from("vendors")
      .select("id, userId, status, tier, tierExpiresAt, totalSales, createdAt");

    // Exclude test accounts (userId=0 is a placeholder for test/demo vendors)
    const vendors = (allVendors || []).filter((v: any) => v.userId !== 0);
    const totalVendors = vendors.length;
    const paidVendors = vendors.filter((v: any) => v.tier !== "free" && v.status === "approved");
    const churned = vendors.filter((v: any) => v.status === "suspended" || v.status === "rejected");

    // Tier pricing
    const TIER_PRICES: Record<string, number> = { free: 0, starter: 100, pro: 200, business: 800, enterprise: 2000 };
    const mrr = paidVendors.reduce((sum: number, v: any) => {
      if (v.tierExpiresAt && new Date(v.tierExpiresAt) < new Date()) return sum;
      return sum + (TIER_PRICES[v.tier] || 0);
    }, 0);

    // Average revenue per vendor (ARPU)
    const arpu = totalVendors > 0 ? mrr / totalVendors : 0;

    // Churn rate (monthly approximation)
    const churnRate = totalVendors > 0 ? (churned.length / totalVendors) * 100 : 0;

    // LTV = ARPU / churn rate (monthly)
    const monthlyChurnRate = churnRate / 100;
    const ltv = monthlyChurnRate > 0 ? arpu / monthlyChurnRate : arpu * 24; // assume 24 month lifetime if no churn

    // CAC — approximate from pipeline (vendors contacted vs registered)
    const registered = vendors.filter((v: any) => v.status === "approved" || v.status === "pending").length;
    // Rough CAC: assume $0 cash spend (founder time only), so CAC ≈ 0 for now
    const cac = 0;

    // Vendor activation metrics
    const activeVendors = vendors.filter((v: any) => (v.totalSales || 0) > 0).length;
    const activationRate = totalVendors > 0 ? (activeVendors / totalVendors) * 100 : 0;

    // Time to first sale (average days from createdAt to first order)
    // This would need order data joined — approximate for now
    const conversionToPaid = totalVendors > 0 ? (paidVendors.length / totalVendors) * 100 : 0;

    res.json({
      source: "database",
      data: {
        mrr,
        arpu: Math.round(arpu),
        ltv: Math.round(ltv),
        cac,
        ltvCacRatio: cac > 0 ? Math.round(ltv / cac) : null,
        churnRate: Math.round(churnRate * 10) / 10,
        activationRate: Math.round(activationRate * 10) / 10,
        conversionToPaid: Math.round(conversionToPaid * 10) / 10,
        totalVendors,
        paidVendors: paidVendors.length,
        churnedVendors: churned.length,
        activeVendors,
      },
    });
  } catch (error) {
    safeLogError("Unit economics query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Vendor Analytics (for value reports) ────────────────────────────────────

router.get("/api/analytics/vendor/:id", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const vendorId = parseInt(req.params.id, 10);
    if (isNaN(vendorId)) return res.status(400).json({ error: "Invalid vendor ID" });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // Get all products for this vendor
    const { data: products } = await supabase!
      .from("products")
      .select("id, name")
      .eq("vendorId", vendorId);

    const productIds = (products || []).map((p: any) => p.id);

    if (productIds.length === 0) {
      return res.json({
        source: "database",
        data: { views: 0, whatsappTaps: 0, searches: 0, topProduct: null, topSearches: [], restockTip: null },
      });
    }

    // Get events for vendor's products in last 30 days
    const { data: events } = await supabase!
      .from("analytics_events")
      .select("eventType, productId, metadata")
      .in("productId", productIds)
      .gte("createdAt", thirtyDaysAgo);

    const allEvents = events || [];
    const views = allEvents.filter((e: any) => e.eventType === "product_view").length;
    const waTaps = allEvents.filter((e: any) => e.eventType === "whatsapp_tap").length;

    // Top product by views
    const viewsByProduct = new Map<number, number>();
    allEvents.filter((e: any) => e.eventType === "product_view").forEach((e: any) => {
      viewsByProduct.set(e.productId, (viewsByProduct.get(e.productId) || 0) + 1);
    });
    let topProductId: number | null = null;
    let topProductViews = 0;
    viewsByProduct.forEach((count, pid) => {
      if (count > topProductViews) { topProductViews = count; topProductId = pid; }
    });
    const topProduct = topProductId
      ? { name: products!.find((p: any) => p.id === topProductId)?.name || "Unknown", views: topProductViews }
      : null;

    // Build keyword set from vendor's products (makes, models, product name words)
    const { data: vendorFullProducts } = await supabase!
      .from("products")
      .select("name, vehicleMake, vehicleModel, categoryId")
      .eq("vendorId", vendorId);

    const vendorKeywords = new Set<string>();
    (vendorFullProducts || []).forEach((p: any) => {
      if (p.vehicleMake) vendorKeywords.add(p.vehicleMake.toLowerCase());
      if (p.vehicleModel) vendorKeywords.add(p.vehicleModel.toLowerCase());
      // Extract meaningful words from product names (>3 chars)
      if (p.name) {
        p.name.toLowerCase().split(/\s+/).forEach((w: string) => {
          if (w.length > 3 && !['with', 'from', 'that', 'this', 'for'].includes(w)) {
            vendorKeywords.add(w);
          }
        });
      }
    });

    // Get all search events, then filter for relevance to this vendor
    const { data: searchEvents } = await supabase!
      .from("analytics_events")
      .select("metadata")
      .eq("eventType", "search")
      .gte("createdAt", thirtyDaysAgo);

    const searchCounts = new Map<string, { count: number; results: number; relevant: boolean }>();
    (searchEvents || []).forEach((e: any) => {
      const meta = e.metadata as Record<string, unknown> | null;
      if (!meta?.query) return;
      const q = meta.query as string;
      const qLower = q.toLowerCase();
      const existing = searchCounts.get(q) || { count: 0, results: 0, relevant: false };
      existing.count++;
      existing.results = (meta.resultCount as number) || existing.results;
      // Check if this search is relevant to the vendor's specialization
      if (!existing.relevant && vendorKeywords.size > 0) {
        const queryWords = qLower.split(/\s+/);
        existing.relevant = queryWords.some(w => [...vendorKeywords].some(vk => vk.includes(w) || w.includes(vk)));
      }
      searchCounts.set(q, existing);
    });

    // Prefer relevant searches; fall back to all searches if vendor has no products
    const relevantSearches = [...searchCounts.entries()].filter(([, d]) => d.relevant);
    const searchPool = relevantSearches.length >= 3 ? relevantSearches : [...searchCounts.entries()];

    const topSearches = searchPool
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([query, data]) => ({ query, count: data.count, results: data.results }));

    // Restock tip: highest-volume zero-result search relevant to this vendor
    const relevantGaps = [...searchCounts.entries()]
      .filter(([, d]) => d.results === 0 && (d.relevant || vendorKeywords.size === 0))
      .sort((a, b) => b[1].count - a[1].count);
    const restockTip = relevantGaps[0] || [...searchCounts.entries()]
      .filter(([, d]) => d.results === 0)
      .sort((a, b) => b[1].count - a[1].count)[0];

    res.json({
      source: "database",
      data: {
        views,
        whatsappTaps: waTaps,
        searches: searchEvents?.length ?? 0,
        topProduct,
        topSearches,
        restockTip: restockTip ? { query: restockTip[0], count: restockTip[1].count } : null,
      },
    });
  } catch (error) {
    safeLogError("Vendor analytics query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Public Tracking Endpoint (called by voomparts.com marketplace) ──────────

router.post("/api/track", express.text({ type: "text/plain" }), async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "offline" });

  try {
    // sendBeacon with Blob may arrive as text/plain string — parse it
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
    }
    const events = Array.isArray(body) ? body : [body];
    const validTypes = [
      "page_view", "session_start", "product_view", "whatsapp_tap",
      "wishlist_add", "cart_add", "search", "order_created",
    ];

    const rows = events
      .filter((e: any) => e.eventType && validTypes.includes(e.eventType))
      .map((e: any) => ({
        eventType: e.eventType,
        productId: e.productId || null,
        vendorId: e.vendorId || null,
        userId: e.userId || null,
        visitorId: e.visitorId || null,
        metadata: {
          ...(e.metadata || {}),
          // Traffic source
          ...(e.referrer ? { referrer: e.referrer } : {}),
          ...(e.utmSource ? { utmSource: e.utmSource } : {}),
          ...(e.utmMedium ? { utmMedium: e.utmMedium } : {}),
          ...(e.utmCampaign ? { utmCampaign: e.utmCampaign } : {}),
          // Geo & device
          ...(e.country ? { country: e.country } : {}),
          ...(e.city ? { city: e.city } : {}),
          ...(e.deviceType ? { deviceType: e.deviceType } : {}),
          ...(e.browser ? { browser: e.browser } : {}),
          ...(e.os ? { os: e.os } : {}),
          ...(e.screenWidth ? { screenWidth: e.screenWidth } : {}),
          // Page info
          ...(e.pageUrl ? { pageUrl: e.pageUrl } : {}),
          ...(e.pageTitle ? { pageTitle: e.pageTitle } : {}),
          // Session
          ...(e.sessionId ? { sessionId: e.sessionId } : {}),
        },
      }));

    if (rows.length > 0) {
      await supabase.from("analytics_events").insert(rows);
    }

    res.json({ tracked: rows.length });
  } catch (error) {
    safeLogError("Track endpoint error", error);
    res.status(500).json({ error: "Failed to track" });
  }
});

// ─── Enhanced Analytics Queries ──────────────────────────────────────────────

// GET /api/analytics/traffic — traffic overview with sources, geo, pages
router.get("/api/analytics/traffic", async (_req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();

    // Total events by type (30d)
    const { data: allEvents30d } = await supabase!
      .from("analytics_events")
      .select("eventType, visitorId, metadata")
      .gte("createdAt", thirtyDaysAgo);

    const events = allEvents30d || [];

    // Unique visitors (by visitorId)
    const visitorIds30d = new Set(events.filter(e => e.visitorId).map(e => e.visitorId));
    const sessions30d = events.filter(e => e.eventType === "session_start").length;
    const pageViews30d = events.filter(e => e.eventType === "page_view").length;

    // 7d and 1d subsets
    const events7d = events.filter(e => {
      const meta = e.metadata as Record<string, unknown> | null;
      return true; // all events are within 30d already; we'd need createdAt for proper 7d filtering
    });

    // Traffic sources from metadata
    const sourceMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const cityMap = new Map<string, number>();
    const pageMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();
    const browserMap = new Map<string, number>();

    for (const e of events) {
      const meta = e.metadata as Record<string, unknown> | null;
      if (!meta) continue;

      // Traffic source
      const source = (meta.utmSource as string) || (meta.referrer ? 'referral' : 'direct');
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);

      // Geo
      const country = meta.country as string;
      if (country) countryMap.set(country, (countryMap.get(country) || 0) + 1);
      const city = meta.city as string;
      if (city) cityMap.set(city, (cityMap.get(city) || 0) + 1);

      // Pages
      const pageUrl = meta.pageUrl as string;
      const pageTitle = meta.pageTitle as string;
      if (pageUrl || pageTitle) {
        const key = pageTitle || pageUrl || 'unknown';
        pageMap.set(key, (pageMap.get(key) || 0) + 1);
      }

      // Device
      const deviceType = meta.deviceType as string;
      if (deviceType) deviceMap.set(deviceType, (deviceMap.get(deviceType) || 0) + 1);
      const browser = meta.browser as string;
      if (browser) browserMap.set(browser, (browserMap.get(browser) || 0) + 1);
    }

    const sortedEntries = (map: Map<string, number>) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

    res.json({
      source: "database",
      data: {
        overview: {
          activeUsers30d: visitorIds30d.size,
          sessions30d,
          pageViews30d,
          totalEvents30d: events.length,
          engagementRate: sessions30d > 0 ? Math.round((events.filter(e => e.eventType !== "session_start" && e.eventType !== "page_view").length / sessions30d) * 100) : 0,
        },
        // Event breakdown by type
        eventBreakdown: (() => {
          const byType = new Map<string, number>();
          for (const e of events) byType.set(e.eventType, (byType.get(e.eventType) || 0) + 1);
          return [...byType.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([eventType, count]) => ({ eventType, count }));
        })(),
        // How many events have visitor tracking vs server-generated
        tracking: {
          withVisitorId: events.filter(e => e.visitorId).length,
          withoutVisitorId: events.filter(e => !e.visitorId).length,
          adminEvents: events.filter(e => {
            const meta = e.metadata as Record<string, unknown> | null;
            return meta?.source === 'outreach_invite';
          }).length,
        },
        trafficSources: sortedEntries(sourceMap),
        countries: sortedEntries(countryMap),
        cities: sortedEntries(cityMap),
        topPages: sortedEntries(pageMap).slice(0, 20),
        devices: sortedEntries(deviceMap),
        browsers: sortedEntries(browserMap),
      },
    });
  } catch (error) {
    safeLogError("Analytics traffic query error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── WhatsApp Acquisition Routes ─────────────────────────────────────────────

const DEFAULT_WA_TEMPLATES = [
  {
    name: "Group Intro — Car Parts",
    category: "marketing",
    body: "👋 Hello everyone! We're VOOM Parts — Ghana's new online marketplace for genuine auto spare parts.\n\nFind parts for Toyota, Hyundai, Nissan, Mercedes, and more from verified vendors across Ghana.\n\n🔧 Vendors: List your parts FREE at voomparts.com\n🛒 Buyers: Search 10,000+ parts at voomparts.com\n\nDelivery available across all 16 regions. 🇬🇭",
    variables: [] as string[],
    isDefault: true,
  },
  {
    name: "Vendor Recruitment",
    category: "marketing",
    body: "🚗 Attention spare parts dealers & mechanics in Ghana!\n\nAre you selling auto parts? List your inventory on voomparts.com and reach buyers from Accra, Kumasi, Takoradi, and beyond — for FREE.\n\n✅ Free listing (up to 10 parts)\n✅ WhatsApp buyer inquiries directly to you\n✅ No commission on your first 3 sales\n\nRegister now: voomparts.com/vendor",
    variables: [] as string[],
    isDefault: false,
  },
  {
    name: "Part Request Promo",
    category: "marketing",
    body: "🔍 Can't find the car part you need?\n\nPost a *Part Request* on voomparts.com — describe the part, your car model, and your budget. Verified vendors across Ghana will contact you directly with prices!\n\nNo more calling around. Let the parts come to you. 🇬🇭\n👉 voomparts.com",
    variables: [] as string[],
    isDefault: false,
  },
];

// POST /api/whatsapp/scrape
router.post("/api/whatsapp/scrape", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const { keywords = [], platforms = [] } = req.body;
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: "keywords must be a non-empty array" });
    }

    const discovered = await discoverWhatsAppGroups({
      keywords,
      platforms: platforms.length > 0 ? platforms : ["google", "facebook"],
      serpApiKey: process.env.SERP_API_KEY,
      apifyApiKey: process.env.APIFY_API_KEY,
      useMockIfNoKeys: true,
    });

    // Check if wa_groups table exists before upsert
    const { error: tableTestErr } = await supabase!.from("wa_groups").select("id").limit(1);
    const tableAvailable = !tableTestErr || !isTableMissing(tableTestErr);

    let linksNew = 0;
    const newGroups: any[] = [];

    if (tableAvailable) {
      for (const g of discovered) {
        const { data: existing } = await supabase!
          .from("wa_groups")
          .select("id")
          .eq("inviteLink", g.inviteLink)
          .maybeSingle();

        if (!existing) {
          const { data: inserted } = await supabase!
            .from("wa_groups")
            .insert({
              name: g.name || null,
              inviteLink: g.inviteLink,
              source: g.source,
              sourceUrl: g.sourceUrl,
              keywords: g.keywords,
              status: "discovered",
            })
            .select()
            .single();
          if (inserted) {
            newGroups.push(inserted);
            linksNew++;
          }
        }
      }

      try {
        await supabase!.from("wa_scrape_jobs").insert({
          keywords,
          platforms,
          status: "completed",
          linksFound: discovered.length,
          linksNew,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
      } catch { /* non-fatal */ }
    }

    const useDemo = !tableAvailable;
    const demoGroups = discovered.map((g, i) => ({
      id: i + 1, ...g, status: "discovered", memberCount: 0, waGroupId: null,
      joinedAt: null, lastBroadcastAt: null, notes: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }));

    res.json({
      jobId: Date.now(),
      linksFound: discovered.length,
      linksNew: useDemo ? discovered.length : linksNew,
      groups: useDemo ? demoGroups : newGroups,
      demo: useDemo,
    });
  } catch (error) {
    safeLogError("WhatsApp scrape error", error);
    res.status(500).json({ error: "Scrape failed" });
  }
});

// GET /api/whatsapp/groups
router.get("/api/whatsapp/groups", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    let query = supabase!.from("wa_groups").select("*").order("createdAt", { ascending: false });
    const status = req.query.status as string | undefined;
    if (status) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error) {
      if (isTableMissing(error)) return res.json({ groups: [], total: 0 });
      throw error;
    }
    res.json({ groups: data ?? [], total: data?.length ?? 0 });
  } catch (error) {
    safeLogError("WhatsApp groups fetch error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// PATCH /api/whatsapp/groups/:id/status
router.patch("/api/whatsapp/groups/:id/status", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });

    const { status, notes } = req.body;
    const validStatuses = ["discovered", "approved", "joining", "joined", "rejected", "left", "failed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updateFields: Record<string, any> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (notes !== undefined) updateFields.notes = notes;
    if (status === "joined") updateFields.joinedAt = new Date().toISOString();
    if (status === "approved") {
      console.log(`[WA] Group ${groupId} approved — join would be attempted via API`);
    }

    const { data, error } = await supabase!
      .from("wa_groups")
      .update(updateFields)
      .eq("id", groupId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Group not found" });
    res.json(data);
  } catch (error) {
    safeLogError("WhatsApp group status update error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// POST /api/whatsapp/broadcast
router.post("/api/whatsapp/broadcast", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const { name, messageBody, targetGroupIds, templateId } = req.body;
    if (!name || !messageBody || !Array.isArray(targetGroupIds) || targetGroupIds.length === 0) {
      return res.status(400).json({ error: "name, messageBody, and targetGroupIds are required" });
    }

    // Create broadcast record
    const { data: broadcast, error: insertErr } = await supabase!
      .from("wa_broadcasts")
      .insert({
        name,
        messageBody,
        targetGroupIds,
        templateName: templateId ? String(templateId) : null,
        status: "sending",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Fetch waGroupIds for target groups
    const { data: groups } = await supabase!
      .from("wa_groups")
      .select("id, waGroupId")
      .in("id", targetGroupIds);

    const waGroupIds = (groups || [])
      .map((g: any) => g.waGroupId)
      .filter(Boolean);

    // Send broadcast
    const results = await broadcastToGroups(
      waGroupIds.length > 0 ? waGroupIds : targetGroupIds.map(String),
      messageBody
    );
    const sentCount = results.filter(r => r.success).length;

    // Update broadcast record and groups
    await supabase!
      .from("wa_broadcasts")
      .update({
        status: "sent",
        sentCount,
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", broadcast.id);

    // Update lastBroadcastAt on groups
    await supabase!
      .from("wa_groups")
      .update({ lastBroadcastAt: new Date().toISOString() })
      .in("id", targetGroupIds);

    res.json({ ...broadcast, status: "sent", sentCount, sentAt: new Date().toISOString() });
  } catch (error) {
    safeLogError("WhatsApp broadcast error", error);
    res.status(500).json({ error: "Broadcast failed" });
  }
});

// GET /api/whatsapp/leads
router.get("/api/whatsapp/leads", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    let query = supabase!.from("wa_leads").select("*").order("createdAt", { ascending: false });
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);

    const { data: leads, error } = await query;
    if (error) {
      if (isTableMissing(error)) return res.json({ leads: [], total: 0 });
      throw error;
    }

    // Attach latest message per lead
    const leadsWithMessages = await Promise.all(
      (leads || []).map(async (lead: any) => {
        const { data: msgs } = await supabase!
          .from("wa_messages")
          .select("*")
          .eq("leadId", lead.id)
          .order("sentAt", { ascending: false })
          .limit(1);
        return { ...lead, latestMessage: msgs?.[0] ?? null };
      })
    );

    res.json({ leads: leadsWithMessages, total: leadsWithMessages.length });
  } catch (error) {
    safeLogError("WhatsApp leads fetch error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// GET /api/whatsapp/leads/:id/messages
router.get("/api/whatsapp/leads/:id/messages", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const leadId = parseInt(req.params.id, 10);
    if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });

    const { data, error } = await supabase!
      .from("wa_messages")
      .select("*")
      .eq("leadId", leadId)
      .order("sentAt", { ascending: true });

    if (error) {
      if (isTableMissing(error)) return res.json({ messages: [] });
      throw error;
    }
    res.json({ messages: data ?? [] });
  } catch (error) {
    safeLogError("WhatsApp messages fetch error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// PATCH /api/whatsapp/leads/:id
router.patch("/api/whatsapp/leads/:id", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const leadId = parseInt(req.params.id, 10);
    if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });

    const { type, status, qualificationNotes } = req.body;
    const updateFields: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (type) updateFields.type = type;
    if (status) updateFields.status = status;
    if (qualificationNotes !== undefined) updateFields.qualificationNotes = qualificationNotes;

    const { data: lead, error } = await supabase!
      .from("wa_leads")
      .update(updateFields)
      .eq("id", leadId)
      .select()
      .single();

    if (error) throw error;
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    // If converting to vendor, create a vendor record
    if (type === "vendor" && status === "converted" && !lead.convertedVendorId) {
      const { data: newVendor } = await supabase!
        .from("vendors")
        .insert({
          userId: 0, // placeholder — no user account yet
          businessName: lead.name || `Lead ${lead.phone}`,
          phone: lead.phone,
          whatsapp: lead.phone,
          status: "pending",
        })
        .select()
        .single();

      if (newVendor) {
        await supabase!
          .from("wa_leads")
          .update({ convertedVendorId: newVendor.id })
          .eq("id", leadId);
        lead.convertedVendorId = newVendor.id;
      }
    }

    res.json(lead);
  } catch (error) {
    safeLogError("WhatsApp lead update error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// GET /api/whatsapp/templates
router.get("/api/whatsapp/templates", async (req, res) => {
  if (dbUnavailable(res)) return;
  try {
    const { data, error } = await supabase!
      .from("wa_templates")
      .select("*")
      .order("createdAt", { ascending: true });

    if (error) {
      if (isTableMissing(error)) return res.json({ templates: [] });
      throw error;
    }

    // Seed defaults if empty
    if (!data || data.length === 0) {
      const { data: seeded } = await supabase!
        .from("wa_templates")
        .insert(DEFAULT_WA_TEMPLATES.map(t => ({
          name: t.name,
          category: t.category,
          body: t.body,
          variables: t.variables,
          isDefault: t.isDefault,
          status: "local",
        })))
        .select();
      return res.json({ templates: seeded ?? [] });
    }

    res.json({ templates: data });
  } catch (error) {
    safeLogError("WhatsApp templates fetch error", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// GET /api/webhook/whatsapp (verification)
router.get("/api/webhook/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  if (mode === "subscribe" && verifyWebhookToken(token)) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST /api/webhook/whatsapp (incoming messages)
router.post("/api/webhook/whatsapp", async (req, res) => {
  // Respond immediately — Meta retries if no fast response
  res.sendStatus(200);

  if (!supabase) return;

  try {
    const messages = parseWebhookPayload(req.body);

    for (const msg of messages) {
      if (!msg.text) continue;

      // Find or create lead
      let { data: lead } = await supabase
        .from("wa_leads")
        .select("*")
        .eq("phone", msg.from)
        .maybeSingle();

      if (!lead) {
        const { data: newLead } = await supabase
          .from("wa_leads")
          .insert({
            phone: msg.from,
            name: msg.senderName || null,
            status: "new",
            sourceGroupId: null,
          })
          .select()
          .single();
        lead = newLead;
      }

      if (!lead) continue;

      // Save inbound message
      await supabase
        .from("wa_messages")
        .insert({
          leadId: lead.id,
          groupId: msg.groupId ? parseInt(msg.groupId, 10) || null : null,
          waMessageId: msg.messageId,
          direction: "inbound",
          content: msg.text,
          sentAt: new Date(parseInt(msg.timestamp, 10) * 1000).toISOString(),
        });

      // Process through qualification bot
      const result = processLeadMessage(msg.from, msg.text);

      // Send reply
      const sendResult = await sendTextMessage(msg.from, result.reply);

      // Save outbound message
      await supabase
        .from("wa_messages")
        .insert({
          leadId: lead.id,
          waMessageId: sendResult.messageId || null,
          direction: "outbound",
          content: result.reply,
        });

      // Update lead if qualification complete
      if (result.isComplete && result.leadData) {
        await supabase
          .from("wa_leads")
          .update({
            type: result.leadData.type,
            name: result.leadData.name || lead.name,
            status: "qualified",
            lastContactedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .eq("id", lead.id);
      } else {
        await supabase
          .from("wa_leads")
          .update({
            status: "contacted",
            lastContactedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .eq("id", lead.id);
      }
    }
  } catch (error) {
    safeLogError("WhatsApp webhook processing error", error);
  }
});

export default router;

