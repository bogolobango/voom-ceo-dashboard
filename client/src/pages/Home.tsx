/**
 * VOOM Ghana CEO Dashboard — Home Page
 * Arctic Glass Design System · Mobile-first responsive
 * Uses React Query for data fetching with per-widget error boundaries
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '../components/Sidebar';
import { MobileNav } from '../components/MobileNav';
import { WidgetErrorBoundary } from '../components/WidgetErrorBoundary';
import { Overview } from '../components/sections/Overview';
import { Vendors } from '../components/sections/Vendors';
import { Products } from '../components/sections/Products';
import { Orders } from '../components/sections/Orders';
import { Revenue } from '../components/sections/Revenue';
import { PartRequests } from '../components/sections/PartRequests';
import { Growth } from '../components/sections/Growth';
import { MorningBriefing } from '../components/sections/MorningBriefing';
import { VendorCRM } from '../components/sections/VendorCRM';
import { Security } from '../components/sections/Security';
import { CompetitiveIntel } from '../components/sections/CompetitiveIntel';
import { Analytics } from '../components/sections/Analytics';
import { VerificationQueue } from '../components/sections/VerificationQueue';
import { MarketExpansion } from '../components/sections/MarketExpansion';
import { Reports } from '../components/sections/Reports';
import { Settings } from '../components/sections/Settings';
import {
  fetchStats, fetchVendors, fetchOrders, fetchProducts,
  fetchPartRequests, fetchRevenue, fetchGrowth, fetchBriefing,
  fetchVerificationQueue,
  computeKPIs, getDataSource,
  type DataSource,
} from '../lib/voomApi';
import { toast } from 'sonner';

type Section = 'briefing' | 'overview' | 'vendors' | 'products' | 'orders' | 'revenue' | 'part-requests' | 'growth' | 'crm' | 'security' | 'competitive' | 'analytics' | 'verification' | 'expansion' | 'reports' | 'settings';

const SECTION_LABELS: Record<Section, string> = {
  briefing: 'Morning Briefing',
  overview: 'Overview',
  vendors: 'Vendors',
  products: 'Products',
  orders: 'Orders',
  revenue: 'Revenue',
  'part-requests': 'Part Requests',
  growth: 'Growth',
  crm: 'Outreach CRM',
  security: 'Security',
  competitive: 'Competitive Intel',
  analytics: 'Analytics',
  verification: 'Document Review',
  expansion: 'Expansion',
  reports: 'Reports',
  settings: 'Settings',
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>('briefing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // ── React Query: each endpoint fetches independently ──
  const statsQuery = useQuery({ queryKey: ['stats'], queryFn: fetchStats });
  const vendorsQuery = useQuery({ queryKey: ['vendors'], queryFn: fetchVendors });
  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: fetchOrders });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const partRequestsQuery = useQuery({ queryKey: ['partRequests'], queryFn: fetchPartRequests });
  const revenueQuery = useQuery({ queryKey: ['revenue'], queryFn: fetchRevenue });
  const growthQuery = useQuery({ queryKey: ['growth'], queryFn: fetchGrowth });
  const briefingQuery = useQuery({ queryKey: ['briefing'], queryFn: fetchBriefing });
  const verificationQuery = useQuery({ queryKey: ['verification-queue'], queryFn: fetchVerificationQueue, staleTime: 60000, refetchInterval: 120000 });
  const waLeadsCountQuery = useQuery({
    queryKey: ['wa-leads-count'],
    queryFn: () => fetch('/api/whatsapp/leads?status=new').then(r => r.ok ? r.json() : { total: 0 }).then(d => d.total ?? 0),
    refetchInterval: 60_000,
  });

  const vendors = vendorsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const partRequests = partRequestsQuery.data ?? [];
  const revenueData = revenueQuery.data ?? null;
  const growthData = growthQuery.data ?? null;
  const briefingData = briefingQuery.data ?? {
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

  const verificationCount = verificationQuery.data?.length ?? 0;

  const kpis = useMemo(() => {
    return computeKPIs(statsQuery.data ?? null, vendors, orders, partRequests, growthData);
  }, [statsQuery.data, vendors, orders, partRequests, growthData]);

  // ── Connection status ──
  const dataSource: DataSource = getDataSource();
  const isAnyLoading = statsQuery.isLoading || vendorsQuery.isLoading || ordersQuery.isLoading;
  const liveStatus: 'live' | 'warn' | 'error' =
    dataSource === 'database' ? 'live' :
    (statsQuery.isError || vendorsQuery.isError) ? 'error' : 'warn';

  const lastUpdated = useMemo(() => {
    const latest = [statsQuery.dataUpdatedAt, vendorsQuery.dataUpdatedAt, ordersQuery.dataUpdatedAt]
      .filter(Boolean)
      .sort((a, b) => b - a)[0];
    return latest ? new Date(latest) : new Date();
  }, [statsQuery.dataUpdatedAt, vendorsQuery.dataUpdatedAt, ordersQuery.dataUpdatedAt]);

  // Show toast once when confirmed connected (suppress false-offline during refresh)
  const hasShownConnectedToast = useRef(false);
  useEffect(() => {
    if (hasShownConnectedToast.current) return;
    if (statsQuery.isSuccess && dataSource === 'database') {
      hasShownConnectedToast.current = true;
    }
  }, [statsQuery.isSuccess, dataSource]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const handleNavigate = (section: string) => {
    if (section in SECTION_LABELS) {
      setActiveSection(section as Section);
    }
    setSidebarOpen(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const shortcuts: Record<string, Section> = {
        '1': 'briefing', '2': 'overview', '3': 'vendors', '4': 'products',
        '5': 'orders', '6': 'revenue', '7': 'crm', '8': 'security',
      };
      if (shortcuts[e.key]) { setActiveSection(shortcuts[e.key]); return; }
      if (e.key === 'r') { handleRefresh(); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRefresh]);

  const renderSection = () => {
    // Settings doesn't need KPI data — render immediately
    if (activeSection === 'settings') return (
      <WidgetErrorBoundary fallbackTitle="Settings failed to load">
        <Settings />
      </WidgetErrorBoundary>
    );

    // Sections that don't need KPI data can always render.
    // Sections that do need it receive kpis (possibly null) and handle their own empty states.
    switch (activeSection) {
      case 'briefing': return (
        <WidgetErrorBoundary fallbackTitle="Briefing failed to load">
          <MorningBriefing briefingData={briefingData} vendors={vendors} kpis={kpis} />
        </WidgetErrorBoundary>
      );
      case 'overview': return (
        <WidgetErrorBoundary fallbackTitle="Overview failed to load">
          <Overview kpis={kpis} orders={orders} vendors={vendors} products={products} partRequests={partRequests} loading={isAnyLoading} />
        </WidgetErrorBoundary>
      );
      case 'vendors': return (
        <WidgetErrorBoundary fallbackTitle="Vendors failed to load">
          <Vendors vendors={vendors} onRefresh={handleRefresh} />
        </WidgetErrorBoundary>
      );
      case 'products': return (
        <WidgetErrorBoundary fallbackTitle="Products failed to load">
          <Products kpis={kpis} products={products} />
        </WidgetErrorBoundary>
      );
      case 'orders': return (
        <WidgetErrorBoundary fallbackTitle="Orders failed to load">
          <Orders orders={orders} kpis={kpis} />
        </WidgetErrorBoundary>
      );
      case 'revenue': return (
        <WidgetErrorBoundary fallbackTitle="Revenue failed to load">
          <Revenue orders={orders} kpis={kpis} revenueData={revenueData} />
        </WidgetErrorBoundary>
      );
      case 'part-requests': return (
        <WidgetErrorBoundary fallbackTitle="Part Requests failed to load">
          <PartRequests partRequests={partRequests} kpis={kpis} />
        </WidgetErrorBoundary>
      );
      case 'growth': return (
        <WidgetErrorBoundary fallbackTitle="Growth failed to load">
          <Growth kpis={kpis} growthData={growthData} vendors={vendors} />
        </WidgetErrorBoundary>
      );
      case 'crm': return (
        <WidgetErrorBoundary fallbackTitle="CRM failed to load">
          <VendorCRM vendors={vendors} kpis={kpis} />
        </WidgetErrorBoundary>
      );
      case 'security': return (
        <WidgetErrorBoundary fallbackTitle="Security failed to load">
          <Security kpis={kpis} dataSource={dataSource} />
        </WidgetErrorBoundary>
      );
      case 'competitive': return (
        <WidgetErrorBoundary fallbackTitle="Competitive Intel failed to load">
          <CompetitiveIntel vendors={vendors} kpis={kpis} />
        </WidgetErrorBoundary>
      );
      case 'analytics': return (
        <WidgetErrorBoundary fallbackTitle="Analytics failed to load">
          <Analytics />
        </WidgetErrorBoundary>
      );
      case 'verification': return (
        <WidgetErrorBoundary fallbackTitle="Document Review failed to load">
          <VerificationQueue />
        </WidgetErrorBoundary>
      );
      case 'expansion': return (
        <WidgetErrorBoundary fallbackTitle="Expansion failed to load">
          <MarketExpansion />
        </WidgetErrorBoundary>
      );
      case 'reports': return (
        <WidgetErrorBoundary fallbackTitle="Reports failed to load">
          <Reports />
        </WidgetErrorBoundary>
      );
      default: return (
        <WidgetErrorBoundary fallbackTitle="Briefing failed to load">
          <MorningBriefing briefingData={briefingData} vendors={vendors} kpis={kpis} />
        </WidgetErrorBoundary>
      );
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', position: 'relative' }}>
      {/* Background glass orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -120, right: -80, width: 500, height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', bottom: -100, left: 200, width: 400, height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(5,150,105,0.05) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
      </div>

      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sidebar activeSection={activeSection} onNavigate={handleNavigate} liveStatus={liveStatus} verificationCount={verificationCount} newLeadsCount={waLeadsCountQuery.data ?? 0} />
      )}

      {/* Mobile Drawer Overlay */}
      {isMobile && sidebarOpen && (
        <>
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
              backdropFilter: 'blur(4px)', zIndex: 100,
            }}
          />
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: 260,
            zIndex: 101,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <Sidebar activeSection={activeSection} onNavigate={handleNavigate} liveStatus={liveStatus} verificationCount={verificationCount} newLeadsCount={waLeadsCountQuery.data ?? 0} />
          </div>
        </>
      )}

      {/* Main Content */}
      <main style={{
        marginLeft: isMobile ? 0 : 240,
        minHeight: '100vh',
        position: 'relative',
        zIndex: 1,
        paddingBottom: isMobile ? 80 : 0,
      }}>
        {/* Top Header Bar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(79,70,229,0.06)',
          padding: isMobile ? '0 1rem' : '0 2rem',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0, flex: 1 }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation menu"
                style={{
                  width: 36, height: 36, borderRadius: '0.625rem',
                  background: 'rgba(79,70,229,0.08)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#4F46E5', flexShrink: 0, cursor: 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            )}
            {!isMobile && (
              <div>
                <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  {SECTION_LABELS[activeSection]}
                </h1>
                <p style={{ fontSize: '0.7rem', color: '#94A3B8', margin: 0 }}>
                  Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
            {isMobile && (
              <h1 style={{
                fontFamily: 'Plus Jakarta Sans', fontSize: '1rem', fontWeight: 700,
                color: '#0F172A', margin: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {SECTION_LABELS[activeSection]}
              </h1>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {!isMobile && (
              <div style={{
                padding: '0.3rem 0.75rem', borderRadius: '0.5rem',
                background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.12)',
                fontSize: '0.75rem', fontWeight: 600, color: '#4F46E5', fontFamily: 'Space Grotesk',
              }}>
                Last 30 days
              </div>
            )}
            <button
              onClick={handleRefresh}
              aria-label="Refresh data"
              style={{
                width: 34, height: 34, borderRadius: '0.5rem',
                background: 'rgba(79,70,229,0.08)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#4F46E5', cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
            <button
              onClick={() => {
                if (dataSource === 'database') {
                  toast.success('Connected to Supabase — showing live data.');
                } else {
                  toast.warning('Connecting to database… If this persists, check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY and restart the server.');
                }
              }}
              style={{
                padding: '0.3rem 0.625rem', borderRadius: '0.5rem',
                background: dataSource === 'database' ? 'rgba(5,150,105,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${dataSource === 'database' ? 'rgba(5,150,105,0.2)' : 'rgba(239,68,68,0.2)'}`,
                fontSize: '0.7rem', fontWeight: 600,
                color: dataSource === 'database' ? '#059669' : '#EF4444',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}
            >
              <div className={`status-orb ${liveStatus}`} style={{ width: 6, height: 6 }} />
              {dataSource === 'database'
                ? (isMobile ? 'Live DB' : 'DB Connected')
                : (isMobile ? 'Connecting…' : 'Connecting…')}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div style={{ padding: isMobile ? '1rem' : '1.75rem 2rem 3rem' }}>
          {isAnyLoading && !statsQuery.data && vendors.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  border: '3px solid rgba(79,70,229,0.15)', borderTopColor: '#4F46E5',
                  animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem',
                }} />
                <p style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 600, color: '#0F172A', marginBottom: '0.25rem' }}>
                  Loading VOOM Dashboard
                </p>
                <p style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>Connecting to backend...</p>
              </div>
            </div>
          ) : renderSection()}
        </div>
      </main>

      {isMobile && (
        <MobileNav activeSection={activeSection} onNavigate={handleNavigate} />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
