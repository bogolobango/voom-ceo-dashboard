/**
 * Vite Dev Server API Plugin
 * Embeds Express-style API routes directly into Vite's dev server middleware.
 * This allows the dashboard to connect to the database without a separate Express process.
 */
import type { Plugin, ViteDevServer } from "vite";
import { lookup } from "node:dns/promises";
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Custom DNS lookup that forces IPv4 resolution.
 * The v0 sandbox does not support IPv6 outbound connections.
 */
function ipv4Lookup(hostname: string, options: any, cb: Function) {
  lookup(hostname, { family: 4 })
    .then((result) => cb(null, result.address, 4))
    .catch((err) => cb(err));
}

function getPool(): pg.Pool | null {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[vite-api] DATABASE_URL not set — API routes will return offline data.");
    return null;
  }

  // Parse the connection string to extract host/port/user/password/database
  const parsed = new URL(url);
  pool = new Pool({
    host: parsed.hostname,
    port: Number(parsed.port) || 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace("/", ""),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
    // Force IPv4 DNS resolution at the connection level
    lookup: ipv4Lookup as any,
  });
  pool.on("error", (err) => console.error("[vite-api] Pool error:", err.message));
  console.log("[vite-api] PostgreSQL pool created (IPv4 forced).");
  return pool;
}

/** Helper: run a query and return rows */
async function query(text: string, params?: unknown[]): Promise<any[]> {
  const p = getPool();
  if (!p) return [];
  const res = await p.query(text, params);
  return res.rows;
}

