import { Router } from "express";
import { db } from "./db.js";
import { users, cars, bookings, reviews, payments } from "../shared/schema.js";
import { eq, sql, count, sum, avg, desc } from "drizzle-orm";

const router = Router();

// ─── Dashboard Stats (maps Voom car-rental data to CEO dashboard) ───
// Hosts → Vendors, Cars → Products, Bookings → Orders

router.get("/api/stats", async (_req, res) => {
  if (!db) {
    return res.json({ source: "mock" });
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

// ─── Vendors (Hosts) ───
router.get("/api/vendors", async (_req, res) => {
  if (!db) {
    return res.json({ source: "mock", data: [] });
  }
  try {
    const hosts = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        phoneNumber: users.phoneNumber,
        isVerified: users.isVerified,
        verificationStatus: users.verificationStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.isHost, true))
      .orderBy(desc(users.createdAt));

    // For each host, get their car count and booking stats
    const vendorData = await Promise.all(
      hosts.map(async (host) => {
        const [carStats] = await db!
          .select({ count: count() })
          .from(cars)
          .where(eq(cars.hostId, host.id));
        const [bookingStats] = await db!
          .select({
            count: count(),
            revenue: sum(bookings.totalAmount),
          })
          .from(bookings)
          .where(eq(bookings.hostId, host.id));
        const [avgRating] = await db!
          .select({ avg: avg(reviews.rating) })
          .from(reviews)
          .innerJoin(cars, eq(reviews.carId, cars.id))
          .where(eq(cars.hostId, host.id));

        // Map host → vendor format for dashboard
        const statusMap: Record<string, string> = {
          approved: "approved",
          pending: "pending",
          rejected: "rejected",
          unverified: "pending",
        };

        return {
          id: host.id,
          businessName: host.fullName || host.username,
          city: null as string | null, // Derived from car locations
          region: null as string | null,
          status: statusMap[host.verificationStatus || "unverified"] || "pending",
          rating: avgRating.avg ? String(Number(avgRating.avg).toFixed(1)) : null,
          totalSales: bookingStats.count,
          totalRevenue: Number(bookingStats.revenue || 0),
          totalListings: carStats.count,
          createdAt: host.createdAt?.toISOString() || new Date().toISOString(),
          phone: host.phoneNumber || "",
        };
      })
    );

    res.json({ source: "database", data: vendorData });
  } catch (error) {
    console.error("Vendors query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Orders (Bookings) ───
router.get("/api/orders", async (_req, res) => {
  if (!db) {
    return res.json({ source: "mock", data: [] });
  }
  try {
    const allBookings = await db
      .select({
        id: bookings.id,
        totalAmount: bookings.totalAmount,
        platformFee: bookings.platformFee,
        hostPayout: bookings.hostPayout,
        currency: bookings.currency,
        status: bookings.status,
        pickupLocation: bookings.pickupLocation,
        dropoffLocation: bookings.dropoffLocation,
        startDate: bookings.startDate,
        endDate: bookings.endDate,
        createdAt: bookings.createdAt,
        carId: bookings.carId,
        userId: bookings.userId,
        hostId: bookings.hostId,
      })
      .from(bookings)
      .orderBy(desc(bookings.createdAt));

    // Map bookings → orders format for dashboard
    const orderData = await Promise.all(
      allBookings.map(async (b) => {
        const [buyer] = await db!
          .select({ fullName: users.fullName, username: users.username })
          .from(users)
          .where(eq(users.id, b.userId));
        const [car] = await db!
          .select({ make: cars.make, model: cars.model, city: cars.city })
          .from(cars)
          .where(eq(cars.id, b.carId));

        return {
          id: b.id,
          orderNumber: `VOM-${String(b.id).padStart(6, "0")}`,
          totalAmount: String(b.totalAmount),
          platformFee: b.platformFee,
          hostPayout: b.hostPayout,
          currency: b.currency,
          status: b.status,
          createdAt: b.createdAt?.toISOString() || new Date().toISOString(),
          buyerName: buyer?.fullName || buyer?.username || null,
          shippingCity: car?.city || b.pickupLocation,
          carInfo: car ? `${car.make} ${car.model}` : null,
        };
      })
    );

    res.json({ source: "database", data: orderData });
  } catch (error) {
    console.error("Orders query error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ─── Products (Cars) ───
router.get("/api/products", async (_req, res) => {
  if (!db) {
    return res.json({ source: "mock", data: [] });
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

    // Map cars → products format for dashboard
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
    return res.json({ source: "mock", data: {} });
  }
  try {
    // Total revenue
    const [total] = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings);

    // Platform fees collected
    const [fees] = await db
      .select({ total: sum(bookings.platformFee) })
      .from(bookings);

    // Revenue by status
    const byStatus = await db
      .select({
        status: bookings.status,
        total: sum(bookings.totalAmount),
        count: count(),
      })
      .from(bookings)
      .groupBy(bookings.status);

    // Daily revenue (last 30 days)
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
    return res.json({ status: "ok", database: "not_configured" });
  }
  try {
    const [result] = await db.select({ now: sql<string>`NOW()` }).from(users).limit(1);
    res.json({ status: "ok", database: "connected", serverTime: result?.now });
  } catch (error: any) {
    res.json({ status: "ok", database: "error", error: error.message });
  }
});

export default router;
