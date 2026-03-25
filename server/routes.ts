import { Router } from "express";
import { db } from "./db.js";
import {
  users, vendors, products, orders, orderItems, categories,
  reviews, partRequests, analyticsEvents, vendorPayouts,
  subscriptionEvents,
} from "../shared/schema.js";
import { eq, sql, count, sum, avg, desc } from "drizzle-orm";

const router = Router();

// ─── Dashboard Stats ───────────────────────────────────────

router.get("/api/stats", async (_req, res) => {
  if (!db) return res.json({ source: "offline" });
  try {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [vendorCount] = await db.select({ count: count() }).from(vendors);
    const [productCount] = await db.select({ count: count() }).from(products);
    const [orderCount] = await db.select({ count: count() }).from(orders);
    const [categoryCount] = await db.select({ count: count() }).from(categories);
    const [partRequestCount] = await db.select({ count: count() }).from(partRequests);

    const [pendingVendors] = await db
      .select({ count: count() })
      .from(vendors)
      .where(eq(vendors.status, "pending"));

    const [revenueResult] = await db
      .select({ total: sum(orders.totalAmount) })
      .from(orders);

    const [commissionResult] = await db
      .select({ total: sum(orders.commissionAmount) })
      .from(orders);

    res.json({
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
    });
  } catch (error) {
    console.error("Stats query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Vendors ───────────────────────────────────────────────

router.get("/api/vendors", async (_req, res) => {
  if (!db) return res.json({ source: "offline", data: [] });
  try {
    const allVendors = await db
      .select({
        id: vendors.id,
        businessName: vendors.businessName,
        phone: vendors.phone,
        whatsapp: vendors.whatsapp,
        city: vendors.city,
        region: vendors.region,
        status: vendors.status,
        verified: vendors.verified,
        rating: vendors.rating,
        totalSales: vendors.totalSales,
        tier: vendors.tier,
        isFeatured: vendors.isFeatured,
        createdAt: vendors.createdAt,
      })
      .from(vendors)
      .orderBy(desc(vendors.createdAt));

    // Batch: product counts per vendor
    const productCounts = await db
      .select({ vendorId: products.vendorId, count: count() })
      .from(products)
      .groupBy(products.vendorId);
    const productMap = new Map(productCounts.map(p => [p.vendorId, p.count]));

    // Batch: order revenue per vendor
    const orderStats = await db
      .select({
        vendorId: orders.vendorId,
        count: count(),
        revenue: sum(orders.totalAmount),
      })
      .from(orders)
      .groupBy(orders.vendorId);
    const orderMap = new Map(
      orderStats.map(o => [o.vendorId, { count: o.count, revenue: o.revenue }])
    );

    const vendorData = allVendors.map(v => {
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
        rating: v.rating ? String(v.rating) : null,
        totalSales: v.totalSales || 0,
        totalRevenue: Number(oStats?.revenue || 0),
        totalListings: productMap.get(v.id) || 0,
        tier: v.tier,
        isFeatured: v.isFeatured,
        createdAt: v.createdAt.toISOString(),
      };
    });

    res.json({ source: "database", data: vendorData });
  } catch (error) {
    console.error("Vendors query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Orders ────────────────────────────────────────────────

router.get("/api/orders", async (_req, res) => {
  if (!db) return res.json({ source: "offline", data: [] });
  try {
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        totalAmount: orders.totalAmount,
        commissionAmount: orders.commissionAmount,
        currency: orders.currency,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        shippingCity: orders.shippingCity,
        shippingRegion: orders.shippingRegion,
        buyerName: orders.buyerName,
        buyerPhone: orders.buyerPhone,
        vendorId: orders.vendorId,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt));

    // Batch: get vendor names for orders
    const vendorIds = Array.from(new Set(rows.map(r => r.vendorId)));
    const vendorNames = vendorIds.length > 0
      ? await db
          .select({ id: vendors.id, businessName: vendors.businessName })
          .from(vendors)
      : [];
    const vendorNameMap = new Map(vendorNames.map(v => [v.id, v.businessName]));

    const orderData = rows.map(o => ({
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
      createdAt: o.createdAt.toISOString(),
    }));

    res.json({ source: "database", data: orderData });
  } catch (error) {
    console.error("Orders query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Products ──────────────────────────────────────────────

router.get("/api/products", async (_req, res) => {
  if (!db) return res.json({ source: "offline", data: [] });
  try {
    const allProducts = await db
      .select({
        id: products.id,
        name: products.name,
        price: products.price,
        currency: products.currency,
        brand: products.brand,
        condition: products.condition,
        vehicleMake: products.vehicleMake,
        vehicleModel: products.vehicleModel,
        quantity: products.quantity,
        status: products.status,
        views: products.views,
        whatsappTaps: products.whatsappTaps,
        categoryId: products.categoryId,
        vendorId: products.vendorId,
        createdAt: products.createdAt,
      })
      .from(products)
      .orderBy(desc(products.createdAt));

    // Get all categories for lookup
    const allCategories = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories);
    const categoryMap = new Map(allCategories.map(c => [c.id, c.name]));

    const productData = allProducts.map(p => ({
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
      categoryName: p.categoryId ? categoryMap.get(p.categoryId) || null : null,
      vendorId: p.vendorId,
      createdAt: p.createdAt.toISOString(),
    }));

    res.json({ source: "database", data: productData });
  } catch (error) {
    console.error("Products query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Categories ────────────────────────────────────────────

router.get("/api/categories", async (_req, res) => {
  if (!db) return res.json({ source: "offline", data: [] });
  try {
    const allCategories = await db
      .select()
      .from(categories)
      .orderBy(categories.name);

    // Count products per category
    const prodCounts = await db
      .select({ categoryId: products.categoryId, count: count() })
      .from(products)
      .groupBy(products.categoryId);
    const countMap = new Map(prodCounts.map(p => [p.categoryId, p.count]));

    const data = allCategories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      parentId: c.parentId,
      productCount: countMap.get(c.id) || 0,
    }));

    res.json({ source: "database", data });
  } catch (error) {
    console.error("Categories query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Part Requests ─────────────────────────────────────────

router.get("/api/part-requests", async (_req, res) => {
  if (!db) return res.json({ source: "offline", data: [] });
  try {
    const allRequests = await db
      .select()
      .from(partRequests)
      .orderBy(desc(partRequests.createdAt));

    const data = allRequests.map(r => ({
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
      createdAt: r.createdAt.toISOString(),
    }));

    res.json({ source: "database", data });
  } catch (error) {
    console.error("Part requests query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Revenue Analytics ─────────────────────────────────────

router.get("/api/revenue", async (_req, res) => {
  if (!db) return res.json({ source: "offline", data: {} });
  try {
    const [total] = await db
      .select({ total: sum(orders.totalAmount) })
      .from(orders);

    const [commission] = await db
      .select({ total: sum(orders.commissionAmount) })
      .from(orders);

    const byStatus = await db
      .select({
        status: orders.status,
        total: sum(orders.totalAmount),
        count: count(),
      })
      .from(orders)
      .groupBy(orders.status);

    const byPaymentMethod = await db
      .select({
        method: orders.paymentMethod,
        total: sum(orders.totalAmount),
        count: count(),
      })
      .from(orders)
      .groupBy(orders.paymentMethod);

    const byRegion = await db
      .select({
        region: orders.shippingRegion,
        total: sum(orders.totalAmount),
        count: count(),
      })
      .from(orders)
      .groupBy(orders.shippingRegion)
      .orderBy(desc(sum(orders.totalAmount)));

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

    res.json({
      source: "database",
      data: {
        totalRevenue: Number(total.total || 0),
        totalCommission: Number(commission.total || 0),
        byStatus,
        byPaymentMethod: byPaymentMethod.map(p => ({
          method: p.method,
          total: Number(p.total || 0),
          count: p.count,
        })),
        byRegion: byRegion.map(r => ({
          region: r.region || "Unknown",
          total: Number(r.total || 0),
          count: r.count,
        })),
        dailyRevenue: dailyRevenue.map(d => ({
          date: d.date,
          revenue: Number(d.revenue || 0),
          commission: Number(d.commission || 0),
          orders: d.orders,
        })),
      },
    });
  } catch (error) {
    console.error("Revenue query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Growth Analytics ──────────────────────────────────────

router.get("/api/growth", async (_req, res) => {
  if (!db) return res.json({ source: "offline", data: {} });
  try {
    // Monthly vendor growth
    const vendorGrowth = await db
      .select({
        month: sql<string>`TO_CHAR(${vendors.createdAt}, 'YYYY-MM')`,
        count: count(),
      })
      .from(vendors)
      .groupBy(sql`TO_CHAR(${vendors.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${vendors.createdAt}, 'YYYY-MM')`);

    // Monthly order growth
    const orderGrowth = await db
      .select({
        month: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
        count: count(),
        revenue: sum(orders.totalAmount),
      })
      .from(orders)
      .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`);

    // Monthly product growth
    const productGrowth = await db
      .select({
        month: sql<string>`TO_CHAR(${products.createdAt}, 'YYYY-MM')`,
        count: count(),
      })
      .from(products)
      .groupBy(sql`TO_CHAR(${products.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${products.createdAt}, 'YYYY-MM')`);

    // Vendor tier distribution
    const tierDist = await db
      .select({ tier: vendors.tier, count: count() })
      .from(vendors)
      .groupBy(vendors.tier);

    res.json({
      source: "database",
      data: {
        vendorGrowth: vendorGrowth.map(v => ({ month: v.month, count: v.count })),
        orderGrowth: orderGrowth.map(o => ({
          month: o.month,
          count: o.count,
          revenue: Number(o.revenue || 0),
        })),
        productGrowth: productGrowth.map(p => ({ month: p.month, count: p.count })),
        tierDistribution: tierDist.map(t => ({ tier: t.tier, count: t.count })),
      },
    });
  } catch (error) {
    console.error("Growth query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Health Check ──────────────────────────────────────────

router.get("/api/health", async (_req, res) => {
  if (!db) {
    return res.json({
      status: "ok",
      database: "not_configured",
      hint: "Set DATABASE_URL in .env with your Render PostgreSQL connection string",
    });
  }
  try {
    const result = await db.execute(sql`SELECT NOW() as now, current_database() as db_name`);
    res.json({
      status: "ok",
      database: "connected",
      serverTime: (result as any).rows?.[0]?.now,
      dbName: (result as any).rows?.[0]?.db_name,
    });
  } catch (error: any) {
    res.json({ status: "ok", database: "error", error: error.message });
  }
});

export default router;
