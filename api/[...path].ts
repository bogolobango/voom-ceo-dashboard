/**
 * Vercel Serverless Function — catch-all for /api/* routes
 * Wraps the Express router so the same route handlers work on Vercel.
 */

import express from "express";

// Must import the shared schema & db using relative paths for Vercel bundling
import dns from "dns";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";
import { eq, sql, count, sum, desc } from "drizzle-orm";
import NodeCache from "node-cache";

dns.setDefaultResultOrder("ipv4first");

const { Pool } = pg;

// ─── Database Setup ────────────────────────────────────────

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 5, // Serverless: keep pool small
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: true,
    }
  : undefined;

const pool = poolConfig ? new Pool(poolConfig) : null;
const db = pool ? drizzle(pool, { schema }) : null;

// ─── Cache ─────────────────────────────────────────────────

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// ─── Imports from schema ───────────────────────────────────

const {
  users, vendors, products, orders, categories, partRequests,
} = schema;

// ─── Helpers ───────────────────────────────────────────────

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 100;

function parsePagination(query: Record<string, any>) {
  const limit = Math.min(
    Math.max(1, parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const offset = Math.max(0, parseInt(query.offset, 10) || 0);
  return { limit, offset };
}

// ─── Express App ───────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "1mb" }));

// ─── Authentication Middleware ───
const apiKey = process.env.DASHBOARD_API_KEY;
app.use("/api", (req, res, next) => {
  if (req.path === "/health") return next();
  if (apiKey) {
    const provided = req.headers["x-api-key"];
    if (provided !== apiKey) {
      return res.status(401).json({ error: "Unauthorized. Provide a valid X-API-Key header." });
    }
  }
  next();
});

// Health
app.get("/api/health", async (_req, res) => {
  if (!db) {
    return res.json({
      status: "ok",
      database: "not_configured",
      runtime: "vercel-serverless",
      hint: "Set DATABASE_URL in Vercel environment variables",
    });
  }
  try {
    const result = await db.execute(sql`SELECT NOW() as now, current_database() as db_name`);
    res.json({
      status: "ok",
      database: "connected",
      runtime: "vercel-serverless",
      serverTime: (result as any).rows?.[0]?.now,
      dbName: (result as any).rows?.[0]?.db_name,
    });
  } catch (error: any) {
    res.json({ status: "ok", database: "error", error: "Database connection failed" });
  }
});

// Stats
app.get("/api/stats", async (_req, res) => {
  if (!db) return res.json({ source: "offline" });
  const cached = cache.get("stats");
  if (cached) return res.json(cached);

  try {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [vendorCount] = await db.select({ count: count() }).from(vendors);
    const [productCount] = await db.select({ count: count() }).from(products);
    const [orderCount] = await db.select({ count: count() }).from(orders);
    const [categoryCount] = await db.select({ count: count() }).from(categories);
    const [partRequestCount] = await db.select({ count: count() }).from(partRequests);
    const [pendingVendors] = await db
      .select({ count: count() }).from(vendors).where(eq(vendors.status, "pending"));
    const [revenueResult] = await db
      .select({ total: sum(orders.totalAmount) }).from(orders);
    const [commissionResult] = await db
      .select({ total: sum(orders.commissionAmount) }).from(orders);

    const result = {
      source: "database",
      totalUsers: userCount.count,
      totalVendors: vendorCount.count,
      totalProducts: productCount.count,
      totalOrders: orderCount.count,
      totalCategories: categoryCount.count,
      totalPartRequests: partRequestCount.count,
      pendingVendors: pendingVendors.count,
      totalRevenue: String(revenueResult.total || 0),
      totalCommission: String(commissionResult.total || 0),
    };
    cache.set("stats", result);
    res.json(result);
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Vendors
app.get("/api/vendors", async (req, res) => {
  if (!db) return res.json({ source: "offline", data: [] });
  const { limit, offset } = parsePagination(req.query);
  try {
    const allVendors = await db
      .select({
        id: vendors.id, businessName: vendors.businessName,
        phone: vendors.phone, whatsapp: vendors.whatsapp,
        city: vendors.city, region: vendors.region,
        status: vendors.status, verified: vendors.verified,
        rating: vendors.rating, totalSales: vendors.totalSales,
        tier: vendors.tier, isFeatured: vendors.isFeatured,
        createdAt: vendors.createdAt,
      })
      .from(vendors).orderBy(desc(vendors.createdAt)).limit(limit).offset(offset);

    const vendorIds = allVendors.map(v => v.id);
    let productMap = new Map<number, number>();
    let orderMap = new Map<number, { count: number; revenue: string | null }>();

    if (vendorIds.length > 0) {
      const productCounts = await db
        .select({ vendorId: products.vendorId, count: count() })
        .from(products)
        .where(sql`${products.vendorId} IN (${sql.join(vendorIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(products.vendorId);
      productMap = new Map(productCounts.map(p => [p.vendorId, p.count]));

      const orderStats = await db
        .select({ vendorId: orders.vendorId, count: count(), revenue: sum(orders.totalAmount) })
        .from(orders)
        .where(sql`${orders.vendorId} IN (${sql.join(vendorIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(orders.vendorId);
      orderMap = new Map(orderStats.map(o => [o.vendorId, { count: o.count, revenue: o.revenue }]));
    }

    const vendorData = allVendors.map(v => {
      const oStats = orderMap.get(v.id);
      return {
        id: v.id, businessName: v.businessName, phone: v.phone,
        whatsapp: v.whatsapp, city: v.city, region: v.region,
        status: v.status, verified: v.verified,
        rating: v.rating ? String(v.rating) : null,
        totalSales: v.totalSales || 0,
        totalRevenue: Number(oStats?.revenue || 0),
        totalListings: productMap.get(v.id) || 0,
        tier: v.tier, isFeatured: v.isFeatured,
        createdAt: v.createdAt.toISOString(),
      };
    });
    res.json({ source: "database", data: vendorData, pagination: { limit, offset } });
  } catch (error) {
    console.error("Vendors error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Orders
app.get("/api/orders", async (req, res) => {
  if (!db) return res.json({ source: "offline", data: [] });
  const { limit, offset } = parsePagination(req.query);
  try {
    const rows = await db
      .select({
        id: orders.id, orderNumber: orders.orderNumber,
        totalAmount: orders.totalAmount, commissionAmount: orders.commissionAmount,
        currency: orders.currency, status: orders.status,
        paymentMethod: orders.paymentMethod, paymentStatus: orders.paymentStatus,
        shippingCity: orders.shippingCity, shippingRegion: orders.shippingRegion,
        buyerName: orders.buyerName, buyerPhone: orders.buyerPhone,
        vendorName: vendors.businessName, createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(vendors, eq(orders.vendorId, vendors.id))
      .orderBy(desc(orders.createdAt)).limit(limit).offset(offset);

    const orderData = rows.map(o => ({
      id: o.id, orderNumber: o.orderNumber,
      totalAmount: String(o.totalAmount),
      commissionAmount: o.commissionAmount ? String(o.commissionAmount) : null,
      currency: o.currency, status: o.status,
      paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
      shippingCity: o.shippingCity, shippingRegion: o.shippingRegion,
      buyerName: o.buyerName, buyerPhone: o.buyerPhone,
      vendorName: o.vendorName || null, createdAt: o.createdAt.toISOString(),
    }));
    res.json({ source: "database", data: orderData, pagination: { limit, offset } });
  } catch (error) {
    console.error("Orders error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Products
app.get("/api/products", async (req, res) => {
  if (!db) return res.json({ source: "offline", data: [] });
  const { limit, offset } = parsePagination(req.query);
  try {
    const allProducts = await db
      .select({
        id: products.id, name: products.name, price: products.price,
        currency: products.currency, brand: products.brand,
        condition: products.condition, vehicleMake: products.vehicleMake,
        vehicleModel: products.vehicleModel, quantity: products.quantity,
        status: products.status, views: products.views,
        whatsappTaps: products.whatsappTaps, categoryName: categories.name,
        vendorId: products.vendorId, createdAt: products.createdAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(desc(products.createdAt)).limit(limit).offset(offset);

    const productData = allProducts.map(p => ({
      id: p.id, name: p.name, price: String(p.price),
      currency: p.currency, brand: p.brand, condition: p.condition,
      vehicleMake: p.vehicleMake, vehicleModel: p.vehicleModel,
      quantity: p.quantity, status: p.status, views: p.views,
      whatsappTaps: p.whatsappTaps, categoryName: p.categoryName || null,
      vendorId: p.vendorId, createdAt: p.createdAt.toISOString(),
    }));
    res.json({ source: "database", data: productData, pagination: { limit, offset } });
  } catch (error) {
    console.error("Products error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Categories
app.get("/api/categories", async (_req, res) => {
  if (!db) return res.json({ source: "offline", data: [] });
  const cached = cache.get("categories");
  if (cached) return res.json(cached);
  try {
    const allCategories = await db.select().from(categories).orderBy(categories.name);
    const prodCounts = await db
      .select({ categoryId: products.categoryId, count: count() })
      .from(products).groupBy(products.categoryId);
    const countMap = new Map(prodCounts.map(p => [p.categoryId, p.count]));
    const data = allCategories.map(c => ({
      id: c.id, name: c.name, slug: c.slug, icon: c.icon,
      parentId: c.parentId, productCount: countMap.get(c.id) || 0,
    }));
    const result = { source: "database", data };
    cache.set("categories", result);
    res.json(result);
  } catch (error) {
    console.error("Categories error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Part Requests
app.get("/api/part-requests", async (req, res) => {
  if (!db) return res.json({ source: "offline", data: [] });
  const { limit, offset } = parsePagination(req.query);
  try {
    const allRequests = await db
      .select({
        id: partRequests.id, guestName: partRequests.guestName,
        contactPhone: partRequests.contactPhone, make: partRequests.make,
        model: partRequests.model, year: partRequests.year,
        partName: partRequests.partName, description: partRequests.description,
        budget: partRequests.budget, status: partRequests.status,
        createdAt: partRequests.createdAt,
      })
      .from(partRequests).orderBy(desc(partRequests.createdAt)).limit(limit).offset(offset);

    const data = allRequests.map(r => ({
      id: r.id, guestName: r.guestName, contactPhone: r.contactPhone,
      make: r.make, model: r.model, year: r.year, partName: r.partName,
      description: r.description, budget: r.budget, status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
    res.json({ source: "database", data, pagination: { limit, offset } });
  } catch (error) {
    console.error("Part requests error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Revenue
app.get("/api/revenue", async (_req, res) => {
  if (!db) return res.json({ source: "offline", data: {} });
  const cached = cache.get("revenue");
  if (cached) return res.json(cached);
  try {
    const [total] = await db.select({ total: sum(orders.totalAmount) }).from(orders);
    const [commission] = await db.select({ total: sum(orders.commissionAmount) }).from(orders);
    const byStatus = await db
      .select({ status: orders.status, total: sum(orders.totalAmount), count: count() })
      .from(orders).groupBy(orders.status);
    const byPaymentMethod = await db
      .select({ method: orders.paymentMethod, total: sum(orders.totalAmount), count: count() })
      .from(orders).groupBy(orders.paymentMethod);
    const byRegion = await db
      .select({ region: orders.shippingRegion, total: sum(orders.totalAmount), count: count() })
      .from(orders).groupBy(orders.shippingRegion).orderBy(desc(sum(orders.totalAmount))).limit(10);
    const dailyRevenue = await db
      .select({
        date: sql<string>`DATE(${orders.createdAt})`,
        revenue: sum(orders.totalAmount),
        commission: sum(orders.commissionAmount),
        orders: count(),
      })
      .from(orders)
      .where(sql`${orders.createdAt} >= NOW() - INTERVAL '30 days'`)
      .groupBy(sql`DATE(${orders.createdAt})`)
      .orderBy(sql`DATE(${orders.createdAt})`);

    const result = {
      source: "database",
      data: {
        totalRevenue: Number(total.total || 0),
        totalCommission: Number(commission.total || 0),
        byStatus,
        byPaymentMethod: byPaymentMethod.map(p => ({
          method: p.method, total: Number(p.total || 0), count: p.count,
        })),
        byRegion: byRegion.map(r => ({
          region: r.region || "Unknown", total: Number(r.total || 0), count: r.count,
        })),
        dailyRevenue: dailyRevenue.map(d => ({
          date: d.date, revenue: Number(d.revenue || 0),
          commission: Number(d.commission || 0), orders: d.orders,
        })),
      },
    };
    cache.set("revenue", result, 600);
    res.json(result);
  } catch (error) {
    console.error("Revenue error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Growth
app.get("/api/growth", async (_req, res) => {
  if (!db) return res.json({ source: "offline", data: {} });
  const cached = cache.get("growth");
  if (cached) return res.json(cached);
  try {
    const vendorGrowth = await db
      .select({ month: sql<string>`TO_CHAR(${vendors.createdAt}, 'YYYY-MM')`, count: count() })
      .from(vendors)
      .groupBy(sql`TO_CHAR(${vendors.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${vendors.createdAt}, 'YYYY-MM')`);
    const orderGrowth = await db
      .select({ month: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`, count: count(), revenue: sum(orders.totalAmount) })
      .from(orders)
      .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`);
    const productGrowth = await db
      .select({ month: sql<string>`TO_CHAR(${products.createdAt}, 'YYYY-MM')`, count: count() })
      .from(products)
      .groupBy(sql`TO_CHAR(${products.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${products.createdAt}, 'YYYY-MM')`);
    const tierDist = await db
      .select({ tier: vendors.tier, count: count() })
      .from(vendors).groupBy(vendors.tier);

    const result = {
      source: "database",
      data: {
        vendorGrowth: vendorGrowth.map(v => ({ month: v.month, count: v.count })),
        orderGrowth: orderGrowth.map(o => ({ month: o.month, count: o.count, revenue: Number(o.revenue || 0) })),
        productGrowth: productGrowth.map(p => ({ month: p.month, count: p.count })),
        tierDistribution: tierDist.map(t => ({ tier: t.tier, count: t.count })),
      },
    };
    cache.set("growth", result, 900);
    res.json(result);
  } catch (error) {
    console.error("Growth error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Export for Vercel
export default app;
