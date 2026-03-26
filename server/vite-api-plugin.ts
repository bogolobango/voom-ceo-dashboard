/**
 * Vite Dev Server API Plugin
 * Handles /api/* routes via Supabase JS client during development.
 */
import type { Plugin, ViteDevServer } from "vite";
import { createClient } from "@supabase/supabase-js";

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("[vite-api] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — API routes will return offline data.");
    return null;
  }
  _supabase = createClient(url, key);
  console.log("[vite-api] Supabase client ready.");
  return _supabase;
}

function json(res: any, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function monthKey(d: string) {
  return d.slice(0, 7);
}

function parseBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: any) => { body += chunk; });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

export default function viteApiPlugin(): Plugin {
  return {
    name: "voom-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (!url.startsWith("/api/")) return next();

        const sb = getSupabase();

        try {
          // ─── /api/health ───
          if (url === "/api/health") {
            if (!sb) return json(res, { status: "ok", database: "not_configured", hint: "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY" });
            const { count, error } = await sb.from("users").select("*", { count: "exact", head: true });
            if (error) return json(res, { status: "ok", database: "error", error: error.message });
            return json(res, { status: "ok", database: "connected", userCount: count });
          }

          // ─── /api/stats ───
          if (url === "/api/stats") {
            if (!sb) return json(res, { source: "offline" });

            const [
              { count: totalUsers },
              { count: totalVendors },
              { count: totalProducts },
              { count: totalOrders },
              { count: totalCategories },
              { count: totalPartRequests },
              { count: pendingVendors },
            ] = await Promise.all([
              sb.from("users").select("*", { count: "exact", head: true }),
              sb.from("vendors").select("*", { count: "exact", head: true }),
              sb.from("products").select("*", { count: "exact", head: true }),
              sb.from("orders").select("*", { count: "exact", head: true }),
              sb.from("categories").select("*", { count: "exact", head: true }),
              sb.from("part_requests").select("*", { count: "exact", head: true }),
              sb.from("vendors").select("*", { count: "exact", head: true }).eq("status", "pending"),
            ]);

            const { data: orderRevenue } = await sb.from("orders").select("totalAmount");
            const totalRevenue = (orderRevenue || []).reduce((s: number, o: any) => s + (Number(o.totalAmount) || 0), 0);

            return json(res, {
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
            });
          }

          // ─── /api/briefing ───
          if (url === "/api/briefing" && req.method === "GET") {
            if (!sb) return json(res, { source: "offline", data: { todaySearches: 0, yesterdaySearches: 0, todayWhatsappTaps: 0, yesterdayWhatsappTaps: 0, todayProductViews: 0, yesterdayProductViews: 0, todayNewVendors: 0, yesterdayNewVendors: 0, todayPartRequests: 0, yesterdayPartRequests: 0, todayNewUsers: 0, yesterdayNewUsers: 0, totalUsers: 0, topSearches: [], zeroResultSearches: [], expiringVendors: [], activePaidVendors: 0, mrr: 0, topCategories: [] } });

            const TIER_PRICES: Record<string, number> = { starter: 100, pro: 200, business: 800, enterprise: 2000 };
            const now = new Date();
            const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
            const yesterdayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 86400000).toISOString();
            const twentyFourHoursAgo = new Date(now.getTime() - 86400000).toISOString();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
            const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000).toISOString();
            const nowISO = now.toISOString();

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
              sb.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "search").gte("createdAt", todayStart),
              sb.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "whatsapp_tap").gte("createdAt", todayStart),
              sb.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "product_view").gte("createdAt", todayStart),
              sb.from("vendors").select("*", { count: "exact", head: true }).gte("createdAt", todayStart),
              sb.from("part_requests").select("*", { count: "exact", head: true }).gte("createdAt", todayStart),
              sb.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "search").gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
              sb.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "whatsapp_tap").gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
              sb.from("analytics_events").select("*", { count: "exact", head: true }).eq("eventType", "product_view").gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
              sb.from("vendors").select("*", { count: "exact", head: true }).gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
              sb.from("part_requests").select("*", { count: "exact", head: true }).gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
              sb.from("analytics_events").select("metadata").eq("eventType", "search").gte("createdAt", twentyFourHoursAgo),
              sb.from("vendors").select("id, businessName, tier, tierExpiresAt").neq("tier", "free").gte("tierExpiresAt", nowISO).lte("tierExpiresAt", sevenDaysFromNow),
              sb.from("vendors").select("tier, tierExpiresAt").neq("tier", "free"),
              sb.from("users").select("*", { count: "exact", head: true }).gte("createdAt", todayStart),
              sb.from("users").select("*", { count: "exact", head: true }),
              sb.from("users").select("*", { count: "exact", head: true }).gte("createdAt", yesterdayStart).lt("createdAt", todayStart),
              sb.from("analytics_events").select("productId").eq("eventType", "product_view").gte("createdAt", thirtyDaysAgo).not("productId", "is", null),
            ]);

            // Build top searches from search metadata
            const queryCountMap = new Map<string, number>();
            const queryResultMap = new Map<string, number>();
            const zeroResultMap = new Map<string, number>();
            for (const evt of (recentSearchEvents || []) as any[]) {
              const meta = evt.metadata as Record<string, unknown> | null;
              if (!meta) continue;
              const query = meta.query as string | undefined;
              if (!query) continue;
              queryCountMap.set(query, (queryCountMap.get(query) || 0) + 1);
              const resultCount = ((meta.resultsCount ?? meta.resultCount ?? 0) as number);
              queryResultMap.set(query, resultCount);
              if (resultCount === 0) zeroResultMap.set(query, (zeroResultMap.get(query) || 0) + 1);
            }
            const topSearches = [...queryCountMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
              .map(([query, count]) => ({ query, count, results: queryResultMap.get(query) ?? 0 }));
            const zeroResultSearches = [...zeroResultMap.entries()].sort((a, b) => b[1] - a[1])
              .map(([query, count]) => ({ query, count }));

            // Expiring vendors
            const expiringVendors = ((expiringVendorsRaw || []) as any[]).map((v) => ({ id: v.id, businessName: v.businessName, tier: v.tier, tierExpiresAt: v.tierExpiresAt }));

            // MRR calculation
            let activePaidVendors = 0;
            let mrr = 0;
            for (const v of (paidVendorsRaw || []) as any[]) {
              if (!v.tierExpiresAt || v.tierExpiresAt > nowISO) {
                activePaidVendors++;
                mrr += TIER_PRICES[v.tier] || 0;
              }
            }

            // Top product categories by 30-day views
            let topCategories: { name: string; views: number }[] = [];
            const productIdCounts = new Map<number, number>();
            for (const evt of (productViewEvents || []) as any[]) {
              if (evt.productId) productIdCounts.set(evt.productId, (productIdCounts.get(evt.productId) || 0) + 1);
            }
            const topProductIds = [...productIdCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id]) => id);
            if (topProductIds.length > 0) {
              const { data: productsData } = await sb.from("products").select("id, categoryId").in("id", topProductIds);
              if (productsData && productsData.length > 0) {
                const catCounts = new Map<number, number>();
                for (const p of productsData as any[]) {
                  if (p.categoryId) catCounts.set(p.categoryId, (catCounts.get(p.categoryId) || 0) + (productIdCounts.get(p.id) || 0));
                }
                const topCatIds = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
                if (topCatIds.length > 0) {
                  const { data: catsData } = await sb.from("categories").select("id, name").in("id", topCatIds);
                  topCategories = topCatIds.map(id => ({
                    name: (catsData as any[])?.find((c) => c.id === id)?.name || `Category ${id}`,
                    views: catCounts.get(id) || 0,
                  }));
                }
              }
            }

            return json(res, {
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
            });
          }

          // ─── /api/analytics/users/:id (before /api/analytics/users) ───
          if (url.startsWith("/api/analytics/users/") && req.method === "GET") {
            const userId = parseInt(url.split("/")[4], 10);
            if (!sb || isNaN(userId)) return json(res, { source: "offline", data: null });

            const [{ data: userData }, { data: activityData }] = await Promise.all([
              sb.from("users").select("*").eq("id", userId).single(),
              sb.from("analytics_events")
                .select("id, eventType, productId, metadata, createdAt")
                .eq("userId", userId)
                .order("createdAt", { ascending: false })
                .limit(150),
            ]);

            const productIds = [...new Set(((activityData || []) as any[]).filter(e => e.productId).map(e => e.productId))];
            const productNames: Record<number, string> = {};
            if (productIds.length > 0) {
              const { data: prods } = await sb.from("products").select("id, name").in("id", productIds);
              for (const p of (prods || []) as any[]) productNames[p.id] = p.name;
            }

            const activity = ((activityData || []) as any[]).map(e => ({
              id: e.id, eventType: e.eventType, productId: e.productId,
              productName: e.productId ? (productNames[e.productId] || null) : null,
              metadata: e.metadata, createdAt: e.createdAt,
            }));

            return json(res, { source: "database", data: { user: userData, activity } });
          }

          // ─── /api/analytics/users ───
          if (url === "/api/analytics/users" && req.method === "GET") {
            if (!sb) return json(res, { source: "offline", data: [] });

            const [{ data: usersData }, { data: eventsData }] = await Promise.all([
              sb.from("users").select("id, email, phone, name, firstName, lastName, city, region, profileImage, createdAt").order("createdAt", { ascending: false }),
              sb.from("analytics_events").select("userId, eventType, createdAt").order("createdAt", { ascending: false }),
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

            return json(res, { source: "database", data: users });
          }

          // ─── /api/analytics/products ───
          if (url.startsWith("/api/analytics/products") && req.method === "GET") {
            if (!sb) return json(res, { source: "offline", data: null });

            const qParams = new URL(req.url!, "http://localhost").searchParams;
            const timeRange = qParams.get("timeRange") || "30d";
            const now = new Date();
            let startDate: string | null = null;
            if (timeRange === "1d") startDate = new Date(now.getTime() - 86400000).toISOString();
            else if (timeRange === "7d") startDate = new Date(now.getTime() - 7 * 86400000).toISOString();
            else if (timeRange === "30d") startDate = new Date(now.getTime() - 30 * 86400000).toISOString();

            const buildQ = (et: string) => {
              let q = sb!.from("analytics_events").select("id, userId, productId, eventType, metadata, createdAt").eq("eventType", et);
              if (startDate) q = q.gte("createdAt", startDate);
              return q;
            };

            const [{ data: viewEvents }, { data: searchEvents }, { data: waTapEvents }, { data: allProducts }] = await Promise.all([
              buildQ("product_view"),
              buildQ("search"),
              buildQ("whatsapp_tap"),
              sb.from("products").select("id, name, price, imageUrl, categoryId, vendorId, status").limit(500),
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
              if (!evt.productId) continue;
              productWaTaps.set(evt.productId, (productWaTaps.get(evt.productId) || 0) + 1);
            }

            const catIds = [...new Set(((allProducts || []) as any[]).filter(p => p.categoryId).map(p => p.categoryId))];
            const catNames: Record<number, string> = {};
            if (catIds.length > 0) {
              const { data: catsData } = await sb.from("categories").select("id, name").in("id", catIds);
              for (const c of (catsData || []) as any[]) catNames[c.id] = c.name;
            }

            const productMap = new Map<number, any>();
            for (const p of (allProducts || []) as any[]) productMap.set(p.id, { ...p, categoryName: p.categoryId ? (catNames[p.categoryId] || null) : null });

            const topProducts = [...productViewCounts.entries()]
              .sort((a, b) => b[1].views - a[1].views).slice(0, 20)
              .map(([productId, stats]) => {
                const p = productMap.get(productId);
                const waTaps = productWaTaps.get(productId) || 0;
                return { productId, productName: p?.name || `Product ${productId}`, categoryId: p?.categoryId || null, categoryName: p?.categoryName || null, vendorId: p?.vendorId || null, price: p?.price || null, imageUrl: p?.imageUrl || null, views: stats.views, uniqueViewers: stats.viewers.size, waTaps, conversionRate: stats.views > 0 ? waTaps / stats.views : 0, lastViewed: stats.lastViewed };
              });

            const viewedIds = new Set(productViewCounts.keys());
            const deadStock = ((allProducts || []) as any[])
              .filter(p => !viewedIds.has(p.id) && p.status !== "deleted").slice(0, 20)
              .map(p => ({ productId: p.id, productName: p.name, categoryId: p.categoryId, categoryName: p.categoryId ? (catNames[p.categoryId] || null) : null, vendorId: p.vendorId, price: p.price, imageUrl: p.imageUrl, views: 0, uniqueViewers: 0, waTaps: 0, conversionRate: 0, lastViewed: null }));

            const catViewCounts = new Map<number, number>();
            for (const [productId, stats] of productViewCounts) {
              const p = productMap.get(productId);
              if (p?.categoryId) catViewCounts.set(p.categoryId, (catViewCounts.get(p.categoryId) || 0) + stats.views);
            }
            const categoryTrends = [...catViewCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
              .map(([catId, views]) => ({ name: catNames[catId] || `Category ${catId}`, views, change: 0 }));

            return json(res, {
              source: "database",
              data: {
                timeRange,
                funnel: { searches: (searchEvents || []).length, views: (viewEvents || []).length, waTaps: (waTapEvents || []).length, searchToView: (searchEvents || []).length > 0 ? (viewEvents || []).length / (searchEvents || []).length : 0, viewToWA: (viewEvents || []).length > 0 ? (waTapEvents || []).length / (viewEvents || []).length : 0 },
                topProducts, deadStock, categoryTrends,
              },
            });
          }

          // ─── /api/vendors ───
          if (url === "/api/vendors") {
            if (!sb) return json(res, { source: "offline", data: [] });

            const { data: allVendors, error } = await sb
              .from("vendors")
              .select("id, businessName, phone, whatsapp, city, region, status, verified, rating, totalSales, tier, isFeatured, createdAt")
              .order("createdAt", { ascending: false });

            if (error) throw error;

            const vendorIds = (allVendors || []).map((v: any) => v.id);
            const productMap = new Map<number, number>();
            const orderMap = new Map<number, { count: number; revenue: number }>();

            if (vendorIds.length > 0) {
              const { data: productCounts } = await sb.from("products").select("vendorId").in("vendorId", vendorIds);
              for (const p of productCounts || []) productMap.set(p.vendorId, (productMap.get(p.vendorId) || 0) + 1);

              const { data: orderRows } = await sb.from("orders").select("vendorId, totalAmount").in("vendorId", vendorIds);
              for (const o of orderRows || []) {
                const ex = orderMap.get(o.vendorId) || { count: 0, revenue: 0 };
                orderMap.set(o.vendorId, { count: ex.count + 1, revenue: ex.revenue + Number(o.totalAmount || 0) });
              }
            }

            const vendorData = (allVendors || []).map((v: any) => ({
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
              totalRevenue: orderMap.get(v.id)?.revenue ?? 0,
              totalListings: productMap.get(v.id) || 0,
              tier: v.tier,
              isFeatured: v.isFeatured,
              createdAt: v.createdAt,
            }));

            return json(res, { source: "database", data: vendorData });
          }

          // ─── /api/orders ───
          if (url === "/api/orders") {
            if (!sb) return json(res, { source: "offline", data: [] });

            const { data: rows, error } = await sb
              .from("orders")
              .select("id, orderNumber, totalAmount, commissionAmount, currency, status, paymentMethod, paymentStatus, shippingCity, shippingRegion, buyerName, buyerPhone, vendorId, createdAt")
              .order("createdAt", { ascending: false });

            if (error) throw error;

            const vendorIds = [...new Set((rows || []).map((o: any) => o.vendorId).filter(Boolean))];
            const vendorNameMap = new Map<number, string>();
            if (vendorIds.length > 0) {
              const { data: vNames } = await sb.from("vendors").select("id, businessName").in("id", vendorIds);
              for (const v of vNames || []) vendorNameMap.set(v.id, v.businessName);
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

            return json(res, { source: "database", data: orderData });
          }

          // ─── /api/products ───
          if (url === "/api/products") {
            if (!sb) return json(res, { source: "offline", data: [] });

            const { data: allProducts, error } = await sb
              .from("products")
              .select("id, vendorId, categoryId, name, price, currency, brand, condition, vehicleMake, vehicleModel, quantity, status, views, whatsappTaps, createdAt")
              .order("createdAt", { ascending: false });

            if (error) throw error;

            const catIds = [...new Set((allProducts || []).map((p: any) => p.categoryId).filter(Boolean))];
            const catNameMap = new Map<number, string>();
            if (catIds.length > 0) {
              const { data: cats } = await sb.from("categories").select("id, name").in("id", catIds);
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

            return json(res, { source: "database", data: productData });
          }

          // ─── /api/categories ───
          if (url === "/api/categories") {
            if (!sb) return json(res, { source: "offline", data: [] });

            const { data: allCategories } = await sb.from("categories").select("id, name, slug, icon, parentId").order("name");
            const { data: prodCounts } = await sb.from("products").select("categoryId");

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

            return json(res, { source: "database", data });
          }

          // ─── /api/part-requests ───
          if (url === "/api/part-requests") {
            if (!sb) return json(res, { source: "offline", data: [] });

            const { data: allRequests } = await sb
              .from("part_requests")
              .select("id, guestName, contactPhone, make, model, year, partName, description, budget, status, createdAt")
              .order("createdAt", { ascending: false });

            return json(res, { source: "database", data: allRequests || [] });
          }

          // ─── /api/revenue ───
          if (url === "/api/revenue") {
            if (!sb) return json(res, { source: "offline", data: {} });

            const { data: allOrders } = await sb
              .from("orders")
              .select("totalAmount, commissionAmount, status, paymentMethod, shippingRegion, createdAt");

            const orders = allOrders || [];
            const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0);
            const totalCommission = orders.reduce((s: number, o: any) => s + Number(o.commissionAmount || 0), 0);

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
                dailyMap.set(date, { revenue: bd.revenue + Number(o.totalAmount || 0), commission: bd.commission + Number(o.commissionAmount || 0), orders: bd.orders + 1 });
              }
            }

            return json(res, {
              source: "database",
              data: {
                totalRevenue,
                totalCommission,
                byStatus: [...byStatusMap.entries()].map(([status, v]) => ({ status, total: String(v.total), count: v.count })),
                byPaymentMethod: [...byPaymentMap.entries()].map(([method, v]) => ({ method, total: v.total, count: v.count })),
                byRegion: [...byRegionMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10).map(([region, v]) => ({ region, total: v.total, count: v.count })),
                dailyRevenue: [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, revenue: v.revenue, commission: v.commission, orders: v.orders })),
              },
            });
          }

          // ─── /api/growth ───
          if (url === "/api/growth") {
            if (!sb) return json(res, { source: "offline", data: {} });

            const [{ data: vendorsRaw }, { data: ordersRaw }, { data: productsRaw }, { data: tierRaw }] = await Promise.all([
              sb.from("vendors").select("createdAt, tier"),
              sb.from("orders").select("createdAt, totalAmount"),
              sb.from("products").select("createdAt"),
              sb.from("vendors").select("tier"),
            ]);

            const vendorByMonth = new Map<string, number>();
            for (const v of vendorsRaw || []) vendorByMonth.set(monthKey(v.createdAt), (vendorByMonth.get(monthKey(v.createdAt)) || 0) + 1);

            const orderByMonth = new Map<string, { count: number; revenue: number }>();
            for (const o of ordersRaw || []) {
              const m = monthKey(o.createdAt);
              const ex = orderByMonth.get(m) || { count: 0, revenue: 0 };
              orderByMonth.set(m, { count: ex.count + 1, revenue: ex.revenue + Number(o.totalAmount || 0) });
            }

            const productByMonth = new Map<string, number>();
            for (const p of productsRaw || []) productByMonth.set(monthKey(p.createdAt), (productByMonth.get(monthKey(p.createdAt)) || 0) + 1);

            const tierCount = new Map<string, number>();
            for (const v of tierRaw || []) {
              const t = v.tier || "none";
              tierCount.set(t, (tierCount.get(t) || 0) + 1);
            }

            return json(res, {
              source: "database",
              data: {
                vendorGrowth: [...vendorByMonth.entries()].sort().map(([month, count]) => ({ month, count })),
                orderGrowth: [...orderByMonth.entries()].sort().map(([month, v]) => ({ month, count: v.count, revenue: v.revenue })),
                productGrowth: [...productByMonth.entries()].sort().map(([month, count]) => ({ month, count })),
                tierDistribution: [...tierCount.entries()].map(([tier, count]) => ({ tier, count })),
              },
            });
          }

          // ─── /api/vendors/:id (detail) ───
          const vendorDetailMatch = url.match(/^\/api\/vendors\/(\d+)$/);
          if (vendorDetailMatch) {
            if (!sb) return json(res, { source: "offline" });
            const vendorId = parseInt(vendorDetailMatch[1], 10);

            const { data: vendor, error: vendorError } = await sb
              .from("vendors").select("*").eq("id", vendorId).single();
            if (vendorError || !vendor) return json(res, { error: "Vendor not found" }, 404);

            const { count: productCount } = await sb
              .from("products").select("*", { count: "exact", head: true }).eq("vendorId", vendorId);
            const { data: orders } = await sb
              .from("orders").select("id, totalAmount").eq("vendorId", vendorId);

            const totalOrders = orders?.length ?? 0;
            const totalRevenue = (orders || []).reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);

            return json(res, {
              source: "database",
              data: {
                ...vendor,
                totalListings: productCount ?? 0,
                totalOrders,
                totalRevenue,
              },
            });
          }

          // ─── /api/vendors/:id/orders ───
          const vendorOrdersMatch = url.match(/^\/api\/vendors\/(\d+)\/orders$/);
          if (vendorOrdersMatch) {
            if (!sb) return json(res, { source: "offline", data: [] });
            const vendorId = parseInt(vendorOrdersMatch[1], 10);
            const { data, error } = await sb.from("orders")
              .select("id, orderNumber, totalAmount, commissionAmount, currency, status, paymentMethod, paymentStatus, buyerName, buyerPhone, createdAt")
              .eq("vendorId", vendorId).order("createdAt", { ascending: false });
            if (error) throw error;
            return json(res, { source: "database", data: data ?? [] });
          }

          // ─── /api/vendors/:id/payouts ───
          const vendorPayoutsMatch = url.match(/^\/api\/vendors\/(\d+)\/payouts$/);
          if (vendorPayoutsMatch) {
            if (!sb) return json(res, { source: "offline", data: [] });
            const vendorId = parseInt(vendorPayoutsMatch[1], 10);
            const { data, error } = await sb.from("vendor_payouts")
              .select("*").eq("vendorId", vendorId).order("createdAt", { ascending: false });
            if (error) throw error;
            return json(res, { source: "database", data: data ?? [] });
          }

          // ─── /api/vendors/:id/notifications ───
          const vendorNotifsMatch = url.match(/^\/api\/vendors\/(\d+)\/notifications$/);
          if (vendorNotifsMatch) {
            if (!sb) return json(res, { source: "offline", data: [] });
            const vendorId = parseInt(vendorNotifsMatch[1], 10);
            const { data: vendor } = await sb.from("vendors").select("userId").eq("id", vendorId).single();
            if (!vendor) return json(res, { error: "Vendor not found" }, 404);
            const { data, error } = await sb.from("notifications")
              .select("*").eq("userId", vendor.userId).order("createdAt", { ascending: false });
            if (error) throw error;
            return json(res, { source: "database", data: data ?? [] });
          }

          // ─── /api/vendors/:id/subscription-events ───
          const vendorSubEventsMatch = url.match(/^\/api\/vendors\/(\d+)\/subscription-events$/);
          if (vendorSubEventsMatch) {
            if (!sb) return json(res, { source: "offline", data: [] });
            const vendorId = parseInt(vendorSubEventsMatch[1], 10);
            const { data, error } = await sb.from("subscription_events")
              .select("*").eq("vendorId", vendorId).order("createdAt", { ascending: false });
            if (error) throw error;
            return json(res, { source: "database", data: data ?? [] });
          }

          // ─── /api/vendors/:id/status (PATCH) ───
          const vendorStatusMatch = url.match(/^\/api\/vendors\/(\d+)\/status$/);
          if (vendorStatusMatch && req.method === "PATCH") {
            if (!sb) return json(res, { error: "Database not available" }, 503);
            const vendorId = parseInt(vendorStatusMatch[1], 10);
            const body = await parseBody(req);
            const { status } = body;
            const validStatuses = ["approved", "pending", "rejected", "suspended"];
            if (!validStatuses.includes(status)) return json(res, { error: "Invalid status" }, 400);
            const { data, error } = await sb.from("vendors")
              .update({ status, updatedAt: new Date().toISOString() })
              .eq("id", vendorId).select().single();
            if (error) throw error;
            return json(res, data);
          }

          // ─── /api/vendors/:id/tier (PATCH) ───
          const vendorTierMatch = url.match(/^\/api\/vendors\/(\d+)\/tier$/);
          if (vendorTierMatch && req.method === "PATCH") {
            if (!sb) return json(res, { error: "Database not available" }, 503);
            const vendorId = parseInt(vendorTierMatch[1], 10);
            const body = await parseBody(req);
            const { tier, tierExpiresAt } = body;
            const validTiers = ["free", "starter", "pro", "business", "enterprise"];
            if (!validTiers.includes(tier)) return json(res, { error: "Invalid tier" }, 400);
            const updateFields: Record<string, any> = { tier, updatedAt: new Date().toISOString() };
            if (tierExpiresAt !== undefined) updateFields.tierExpiresAt = tierExpiresAt;
            const { data, error } = await sb.from("vendors")
              .update(updateFields).eq("id", vendorId).select().single();
            if (error) throw error;
            return json(res, data);
          }

          // ─── /api/vendors/:id/featured (PATCH) ───
          const vendorFeaturedMatch = url.match(/^\/api\/vendors\/(\d+)\/featured$/);
          if (vendorFeaturedMatch && req.method === "PATCH") {
            if (!sb) return json(res, { error: "Database not available" }, 503);
            const vendorId = parseInt(vendorFeaturedMatch[1], 10);
            const body = await parseBody(req);
            const { isFeatured, featuredUntil, featuredCategoryId } = body;
            const updateFields: Record<string, any> = { isFeatured, updatedAt: new Date().toISOString() };
            if (featuredUntil !== undefined) updateFields.featuredUntil = featuredUntil;
            if (featuredCategoryId !== undefined) updateFields.featuredCategoryId = featuredCategoryId;
            const { data, error } = await sb.from("vendors")
              .update(updateFields).eq("id", vendorId).select().single();
            if (error) throw error;
            return json(res, data);
          }

          // ─── /api/vendors/invite (POST) ───
          if (url === "/api/vendors/invite" && req.method === "POST") {
            if (!sb) return json(res, { error: "Database not available" }, 503);
            const body = await parseBody(req);
            const { businessName, phone, city } = body;
            if (!businessName || !phone) return json(res, { error: "businessName and phone are required" }, 400);
            const cleanPhone = String(phone).trim();
            const cleanName = String(businessName).trim();
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
            const storedPhone = "+" + waNumber;
            const insertFields: Record<string, any> = {
              businessName: cleanName, phone: storedPhone, whatsapp: storedPhone,
              status: "pending", verified: false,
            };
            if (city && String(city).trim()) insertFields.city = String(city).trim();
            const { data, error } = await sb.from("vendors").insert(insertFields).select().single();
            if (error) return json(res, { error: "Failed to create vendor record" }, 500);
            return json(res, { vendor: data, whatsappUrl }, 201);
          }

          // ─── /api/vendors/:id/notifications (POST) ───
          const vendorNotifPostMatch = url.match(/^\/api\/vendors\/(\d+)\/notifications$/);
          if (vendorNotifPostMatch && req.method === "POST") {
            if (!sb) return json(res, { error: "Database not available" }, 503);
            const vendorId = parseInt(vendorNotifPostMatch[1], 10);
            const { data: vendor } = await sb.from("vendors").select("userId").eq("id", vendorId).single();
            if (!vendor) return json(res, { error: "Vendor not found" }, 404);
            const body = await parseBody(req);
            const { title, message, type } = body;
            if (!title || !message) return json(res, { error: "title and message are required" }, 400);
            const insertFields: Record<string, any> = { userId: vendor.userId, title, message };
            if (type) insertFields.type = type;
            const { data, error } = await sb.from("notifications").insert(insertFields).select().single();
            if (error) throw error;
            return json(res, data, 201);
          }

          return json(res, { error: "Not found" }, 404);
        } catch (err: any) {
          console.error("[vite-api] Error:", err?.message || err);
          return json(res, { error: "Internal server error" }, 500);
        }
      });
    },
  };
}
