/**
 * VOOM Ghana CEO Dashboard — Home Page
 * Arctic Glass Design System · Mobile-first responsive
 * Mobile: bottom tab bar + stacked layout
 * Desktop: fixed left sidebar + multi-column grid
 */

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import { MobileNav } from '../components/MobileNav';
import { Overview } from '../components/sections/Overview';
import { Vendors } from '../components/sections/Vendors';
import { Products } from '../components/sections/Products';
import { Orders } from '../components/sections/Orders';
import { Revenue } from '../components/sections/Revenue';
import { Leads } from '../components/sections/Leads';
import { Growth } from '../components/sections/Growth';
import {
  fetchPublicStats, fetchVendors, fetchOrders, computeKPIs, getDataSource,
  type VoomStats, type Vendor, type Order, type DashboardKPIs, type DataSource,
} from '../lib/voomApi';
import { toast } from 'sonner';

type Section = 'overview' | 'vendors' | 'products' | 'orders' | 'revenue' | 'leads' | 'growth' | 'settings';

const SECTION_LABELS: Record<Section, string> = {
  overview: 'Overview',
  vendors: 'Vendors',
  products: 'Products',
  orders: 'Orders',
  revenue: 'Revenue',
  leads: 'Lead Pipeline',
  growth: 'Growth',
  settings: 'Settings',
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [loading, setLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState<'live' | 'warn' | 'error'>('warn');
  const [dataSource, setDataSource] = useState<DataSource>('offline');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const [publicStats, setPublicStats] = useState<VoomStats>({ totalProducts: 0, totalVendors: 0, totalCategories: 0 });
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stats, vendorList, orderList] = await Promise.all([
        fetchPublicStats(),
        fetchVendors(),
        fetchOrders(),
      ]);
      setPublicStats(stats);
      setVendors(vendorList);
      setOrders(orderList);
      setKpis(computeKPIs(stats, vendorList, orderList, 0));
      setLastUpdated(new Date());
      const source = getDataSource();
      setDataSource(source);
      if (source === 'database') {
        setLiveStatus('live');
      } else {
        setLiveStatus('warn');
        toast.error('Not connected to database. Set DATABASE_URL and restart server.');
      }
    } catch {
      setLiveStatus('error');
      setDataSource('offline');
      toast.error('Could not connect to VOOM backend. Check server is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleNavigate = (section: string) => {
    if (section === 'settings') {
      toast.info('Settings panel coming soon.');
      setSidebarOpen(false);
      return;
    }
    setActiveSection(section as Section);
    setSidebarOpen(false);
  };

  const renderSection = () => {
    if (!kpis) return null;
    switch (activeSection) {
      case 'overview': return <Overview kpis={kpis} orders={orders} vendors={vendors} loading={loading} />;
      case 'vendors': return <Vendors vendors={vendors} />;
      case 'products': return <Products kpis={kpis} />;
      case 'orders': return <Orders orders={orders} kpis={kpis} />;
      case 'revenue': return <Revenue orders={orders} kpis={kpis} />;
      case 'leads': return <Leads kpis={kpis} />;
      case 'growth': return <Growth kpis={kpis} />;
      default: return <Overview kpis={kpis} orders={orders} vendors={vendors} loading={loading} />;
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

      {/* Desktop Sidebar — hidden on mobile */}
      {!isMobile && (
        <Sidebar activeSection={activeSection} onNavigate={handleNavigate} liveStatus={liveStatus} />
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
            <Sidebar activeSection={activeSection} onNavigate={handleNavigate} liveStatus={liveStatus} />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
            {/* Mobile hamburger */}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
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
            {/* Mobile: show VOOM logo */}
            {isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="rgba(255,255,255,0.9)" />
                  </svg>
                </div>
                <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: '0.9375rem', color: '#0F172A' }}>
                  VOOM
                </span>
              </div>
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
              <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', margin: 0, marginLeft: '0.25rem' }}>
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
              onClick={loadData}
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
                  toast.success('Connected to Render PostgreSQL database — showing live data.');
                } else {
                  toast.error('Not connected to database. Set DATABASE_URL in .env and run: pnpm dev');
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
                ? (isMobile ? 'Live DB' : 'Render DB Connected')
                : (isMobile ? 'Offline' : 'No Database')}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div style={{ padding: isMobile ? '1rem' : '1.75rem 2rem 3rem' }}>
          {loading && !kpis ? (
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

      {/* Mobile Bottom Tab Bar */}
      {isMobile && (
        <MobileNav activeSection={activeSection} onNavigate={handleNavigate} />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