/** Send JSON */
function json(res: any, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export default function viteApiPlugin(): Plugin {
  return {
    name: "voom-api",
    configureServer(server: ViteDevServer) {
      // Register middleware BEFORE Vite's own middleware
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";

        // Only handle /api/* routes
        if (!url.startsWith("/api/")) return next();

        try {
          // ─── /api/health ───
          if (url === "/api/health") {
            const p = getPool();
            if (!p) {
              return json(res, {
                status: "ok",
                database: "not_configured",
                hint: "Set DATABASE_URL in environment variables",
              });
            }
            try {
              const rows = await query("SELECT NOW() as now, current_database() as db_name");
              return json(res, {
                status: "ok",
                database: "connected",
                serverTime: rows[0]?.now,
                dbName: rows[0]?.db_name,
              });
            } catch (err: any) {
              return json(res, { status: "ok", database: "error", error: err.message });
            }
          }

          // ─── /api/stats ───
          if (url === "/api/stats") {
            const p = getPool();
            if (!p) return json(res, { source: "offline" });

            const [userCount] = await query("SELECT COUNT(*)::int as count FROM users");
            const [carCount] = await query("SELECT COUNT(*)::int as count FROM cars");
            const [bookingCount] = await query("SELECT COUNT(*)::int as count FROM bookings");
            const [hostCount] = await query("SELECT COUNT(*)::int as count FROM users WHERE is_host = true");
            const [pendingHostCount] = await query(
              "SELECT COUNT(*)::int as count FROM users WHERE verification_status = 'pending'"
            );
            const [revenueResult] = await query("SELECT COALESCE(SUM(total_amount), 0)::text as total FROM bookings");

            return json(res, {
              source: "database",
              totalVendors: hostCount?.count ?? 0,
              totalProducts: carCount?.count ?? 0,
              totalOrders: bookingCount?.count ?? 0,
              totalUsers: userCount?.count ?? 0,
              pendingVendors: pendingHostCount?.count ?? 0,
              totalRevenue: revenueResult?.total ?? "0",
            });
          }

          // ─── /api/vendors ───
          if (url === "/api/vendors") {
            const p = getPool();
            if (!p) return json(res, { source: "offline", data: [] });

            const hosts = await query(`
              SELECT id, full_name, username, phone_number, verification_status, created_at
              FROM users WHERE is_host = true ORDER BY created_at DESC
            `);

            const carCounts = await query(`
              SELECT host_id, COUNT(*)::int as count FROM cars GROUP BY host_id
            `);
            const carCountMap = new Map(carCounts.map((c: any) => [c.host_id, c.count]));

            const bookingStats = await query(`
              SELECT host_id, COUNT(*)::int as count, COALESCE(SUM(total_amount), 0) as revenue
              FROM bookings GROUP BY host_id
            `);
            const bookingMap = new Map(
              bookingStats.map((b: any) => [b.host_id, { count: b.count, revenue: b.revenue }])
            );

            const ratings = await query(`
              SELECT c.host_id, AVG(r.rating)::numeric(3,1) as avg
              FROM reviews r INNER JOIN cars c ON r.car_id = c.id
              GROUP BY c.host_id
            `);
            const ratingMap = new Map(ratings.map((r: any) => [r.host_id, r.avg]));

            const hostCities = await query(`
              SELECT host_id, city, COUNT(*)::int as cnt FROM cars
              GROUP BY host_id, city ORDER BY COUNT(*) DESC
            `);
            const cityMap = new Map<number, string>();
            for (const row of hostCities) {
              if (!cityMap.has(row.host_id)) cityMap.set(row.host_id, row.city || "");
            }

            const statusMap: Record<string, string> = {
              approved: "approved",
              pending: "pending",
              rejected: "rejected",
              unverified: "pending",
            };

            const vendorData = hosts.map((host: any) => {
              const bStats = bookingMap.get(host.id);
              const avgRating = ratingMap.get(host.id);
              return {
                id: host.id,
                businessName: host.full_name || host.username,
                city: cityMap.get(host.id) || null,
                region: null,
                status: statusMap[host.verification_status || "unverified"] || "pending",
                rating: avgRating ? String(Number(avgRating).toFixed(1)) : null,
                totalSales: bStats?.count || 0,
                totalRevenue: Number(bStats?.revenue || 0),
                totalListings: carCountMap.get(host.id) || 0,
                createdAt: host.created_at?.toISOString?.() || new Date().toISOString(),
                phone: host.phone_number || "",
              };
            });

            return json(res, { source: "database", data: vendorData });
          }

          // ─── /api/orders ───
          if (url === "/api/orders") {
            const p = getPool();
            if (!p) return json(res, { source: "offline", data: [] });

            const rows = await query(`
              SELECT b.id, b.total_amount, b.platform_fee, b.host_payout, b.currency,
                     b.status, b.pickup_location, b.created_at,
                     u.full_name as buyer_full_name, u.username as buyer_username,
                     c.make as car_make, c.model as car_model, c.city as car_city
              FROM bookings b
              LEFT JOIN users u ON b.user_id = u.id
              LEFT JOIN cars c ON b.car_id = c.id
              ORDER BY b.created_at DESC
            `);

            const orderData = rows.map((b: any) => ({
              id: b.id,
              orderNumber: `VOM-${String(b.id).padStart(6, "0")}`,
              totalAmount: String(b.total_amount),
              platformFee: b.platform_fee,
              hostPayout: b.host_payout,
              currency: b.currency,
              status: b.status,
              createdAt: b.created_at?.toISOString?.() || new Date().toISOString(),
              buyerName: b.buyer_full_name || b.buyer_username || null,
              shippingCity: b.car_city || b.pickup_location,
              carInfo: b.car_make ? `${b.car_make} ${b.car_model}` : null,
            }));

            return json(res, { source: "database", data: orderData });
          }

          // ─── /api/products ───
          if (url === "/api/products") {
            const p = getPool();
            if (!p) return json(res, { source: "offline", data: [] });

            const allCars = await query(`
              SELECT id, make, model, year, type, daily_rate, currency, location, city,
                     available, status, rating, rating_count, created_at,
                     transmission, fuel_type, seats
              FROM cars ORDER BY created_at DESC
            `);

            const productData = allCars.map((c: any) => ({
              id: c.id,
              name: `${c.make} ${c.model} ${c.year}`,
              price: String(c.daily_rate),
              currency: c.currency,
              status: c.status || "active",
              views: null,
              createdAt: c.created_at?.toISOString?.() || new Date().toISOString(),
              vehicleMake: c.make,
              vehicleModel: c.model,
              condition: c.available ? "available" : "unavailable",
              city: c.city || c.location,
              type: c.type,
              rating: c.rating,
              ratingCount: c.rating_count,
            }));

            return json(res, { source: "database", data: productData });
          }

          // ─── /api/revenue ───
          if (url === "/api/revenue") {
            const p = getPool();
            if (!p) return json(res, { source: "offline", data: {} });

            const [total] = await query("SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings");
            const [fees] = await query("SELECT COALESCE(SUM(platform_fee), 0) as total FROM bookings");
            const byStatus = await query(`
              SELECT status, COALESCE(SUM(total_amount), 0) as total, COUNT(*)::int as count
              FROM bookings GROUP BY status
            `);
            const dailyRevenue = await query(`
              SELECT DATE(created_at)::text as date,
                     COALESCE(SUM(total_amount), 0) as revenue,
                     COUNT(*)::int as orders
              FROM bookings
              WHERE created_at >= NOW() - INTERVAL '30 days'
              GROUP BY DATE(created_at)
              ORDER BY DATE(created_at)
            `);

            return json(res, {
              source: "database",
              data: {
                totalRevenue: Number(total?.total || 0),
                totalPlatformFees: Number(fees?.total || 0),
                byStatus,
                dailyRevenue: dailyRevenue.map((d: any) => ({
                  date: d.date,
                  revenue: Number(d.revenue || 0),
                  orders: d.orders,
                })),
              },
            });
          }

          // No matching API route
          return json(res, { error: "Not found" }, 404);
        } catch (err: any) {
          console.error("[vite-api] Error:", err);
          return json(res, { error: "Internal server error", detail: err.message }, 500);
        }
      });
    },
  };
}
