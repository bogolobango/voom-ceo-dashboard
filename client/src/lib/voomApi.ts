/**
 * VOOM CEO Dashboard API Client
 * Connects to the Render PostgreSQL database via local /api routes.
 * Returns REAL data when connected, EMPTY state when not.
 * Never fabricates numbers — a CEO dashboard must not lie.
 */

// ─── Data source tracking ───
export type DataSource = 'database' | 'offline';
let _dataSource: DataSource = 'offline';
let _everConnected = false;
export function getDataSource(): DataSource { return _dataSource; }

function setDataSource(src: DataSource) {
  if (src === 'database') {
    _everConnected = true;
    _dataSource = 'database';
  } else {
    // Only drop back to offline if we have never successfully connected.
    // Transient failures during refresh shouldn't flip the indicator.
    if (!_everConnected) _dataSource = 'offline';
  }
}

// ─── Types ───

export interface AdminStats {
  totalUsers: number;
  totalVendors: number;
  totalProducts: number;
  totalOrders: number;
  totalCategories: number;
  totalPartRequests: number;
  pendingVendors: number;
  totalRevenue: string;
  totalCommission: string;
}

export interface Vendor {
  id: number;
  userId: number | null;
  businessName: string;
  phone: string;
  whatsapp: string | null;
  city: string | null;
  region: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  verified: boolean;
  rating: string | null;
  totalSales: number;
  totalRevenue: number;
  totalListings: number;
  tier: string;
  isFeatured: boolean;
  createdAt: string;
  claimToken?: string | null;
  claimTokenExpiresAt?: string | null;
  claimStatus?: 'unclaimed' | 'claimed' | 'expired';
}

export interface OutreachInvite {
  vendorId: number;
  invitedAt: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  totalAmount: string;
  commissionAmount: string | null;
  currency: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  shippingCity: string | null;
  shippingRegion: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  vendorName: string | null;
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  price: string;
  currency: string;
  brand: string | null;
  condition: string;
  vehicleMake: string | null;
  vehicleModel: string | null;
  oemPartNumber: string | null;
  quantity: number;
  status: string;
  views: number | null;
  whatsappTaps: number | null;
  categoryName: string | null;
  vendorId: number;
  createdAt: string;
}

export interface CategoryData {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  parentId: number | null;
  productCount: number;
}

export interface PartRequest {
  id: number;
  guestName: string | null;
  contactPhone: string;
  make: string | null;
  model: string | null;
  year: number | null;
  partName: string;
  description: string | null;
  budget: string | null;
  status: string;
  createdAt: string;
}

export interface RevenueData {
  totalRevenue: number;
  totalCommission: number;
  byStatus: { status: string; total: string; count: number }[];
  byPaymentMethod: { method: string; total: number; count: number }[];
  byRegion: { region: string; total: number; count: number }[];
  dailyRevenue: { date: string; revenue: number; commission: number; orders: number }[];
}

export interface GrowthData {
  vendorGrowth: { month: string; count: number }[];
  orderGrowth: { month: string; count: number; revenue: number }[];
  productGrowth: { month: string; count: number }[];
  tierDistribution: { tier: string; count: number }[];
}

// ─── Briefing Types ───

export interface BriefingData {
  todaySearches: number;
  yesterdaySearches: number;
  todayWhatsappTaps: number;
  yesterdayWhatsappTaps: number;
  todayProductViews: number;
  yesterdayProductViews: number;
  todayNewVendors: number;
  yesterdayNewVendors: number;
  todayPartRequests: number;
  yesterdayPartRequests: number;
  todayNewUsers: number;
  yesterdayNewUsers: number;
  totalUsers: number;
  topSearches: { query: string; count: number; results: number }[];
  zeroResultSearches: { query: string; count: number }[];
  expiringVendors: { id: number; businessName: string; tier: string; tierExpiresAt: string; tierTrialUsed: boolean }[];
  activePaidVendors: number;
  mrr: number;
  topCategories: { name: string; views: number }[];
}

// ─── API fetch helper ───
async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Stats ───
export async function fetchStats(): Promise<AdminStats | null> {
  const data = await apiGet<AdminStats & { source: string }>('/api/stats');
  if (data && data.source === 'database') {
    setDataSource('database');
    return data;
  }
  setDataSource('offline');
  return null;
}

