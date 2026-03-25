import { Router } from "express";
import NodeCache from "node-cache";
import { supabase } from "./supabase.js";
import { safeLogError } from "./index.js";

const router = Router();

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const CACHE_KEYS = {
  stats: "api:stats",
  revenue: "api:revenue",
  growth: "api:growth",
  categories: "api:categories",
};

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 100;

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
      .select("totalAmount");

    const totalRevenue = (revenueData || []).reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);

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
      totalCommission: "0",
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
      .select("id, businessName, phone, whatsapp, city, region, status, verified, rating, totalSales, tier, isFeatured, createdAt")
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
      .select("id, vendorId, categoryId, name, price, currency, brand, condition, vehicleMake, vehicleModel, quantity, status, views, whatsappTaps, createdAt")
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
      supabase!.from("vendors").select("createdAt, tier"),
      supabase!.from("orders").select("createdAt, totalAmount"),
      supabase!.from("products").select("createdAt"),
      supabase!.from("vendors").select("tier"),
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
      hint: "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables",
    });
  }
  try {
    const { count, error } = await supabase.from("users").select("*", { count: "exact", head: true });
    if (error) throw error;
    res.json({ status: "ok", database: "connected", userCount: count });
  } catch (error: any) {
    res.json({ status: "ok", database: "error", error: error.message });
  }
});

export default router;
