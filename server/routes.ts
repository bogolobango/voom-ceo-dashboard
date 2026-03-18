import { Router } from "express";
import { db } from "./db.js";
import { users, cars, bookings, reviews } from "../shared/schema.js";
import { eq, sql, count, sum, avg, desc } from "drizzle-orm";

const router = Router();

// ─── Dashboard Stats (maps Voom car-rental data to CEO dashboard) ───
// Hosts → Vendors, Cars → Products, Bookings → Orders

router.get("/api/stats", async (_req, res) => {
  if (!db) {
    return res.json({ source: "offline" });
  }
  try {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [carCount] = await db.select({ count: count() }).from(cars);
    const [bookingCount] = await db.select({ count: count() }).from(bookings);
    const [hostCount] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.isHost, true));
    const [pendingHostCount] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.verificationStatus, "pending"));
    const [revenueResult] = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings);

    res.json({
      source: "database",
      totalVendors: hostCount.count,
      totalProducts: carCount.count,
      totalOrders: bookingCount.count,
      totalUsers: userCount.count,
      pendingVendors: pendingHostCount.count,
      totalRevenue: String(revenueResult.total || 0),
    });
  } catch (error) {
    console.error("Stats query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Vendors (Hosts) — single query with subqueries, no N+1 ───
router.get("/api/vendors", async (_req, res) => {
  if (!db) {
    return res.json({ source: "offline", data: [] });
  }
  try {
    // Get all hosts with aggregated stats in one query
    const hosts = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        phoneNumber: users.phoneNumber,
        verificationStatus: users.verificationStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.isHost, true))
      .orderBy(desc(users.createdAt));

    // Batch: get car counts per host
    const carCounts = await db
      .select({ hostId: cars.hostId, count: count() })
      .from(cars)
      .groupBy(cars.hostId);
    const carCountMap = new Map(carCounts.map((c) => [c.hostId, c.count]));

    // Batch: get booking stats per host
    const bookingStats = await db
      .select({
        hostId: bookings.hostId,
        count: count(),
        revenue: sum(bookings.totalAmount),
      })
      .from(bookings)
      .groupBy(bookings.hostId);
    const bookingMap = new Map(
      bookingStats.map((b) => [b.hostId, { count: b.count, revenue: b.revenue }])
    );

    // Batch: get avg rating per host (via cars)
    const ratings = await db
      .select({
        hostId: cars.hostId,
        avg: avg(reviews.rating),
      })
      .from(reviews)
      .innerJoin(cars, eq(reviews.carId, cars.id))
      .groupBy(cars.hostId);
    const ratingMap = new Map(ratings.map((r) => [r.hostId, r.avg]));

    // Batch: get primary city per host (most common car location)
    const hostCities = await db
      .select({
        hostId: cars.hostId,
        city: cars.city,
        cnt: count(),
      })
      .from(cars)
      .groupBy(cars.hostId, cars.city)
      .orderBy(desc(count()));
    const cityMap = new Map<number, string>();
    for (const row of hostCities) {
      if (!cityMap.has(row.hostId)) {
        cityMap.set(row.hostId, row.city || "");
      }
    }

    const statusMap: Record<string, string> = {
      approved: "approved",
      pending: "pending",
      rejected: "rejected",
      unverified: "pending",
    };

    const vendorData = hosts.map((host) => {
      const bStats = bookingMap.get(host.id);
      const avgRating = ratingMap.get(host.id);
      return {
        id: host.id,
        businessName: host.fullName || host.username,
        city: cityMap.get(host.id) || null,
        region: null as string | null,
        status: statusMap[host.verificationStatus || "unverified"] || "pending",
        rating: avgRating ? String(Number(avgRating).toFixed(1)) : null,
        totalSales: bStats?.count || 0,
        totalRevenue: Number(bStats?.revenue || 0),
        totalListings: carCountMap.get(host.id) || 0,
        createdAt: host.createdAt?.toISOString() || new Date().toISOString(),
        phone: host.phoneNumber || "",
      };
    });

    res.json({ source: "database", data: vendorData });
  } catch (error) {
    console.error("Vendors query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Orders (Bookings) — single JOIN query, no N+1 ───
router.get("/api/orders", async (_req, res) => {
  if (!db) {
    return res.json({ source: "offline", data: [] });
  }
  try {
    const rows = await db
      .select({
        id: bookings.id,
        totalAmount: bookings.totalAmount,
        platformFee: bookings.platformFee,
        hostPayout: bookings.hostPayout,
        currency: bookings.currency,
        status: bookings.status,
        pickupLocation: bookings.pickupLocation,
        createdAt: bookings.createdAt,
        buyerFullName: users.fullName,
        buyerUsername: users.username,
        carMake: cars.make,
        carModel: cars.model,
        carCity: cars.city,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.userId, users.id))
      .leftJoin(cars, eq(bookings.carId, cars.id))
      .orderBy(desc(bookings.createdAt));

    const orderData = rows.map((b) => ({
      id: b.id,
      orderNumber: `VOM-${String(b.id).padStart(6, "0")}`,
      totalAmount: String(b.totalAmount),
      platformFee: b.platformFee,
      hostPayout: b.hostPayout,
      currency: b.currency,
      status: b.status,
      createdAt: b.createdAt?.toISOString() || new Date().toISOString(),
      buyerName: b.buyerFullName || b.buyerUsername || null,
      shippingCity: b.carCity || b.pickupLocation,
      carInfo: b.carMake ? `${b.carMake} ${b.carModel}` : null,
    }));

    res.json({ source: "database", data: orderData });
  } catch (error) {
    console.error("Orders query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Products (Cars) ───
router.get("/api/products", async (_req, res) => {
  if (!db) {
    return res.json({ source: "offline", data: [] });
  }
  try {
    const allCars = await db
      .select({
        id: cars.id,
        make: cars.make,
        model: cars.model,
        year: cars.year,
        type: cars.type,
        dailyRate: cars.dailyRate,
        currency: cars.currency,
        location: cars.location,
        city: cars.city,
        available: cars.available,
        status: cars.status,
        rating: cars.rating,
        ratingCount: cars.ratingCount,
        createdAt: cars.createdAt,
        transmission: cars.transmission,
        fuelType: cars.fuelType,
        seats: cars.seats,
      })
      .from(cars)
      .orderBy(desc(cars.createdAt));

    const productData = allCars.map((c) => ({
      id: c.id,
      name: `${c.make} ${c.model} ${c.year}`,
      price: String(c.dailyRate),
      currency: c.currency,
      status: c.status || "active",
      views: null as number | null,
      createdAt: c.createdAt?.toISOString() || new Date().toISOString(),
      vehicleMake: c.make,
      vehicleModel: c.model,
      condition: c.available ? "available" : "unavailable",
      city: c.city || c.location,
      type: c.type,
      rating: c.rating,
      ratingCount: c.ratingCount,
    }));

    res.json({ source: "database", data: productData });
  } catch (error) {
    console.error("Products query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Revenue Analytics ───
router.get("/api/revenue", async (_req, res) => {
  if (!db) {
    return res.json({ source: "offline", data: {} });
  }
  try {
    const [total] = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings);

    const [fees] = await db
      .select({ total: sum(bookings.platformFee) })
      .from(bookings);

    const byStatus = await db
      .select({
        status: bookings.status,
        total: sum(bookings.totalAmount),
        count: count(),
      })
      .from(bookings)
      .groupBy(bookings.status);

    const dailyRevenue = await db
      .select({
        date: sql<string>`DATE(${bookings.createdAt})`,
        revenue: sum(bookings.totalAmount),
        orders: count(),
      })
      .from(bookings)
      .where(sql`${bookings.createdAt} >= NOW() - INTERVAL '30 days'`)
      .groupBy(sql`DATE(${bookings.createdAt})`)
      .orderBy(sql`DATE(${bookings.createdAt})`);

    res.json({
      source: "database",
      data: {
        totalRevenue: Number(total.total || 0),
        totalPlatformFees: Number(fees.total || 0),
        byStatus,
        dailyRevenue: dailyRevenue.map((d) => ({
          date: d.date,
          revenue: Number(d.revenue || 0),
          orders: d.orders,
        })),
      },
    });
  } catch (error) {
    console.error("Revenue query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Health Check ───
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
