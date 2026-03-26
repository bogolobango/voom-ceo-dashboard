/**
 * VOOM CEO Dashboard API Client
 * Connects to the Render PostgreSQL database via local /api routes.
 * Returns REAL data when connected, EMPTY state when not.
 * Never fabricates numbers — a CEO dashboard must not lie.
 */

// ─── Data source tracking ───
export type DataSource = 'database' | 'offline';
let _dataSource: DataSource = 'offline';
export function getDataSource(): DataSource { return _dataSource; }

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
  expiringVendors: { id: number; businessName: string; tier: string; tierExpiresAt: string }[];
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
    _dataSource = 'database';
    return data;
  }
  _dataSource = 'offline';
  return null;
}

// ─── Vendor List ───
export async function fetchVendors(): Promise<Vendor[]> {
  const result = await apiGet<{ source: string; data: Vendor[] }>('/api/vendors');
  if (result?.source === 'database') {
    _dataSource = 'database';
    return result.data;
  }
  return [];
}

// ─── Orders ───
export async function fetchOrders(): Promise<Order[]> {
  const result = await apiGet<{ source: string; data: Order[] }>('/api/orders');
  if (result?.source === 'database') {
    _dataSource = 'database';
    return result.data;
  }
  return [];
}

// ─── Products ───
export async function fetchProducts(): Promise<Product[]> {
  const result = await apiGet<{ source: string; data: Product[] }>('/api/products');
  if (result?.source === 'database') {
    _dataSource = 'database';
    return result.data;
  }
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
    vendorGrowth: 0,
    orderGrowth: 0,
    gmvGrowth: 0,
  };
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

export async function fetchVendorDetail(vendorId: number): Promise<VendorDetail | null> {
  const result = await apiGet<{ source: string; data: VendorDetail }>(`/api/vendors/${vendorId}`);
  if (result?.source === 'database') return result.data;
  return null;
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