// ─── Vendor List ───
export async function fetchVendors(): Promise<Vendor[]> {
  const result = await apiGet<{ source: string; data: Vendor[] }>('/api/vendors?limit=1000');
  if (result?.source === 'database') {
    setDataSource('database');
    return result.data;
  }
  setDataSource('offline');
  return [];
}

export async function fetchOutreachInvites(): Promise<OutreachInvite[]> {
  const result = await apiGet<OutreachInvite[]>('/api/vendors/outreach-invites');
  return result ?? [];
}

export async function sendOutreachInvite(vendorId: number): Promise<{ whatsappUrl: string; vendorPageUrl: string; claimUrl?: string }> {
  const res = await fetch(`/api/vendors/${vendorId}/outreach-invite`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to send invite');
  return res.json();
}

export async function generateClaimLink(vendorId: number): Promise<{ claimUrl: string; token: string }> {
  const res = await fetch(`/api/vendors/${vendorId}/generate-claim-link`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to generate claim link');
  return res.json();
}

// ─── Orders ───
export async function fetchOrders(): Promise<Order[]> {
  const result = await apiGet<{ source: string; data: Order[] }>('/api/orders');
  if (result?.source === 'database') {
    setDataSource('database');
    return result.data;
  }
  setDataSource('offline');
  return [];
}

// ─── Products ───
export async function fetchProducts(): Promise<Product[]> {
  const result = await apiGet<{ source: string; data: Product[] }>('/api/products');
  if (result?.source === 'database') {
    setDataSource('database');
    return result.data;
  }
  setDataSource('offline');
  return [];
}

// ─── Categories ───
export async function fetchCategories(): Promise<CategoryData[]> {
  const result = await apiGet<{ source: string; data: CategoryData[] }>('/api/categories');
  if (result?.source === 'database') return result.data;
  return [];
}

// ─── Part Requests ───
export async function fetchPartRequests(): Promise<PartRequest[]> {
  const result = await apiGet<{ source: string; data: PartRequest[] }>('/api/part-requests');
  if (result?.source === 'database') return result.data;
  return [];
}

// ─── Revenue Data ───
export async function fetchRevenue(): Promise<RevenueData | null> {
  const result = await apiGet<{ source: string; data: RevenueData }>('/api/revenue');
  if (result?.source === 'database') return result.data;
  return null;
}

// ─── Growth Data ───
export async function fetchGrowth(): Promise<GrowthData | null> {
  const result = await apiGet<{ source: string; data: GrowthData }>('/api/growth');
  if (result?.source === 'database') return result.data;
  return null;
}

// ─── Briefing Data ───
export async function fetchBriefing(): Promise<BriefingData | null> {
  const result = await apiGet<{ source: string; data: BriefingData }>('/api/briefing');
  if (result?.source === 'database') return result.data;
  // Return default empty briefing for offline mode
  return {
    todaySearches: 0, yesterdaySearches: 0,
    todayWhatsappTaps: 0, yesterdayWhatsappTaps: 0,
    todayProductViews: 0, yesterdayProductViews: 0,
    todayNewVendors: 0, yesterdayNewVendors: 0,
    todayPartRequests: 0, yesterdayPartRequests: 0,
    todayNewUsers: 0, yesterdayNewUsers: 0, totalUsers: 0,
    topSearches: [], zeroResultSearches: [],
    expiringVendors: [], activePaidVendors: 0, mrr: 0,
    topCategories: [],
  };
}

// ─── Analytics Types ───

export interface AnalyticsUser {
  id: number;
  openId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  loginMethod: string | null;
  role: string | null;
  isVerified: boolean | null;
  createdAt: string;
  updatedAt: string | null;
  lastSignedIn: string | null;
  activityCounts: {
    views: number;
    searches: number;
    waTaps: number;
    total: number;
    lastSeen: string | null;
  };
}

export interface UserActivityEvent {
  id: number;
  eventType: string;
  productId: number | null;
  productName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ProductViewStat {
  productId: number;
  productName: string;
  categoryId: number | null;
  categoryName: string | null;
  vendorId: number | null;
  price: string | null;
  imageUrl: string | null;
  views: number;
  uniqueViewers: number;
  waTaps: number;
  conversionRate: number;
  lastViewed: string | null;
}

export interface ProductAnalyticsData {
  timeRange: string;
  funnel: { searches: number; views: number; waTaps: number; searchToView: number; viewToWA: number };
  topProducts: ProductViewStat[];
  deadStock: ProductViewStat[];
  categoryTrends: { name: string; views: number; change: number }[];
}

export interface VisitorAnalyticsData {
  totalVisitors: number;
  loggedInVisitors: number;
  anonVisitors: number;
  registeredUsers: number;
  registrationRate: number;
  topVisitors: { visitorId: string; isAnon: boolean; views: number; searches: number; waTaps: number; lastSeen: string | null }[];
}

export interface BehaviorFunnelData {
  views: number;
  wishlists: number;
  carts: number;
  orders: number;
  viewToWishlist: number;
  wishlistToCart: number;
  cartToOrder: number;
  viewToOrder: number;
}

export async function fetchVisitorAnalytics(): Promise<VisitorAnalyticsData | null> {
  const result = await apiGet<{ source: string; data: VisitorAnalyticsData }>('/api/analytics/visitors');
  return result?.data ?? null;
}

export async function fetchBehaviorFunnel(): Promise<BehaviorFunnelData | null> {
  const result = await apiGet<{ source: string; data: BehaviorFunnelData }>('/api/analytics/funnel');
  return result?.data ?? null;
}

export async function fetchAnalyticsUsers(): Promise<AnalyticsUser[]> {
  const result = await apiGet<{ source: string; data: AnalyticsUser[] }>('/api/analytics/users');
  return result?.data ?? [];
}

export async function fetchUserDetail(id: number): Promise<{ user: AnalyticsUser | null; activity: UserActivityEvent[] }> {
  const result = await apiGet<{ source: string; data: { user: AnalyticsUser; activity: UserActivityEvent[] } }>(`/api/analytics/users/${id}`);
  return result?.data ?? { user: null, activity: [] };
}

export async function fetchProductAnalytics(timeRange: '1d' | '7d' | '30d' | 'all'): Promise<ProductAnalyticsData | null> {
  const result = await apiGet<{ source: string; data: ProductAnalyticsData }>(`/api/analytics/products?timeRange=${timeRange}`);
  return result?.data ?? null;
}

// ─── Verification Queue ───────────────────────────────────────────────────────

export interface VerificationQueueItem {
  id: number;
  businessName: string;
  phone: string;
  city: string | null;
  region: string | null;
  status: string;
  verified: boolean;
  ghanaCardNumber: string | null;
  idDocumentUrl: string | null;
  businessRegUrl: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchVerificationQueue(): Promise<VerificationQueueItem[]> {
  const result = await apiGet<{ source: string; data: VerificationQueueItem[] }>('/api/verification-queue');
  return result?.data ?? [];
}

export async function reviewVendorDocs(vendorId: number, approved: boolean): Promise<boolean> {
  try {
    const res = await fetch(`/api/vendors/${vendorId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    });
    return res.ok;
  } catch { return false; }
}

export async function updateUserRole(userId: number, role: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/analytics/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    return res.ok;
  } catch { return false; }
}

export async function verifyUser(userId: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/analytics/users/${userId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch { return false; }
}

// ─── Derived KPI Calculations ───
export interface DashboardKPIs {
  totalVendors: number;
  approvedVendors: number;
  pendingVendors: number;
  vendorApprovalRate: number;
  totalProducts: number;
  totalCategories: number;
  totalGMV: number;
  totalCommission: number;
  avgOrderValue: number;
  totalOrders: number;
  completedOrders: number;
  orderCompletionRate: number;
  totalPartRequests: number;
  openPartRequests: number;
  fulfilledPartRequests: number;
  totalUsers: number;
  vendorGrowth: number;
  orderGrowth: number;
  gmvGrowth: number;
}

export function computeKPIs(
  stats: AdminStats | null,
  vendors: Vendor[],
  orders: Order[],
  partRequests: PartRequest[],
  growthData?: GrowthData | null,
): DashboardKPIs {
  const approved = vendors.filter(v => v.status === 'approved').length;
  const pending = vendors.filter(v => v.status === 'pending').length;
  const totalVendors = vendors.length || (stats?.totalVendors ?? 0);

  const totalGMV = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0);
  const totalCommission = orders.reduce(
    (sum, o) => sum + parseFloat(o.commissionAmount || '0'), 0
  );
  const completedOrders = orders.filter(o => o.status === 'delivered').length;
  const avgOrderValue = orders.length > 0 ? totalGMV / orders.length : 0;

  const openPR = partRequests.filter(r => r.status === 'open').length;
  const fulfilledPR = partRequests.filter(r => r.status === 'fulfilled').length;

  return {
    totalVendors,
    approvedVendors: approved,
    pendingVendors: pending,
    vendorApprovalRate: totalVendors > 0 ? (approved / totalVendors) * 100 : 0,
    totalProducts: stats?.totalProducts ?? 0,
    totalCategories: stats?.totalCategories ?? 0,
    totalGMV,
    totalCommission,
    avgOrderValue,
    totalOrders: orders.length,
    completedOrders,
    orderCompletionRate: orders.length > 0 ? (completedOrders / orders.length) * 100 : 0,
    totalPartRequests: partRequests.length,
    openPartRequests: openPR,
    fulfilledPartRequests: fulfilledPR,
    totalUsers: stats?.totalUsers ?? 0,
    vendorGrowth: computeMoMGrowth(growthData?.vendorGrowth),
    orderGrowth: computeMoMGrowth(growthData?.orderGrowth),
    gmvGrowth: computeRevenueMoMGrowth(growthData?.orderGrowth),
  };
}

/**
 * Compute month-over-month growth % from monthly count data.
 * Compares the last two COMPLETE months (skips the current partial month).
 * e.g. if today is April 2, compares March vs February, not April vs March.
 */
function computeMoMGrowth(data?: { month: string; count: number }[]): number {
  if (!data || data.length < 2) return 0;
  const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-04"

  // Filter out the current (incomplete) month
  const complete = sorted.filter(d => d.month < currentMonth);
  if (complete.length < 2) {
    const last = sorted[sorted.length - 1].count;
    const prev = sorted[sorted.length - 2].count;
    // Don't claim "100% growth" when starting from zero — it's meaningless
    if (prev === 0) return 0;
    return ((last - prev) / prev) * 100;
  }
  const current = complete[complete.length - 1].count;
  const previous = complete[complete.length - 2].count;
  if (previous === 0) return 0; // No meaningful growth rate from zero base
  return ((current - previous) / previous) * 100;
}

/** Same as above but for revenue field in order growth data */
function computeRevenueMoMGrowth(data?: { month: string; count: number; revenue: number }[]): number {
  if (!data || data.length < 2) return 0;
  const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const complete = sorted.filter(d => d.month < currentMonth);
  if (complete.length < 2) {
    const last = sorted[sorted.length - 1].revenue;
    const prev = sorted[sorted.length - 2].revenue;
    if (prev === 0) return 0;
    return ((last - prev) / prev) * 100;
  }
  const current = complete[complete.length - 1].revenue;
  const previous = complete[complete.length - 2].revenue;
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// ─── Revenue Chart Data ───
export function generateRevenueChartData(orders: Order[]) {
  const byDay = new Map<string, number>();
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    byDay.set(key, 0);
  }
  orders.forEach(o => {
    const key = o.createdAt.split('T')[0];
    if (byDay.has(key)) {
      byDay.set(key, (byDay.get(key) || 0) + parseFloat(o.totalAmount || '0'));
    }
  });
  return Array.from(byDay.entries()).map(([date, revenue]) => ({
    date: new Date(date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    revenue: Math.round(revenue),
  }));
}

// ─── Vendor Pipeline Data ───
export function getVendorPipeline(vendors: Vendor[]) {
  return {
    approved: vendors.filter(v => v.status === 'approved').length,
    pending: vendors.filter(v => v.status === 'pending').length,
    rejected: vendors.filter(v => v.status === 'rejected').length,
    suspended: vendors.filter(v => v.status === 'suspended').length,
  };
}

// ─── Top Vendors by Sales ───
export function getTopVendors(vendors: Vendor[], limit = 5) {
  return [...vendors]
    .filter(v => v.status === 'approved')
    .sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0))
    .slice(0, limit);
}

// ─── Order Status Distribution ───
export function getOrderStatusDist(orders: Order[]) {
  const dist: Record<string, number> = {};
  orders.forEach(o => {
    dist[o.status] = (dist[o.status] || 0) + 1;
  });
  return dist;
}

// ─── Product Make Distribution ───
export function getProductMakeDist(products: Product[]) {
  const dist: Record<string, number> = {};
  products.forEach(p => {
    const make = p.vehicleMake || 'Other';
    dist[make] = (dist[make] || 0) + 1;
  });
  return Object.entries(dist)
    .map(([make, count]) => ({ make, products: count }))
    .sort((a, b) => b.products - a.products)
    .slice(0, 10);
}

// ─── Product Category Distribution ───
export function getProductCategoryDist(products: Product[]) {
  const dist: Record<string, number> = {};
  products.forEach(p => {
    const cat = p.categoryName || 'Uncategorized';
    dist[cat] = (dist[cat] || 0) + 1;
  });
  return Object.entries(dist)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Product Condition Distribution ───
export function getProductConditionDist(products: Product[]) {
  const dist: Record<string, number> = { new: 0, used: 0, refurbished: 0 };
  products.forEach(p => {
    if (dist[p.condition] !== undefined) dist[p.condition]++;
  });
  const total = products.length || 1;
  return {
    new: { count: dist.new, pct: Math.round((dist.new / total) * 100) },
    used: { count: dist.used, pct: Math.round((dist.used / total) * 100) },
    refurbished: { count: dist.refurbished, pct: Math.round((dist.refurbished / total) * 100) },
  };
}

// ─── Vendor Detail Types ───

export interface VendorDetail {
  id: number;
  userId: number;
  businessName: string;
  description: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  verified: boolean;
  rating: string | null;
  totalSales: number;
  ghanaCardNumber: string | null;
  idDocumentUrl: string | null;
  businessRegUrl: string | null;
  tier: string;
  tierExpiresAt: string | null;
  tierTrialUsed: boolean;
  isFeatured: boolean;
  featuredUntil: string | null;
  featuredCategoryId: number | null;
  qualityScore: number | null;
  qualityScoreUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalListings: number;
  totalOrders: number;
  totalRevenue: number;
}

export interface VendorOrder {
  id: number;
  orderNumber: string;
  totalAmount: string;
  commissionAmount: string | null;
  currency: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  buyerName: string | null;
  buyerPhone: string | null;
  createdAt: string;
}

export interface VendorPayout {
  id: number;
  orderId: number | null;
  amount: string;
  type: string;
  status: string;
  flutterwaveRef: string | null;
  createdAt: string;
}

export interface VendorNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

export interface VendorSubscriptionEvent {
  id: number;
  event: string;
  fromTier: string | null;
  toTier: string | null;
  amount: string | null;
  createdAt: string;
}

// ─── Vendor Detail API Functions ───

export async function fetchVendorDetail(vendorId: number): Promise<VendorDetail> {
  const res = await fetch(`/api/vendors/${vendorId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Failed to load vendor (HTTP ${res.status})`);
  }
  const result = await res.json() as { source: string; data: VendorDetail };
  if (result?.source !== 'database' || !result.data) {
    throw new Error('Vendor data unavailable — database not connected');
  }
  return result.data;
}

export async function fetchVendorOrders(vendorId: number): Promise<VendorOrder[]> {
  const result = await apiGet<{ source: string; data: VendorOrder[] }>(`/api/vendors/${vendorId}/orders`);
  if (result?.source === 'database') return result.data;
  return [];
}

export async function fetchVendorPayouts(vendorId: number): Promise<VendorPayout[]> {
  const result = await apiGet<{ source: string; data: VendorPayout[] }>(`/api/vendors/${vendorId}/payouts`);
  if (result?.source === 'database') return result.data;
  return [];
}

export async function fetchVendorNotifications(vendorId: number): Promise<VendorNotification[]> {
  const result = await apiGet<{ source: string; data: VendorNotification[] }>(`/api/vendors/${vendorId}/notifications`);
  if (result?.source === 'database') return result.data;
  return [];
}

export async function fetchVendorSubscriptionEvents(vendorId: number): Promise<VendorSubscriptionEvent[]> {
  const result = await apiGet<{ source: string; data: VendorSubscriptionEvent[] }>(`/api/vendors/${vendorId}/subscription-events`);
  if (result?.source === 'database') return result.data;
  return [];
}

export async function updateVendorStatus(vendorId: number, status: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/vendors/${vendorId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch { return false; }
}

export async function updateVendorPipelineStage(vendorId: number, pipelineStage: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/vendors/${vendorId}/pipeline-stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineStage }),
    });
    return res.ok;
  } catch { return false; }
}

export async function updateVendorTier(vendorId: number, tier: string, tierExpiresAt?: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/vendors/${vendorId}/tier`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, tierExpiresAt }),
    });
    return res.ok;
  } catch { return false; }
}

export async function updateVendorProfile(
  vendorId: number,
  fields: { businessName?: string; phone?: string; whatsapp?: string; email?: string; address?: string; ghanaCardNumber?: string }
): Promise<boolean> {
  try {
    const res = await fetch(`/api/vendors/${vendorId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    return res.ok;
  } catch { return false; }
}

export async function updateVendorFeatured(vendorId: number, isFeatured: boolean, featuredUntil?: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/vendors/${vendorId}/featured`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFeatured, featuredUntil }),
    });
    return res.ok;
  } catch { return false; }
}

export async function sendVendorNotification(vendorId: number, title: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/vendors/${vendorId}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message }),
    });
    return res.ok;
  } catch { return false; }
}

// ─── WhatsApp Acquisition Types ──────────────────────────────

export type WaGroupStatus = 'discovered' | 'approved' | 'joining' | 'joined' | 'rejected' | 'left' | 'failed';
export type WaLeadType = 'unknown' | 'vendor' | 'customer';
export type WaLeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'dead';
export type WaMessageDirection = 'inbound' | 'outbound';
export type WaBroadcastStatus = 'draft' | 'pending_approval' | 'approved' | 'sending' | 'sent' | 'failed';

export interface WaGroup {
  id: number;
  name: string | null;
  inviteLink: string;
  source: string | null;
  sourceUrl: string | null;
  keywords: string[] | null;
  status: WaGroupStatus;
  memberCount: number;
  waGroupId: string | null;
  joinedAt: string | null;
  lastBroadcastAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WaLead {
  id: number;
  phone: string;
  name: string | null;
  profilePicUrl: string | null;
  type: WaLeadType;
  status: WaLeadStatus;
  sourceGroupId: number | null;
  qualificationNotes: string | null;
  convertedVendorId: number | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestMessage?: WaMessage | null;
}

export interface WaMessage {
  id: number;
  leadId: number | null;
  groupId: number | null;
  waMessageId: string | null;
  direction: WaMessageDirection;
  content: string;
  mediaUrl: string | null;
  status: string;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface WaTemplate {
  id: number;
  name: string;
  category: string;
  body: string;
  variables: string[] | null;
  metaTemplateId: string | null;
  status: string;
  isDefault: boolean;
  createdAt: string;
}

export interface WaBroadcast {
  id: number;
  name: string;
  templateName: string | null;
  messageBody: string;
  targetGroupIds: number[] | null;
  status: WaBroadcastStatus;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface WaScrapeResult {
  jobId: number;
  linksFound: number;
  linksNew: number;
  groups: WaGroup[];
  demo?: boolean;
}

// ─── WhatsApp API Functions ──────────────────────────────────

export async function fetchWaGroups(): Promise<WaGroup[]> {
  const res = await fetch('/api/whatsapp/groups');
  if (!res.ok) return [];
  const data = await res.json();
  return data.groups ?? data ?? [];
}

export async function fetchWaLeads(): Promise<WaLead[]> {
  const res = await fetch('/api/whatsapp/leads');
  if (!res.ok) return [];
  const data = await res.json();
  return data.leads ?? data ?? [];
}

export async function fetchWaTemplates(): Promise<WaTemplate[]> {
  const res = await fetch('/api/whatsapp/templates');
  if (!res.ok) return [];
  const data = await res.json();
  return data.templates ?? data ?? [];
}

export async function fetchWaMessages(leadId: number): Promise<WaMessage[]> {
  const res = await fetch(`/api/whatsapp/leads/${leadId}/messages`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages ?? data ?? [];
}

export async function scrapeWaGroups(keywords: string[], platforms: string[]): Promise<WaScrapeResult> {
  const res = await fetch('/api/whatsapp/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords, platforms }),
  });
  if (!res.ok) throw new Error('Scrape failed');
  return res.json();
}

export async function updateWaGroupStatus(id: number, status: WaGroupStatus, notes?: string): Promise<WaGroup> {
  const res = await fetch(`/api/whatsapp/groups/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, ...(notes ? { notes } : {}) }),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

export async function sendWaBroadcast(payload: {
  name: string;
  messageBody: string;
  targetGroupIds: number[];
  templateId?: number;
}): Promise<WaBroadcast> {
  const res = await fetch('/api/whatsapp/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Broadcast failed');
  return res.json();
}

export async function updateWaLeadType(id: number, type: WaLeadType, status?: WaLeadStatus): Promise<WaLead> {
  const res = await fetch(`/api/whatsapp/leads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...(status ? { status } : {}) }),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

// ─── Traffic Analytics ───────────────────────────────────────

export interface TrafficOverview {
  activeUsers30d: number;
  sessions30d: number;
  pageViews30d: number;
  totalEvents30d: number;
  engagementRate?: number;
}

export interface NameCount {
  name: string;
  count: number;
}

export interface EventBreakdown {
  eventType: string;
  count: number;
}

export interface TrackingInfo {
  withVisitorId: number;
  withoutVisitorId: number;
  adminEvents: number;
}

export interface TrafficData {
  overview: TrafficOverview;
  eventBreakdown: EventBreakdown[];
  tracking: TrackingInfo;
  trafficSources: NameCount[];
  countries: NameCount[];
  cities: NameCount[];
  topPages: NameCount[];
  devices: NameCount[];
  browsers?: NameCount[];
}

export async function fetchTrafficAnalytics(): Promise<TrafficData | null> {
  const res = await fetch('/api/analytics/traffic');
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

// ─── Engagement Analytics ──────────────────────────────────────

export interface EngagementData {
  filterUsage: {
    makes: NameCount[];
    categories: NameCount[];
    conditions: NameCount[];
    totalFilterEvents: number;
  };
  searchCTR: { query: string; searches: number; clicks: number; ctr: number }[];
  whatsappFunnel: { views: number; taps: number; tapRate: number };
  sessionDurations: { day: string; avgSessionSec: number; avgPages: number; sessions: number }[];
  vendorViews: NameCount[];
}

export async function fetchEngagementAnalytics(): Promise<EngagementData | null> {
  const res = await fetch('/api/analytics/engagement');
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

// ─── Vendor Analytics (for value reports) ────────────────────

export interface VendorAnalytics {
  views: number;
  whatsappTaps: number;
  searches: number;
  topProduct: { name: string; views: number } | null;
  topSearches: { query: string; count: number; results: number }[];
  restockTip: { query: string; count: number } | null;
}

export async function fetchVendorAnalytics(vendorId: number): Promise<VendorAnalytics | null> {
  const res = await fetch(`/api/analytics/vendor/${vendorId}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

// ─── Supply-Demand Gap ───────────────────────────────────────

export interface SupplyDemandGap {
  query: string;
  searchCount: number;
  make?: string | null;
  category?: string | null;
  inferred?: boolean;
  matchedVendors: { vendorId: number; businessName: string; phone: string; whatsapp: string | null; city: string | null; status: string; matchScore: number }[];
}

export interface SupplyDemandData {
  gaps: SupplyDemandGap[];
  topSearches: { query: string; searchCount: number; resultCount: number; inferred?: boolean }[];
  totalSearches: number;
  uniqueQueries: number;
  zeroResultRate: number;
  resultCountTracked: boolean;
  queriesWithResultData: number;
  queriesInferred: number;
  inferredZeroCount: number;
  explicitZeroCount: number;
}

export async function fetchSupplyDemandGaps(): Promise<SupplyDemandData | null> {
  const res = await fetch('/api/analytics/supply-demand');
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

// ─── Unit Economics ──────────────────────────────────────────

export interface UnitEconomics {
  mrr: number;
  arpu: number;
  ltv: number;
  cac: number;
  ltvCacRatio: number | null;
  churnRate: number;
  activationRate: number;
  conversionToPaid: number;
  totalVendors: number;
  paidVendors: number;
  churnedVendors: number;
  activeVendors: number;
}

export async function fetchUnitEconomics(): Promise<UnitEconomics | null> {
  const res = await fetch('/api/analytics/unit-economics');
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}
