/**
 * Analytics Section — Users & Product Analytics Engine
 * Arctic Glass Design System · Mobile-first responsive
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAnalyticsUsers, fetchProductAnalytics, fetchVisitorAnalytics, fetchBehaviorFunnel,
  fetchTrafficAnalytics, fetchSupplyDemandGaps, fetchUnitEconomics, fetchEngagementAnalytics,
  type AnalyticsUser, type ProductViewStat, type VisitorAnalyticsData, type BehaviorFunnelData,
  type TrafficData, type SupplyDemandData, type UnitEconomics, type EngagementData,
} from '../../lib/voomApi';
import { UserAnalyticsDrawer } from '../UserAnalyticsDrawer';

type Tab = 'users' | 'products' | 'traffic' | 'engagement' | 'gaps' | 'economics';
type TimeRange = '1d' | '7d' | '30d' | 'all';

const TIME_LABELS: Record<TimeRange, string> = { '1d': 'Today', '7d': '7 Days', '30d': '30 Days', all: 'All Time' };

// ─── Helpers ───

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCedi(price: string | null): string {
  if (!price) return '—';
  const n = parseFloat(price);
  if (isNaN(n)) return '—';
  return `GH₵ ${n.toLocaleString('en-GH', { maximumFractionDigits: 0 })}`;
}

function getDisplayName(user: AnalyticsUser): string {
  if (user.name) return user.name;
  if (user.email) return user.email.split('@')[0];
  return `User #${user.id}`;
}

function getInitials(user: AnalyticsUser): string {
  const src = user.name || user.email || '';
  const parts = src.trim().split(/[\s@]/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return 'U';
}

// ─── Shared UI atoms ───

function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(20px)',
      borderRadius: '1.25rem',
      border: '1px solid rgba(79,70,229,0.09)',
      padding: '1.25rem',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <p style={{ margin: 0, fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: '0.9375rem', color: '#0F172A' }}>{children}</p>
      {sub && <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>{sub}</p>}
    </div>
  );
}

function GlassSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="glass-card" style={{ padding: '1.125rem', ...style }}>{children}</div>;
}

function Skeleton({ h = 16, w }: { h?: number; w?: string }) {
  return <div style={{ height: h, width: w || '100%', borderRadius: 999, background: 'rgba(79,70,229,0.07)', animation: 'pulse 1.5s ease-in-out infinite' }} />;
}

function LoadingRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }}>
      {[1,2,3,4,5].map(i => <Skeleton key={i} h={36} />)}
    </div>
  );
}

// ─── Users Tab ───

function UserAvatar({ user }: { user: AnalyticsUser }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.7rem', fontWeight: 700, color: '#fff',
    }}>
      {getInitials(user)}
    </div>
  );
}

function ActivityBadge({ count, color }: { count: number; color: string }) {
  return (
    <span style={{
      fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '0.82rem',
      color: count > 0 ? color : '#CBD5E1',
    }}>
      {count}
    </span>
  );
}

function UsersTab({ onSelectUser }: { onSelectUser: (id: number) => void }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'joined' | 'activity' | 'views' | 'searches'>('activity');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['analytics-users'],
    queryFn: fetchAnalyticsUsers,
    staleTime: 120000,
  });

  const { data: visitorData } = useQuery({
    queryKey: ['analytics-visitors'],
    queryFn: fetchVisitorAnalytics,
    staleTime: 300000,
  });

  const { data: funnelData } = useQuery({
    queryKey: ['analytics-funnel'],
    queryFn: fetchBehaviorFunnel,
    staleTime: 300000,
  });

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return users
      .filter(u => !search
        || getDisplayName(u).toLowerCase().includes(lower)
        || (u.email || '').toLowerCase().includes(lower)
        || (u.phone || '').toLowerCase().includes(lower))
      .sort((a, b) => {
        if (sortBy === 'activity') return b.activityCounts.total - a.activityCounts.total;
        if (sortBy === 'views') return b.activityCounts.views - a.activityCounts.views;
        if (sortBy === 'searches') return b.activityCounts.searches - a.activityCounts.searches;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [users, search, sortBy]);

  const activeUsers = users.filter(u => u.activityCounts.total > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Visitor overview + behavior funnel cards */}
      <div className="two-col-grid">
        {visitorData && <VisitorCard data={visitorData} />}
        {funnelData && <BehaviorFunnelCard data={funnelData} />}
      </div>

    <GlassCard>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Registered Users', value: users.length, color: '#4F46E5' },
          { label: 'Active (with events)', value: activeUsers, color: '#059669' },
          { label: 'No activity yet', value: users.length - activeUsers, color: '#94A3B8' },
        ].map(item => (
          <div key={item.label} style={{
            flex: '1 1 100px',
            background: `${item.color}08`, borderRadius: '0.875rem',
            padding: '0.625rem 0.875rem', border: `1px solid ${item.color}12`,
          }}>
            <p style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, color: item.color, fontFamily: 'Space Grotesk' }}>{item.value}</p>
            <p style={{ margin: '0.125rem 0 0', fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* Search + sort */}
      <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 160 }}>
          <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email or phone…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '0.5625rem 0.75rem 0.5625rem 2.125rem',
              borderRadius: '0.75rem', border: '1px solid rgba(79,70,229,0.15)',
              background: 'rgba(255,255,255,0.85)', fontSize: '0.82rem',
              fontFamily: 'Plus Jakarta Sans', outline: 'none', color: '#0F172A',
            }}
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{
            padding: '0.5rem 0.625rem', borderRadius: '0.625rem', fontSize: '0.78rem',
            border: '1px solid rgba(79,70,229,0.15)', background: 'rgba(255,255,255,0.85)',
            color: '#4F46E5', fontWeight: 600, cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="activity">Sort: Most active</option>
          <option value="joined">Sort: Newest</option>
          <option value="views">Sort: Most views</option>
          <option value="searches">Sort: Most searches</option>
        </select>
        <span style={{ fontSize: '0.75rem', color: '#94A3B8', flexShrink: 0 }}>{filtered.length} users</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingRows />
      ) : (
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                {['User', 'Phone', 'Joined', 'Views', 'Searches', 'WA Taps', 'Last Seen'].map(h => (
                  <th key={h} style={{
                    textAlign: h === 'User' || h === 'Phone' || h === 'Joined' ? 'left' : 'center',
                    fontSize: '0.7rem', fontWeight: 600, color: '#94A3B8',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    padding: '0.5rem 0.625rem',
                    borderBottom: '1px solid rgba(79,70,229,0.08)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, i) => (
                <tr
                  key={user.id}
                  onClick={() => onSelectUser(user.id)}
                  style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(79,70,229,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 !== 0 ? 'rgba(248,250,252,0.6)' : 'transparent')}
                >
                  <td style={{ padding: '0.6875rem 0.625rem', background: i % 2 !== 0 ? 'rgba(248,250,252,0.6)' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5625rem' }}>
                      <UserAvatar user={user} />
                      <div>
                        <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap' }}>{getDisplayName(user)}</p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#94A3B8' }}>{user.email || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0.6875rem 0.625rem', fontSize: '0.8rem', color: '#64748B', background: i % 2 !== 0 ? 'rgba(248,250,252,0.6)' : 'transparent' }}>{user.phone || '—'}</td>
                  <td style={{ padding: '0.6875rem 0.625rem', fontSize: '0.78rem', color: '#64748B', whiteSpace: 'nowrap', background: i % 2 !== 0 ? 'rgba(248,250,252,0.6)' : 'transparent' }}>{formatDate(user.createdAt)}</td>
                  <td style={{ padding: '0.6875rem 0.625rem', textAlign: 'center', background: i % 2 !== 0 ? 'rgba(248,250,252,0.6)' : 'transparent' }}><ActivityBadge count={user.activityCounts.views} color="#4F46E5" /></td>
                  <td style={{ padding: '0.6875rem 0.625rem', textAlign: 'center', background: i % 2 !== 0 ? 'rgba(248,250,252,0.6)' : 'transparent' }}><ActivityBadge count={user.activityCounts.searches} color="#0EA5E9" /></td>
                  <td style={{ padding: '0.6875rem 0.625rem', textAlign: 'center', background: i % 2 !== 0 ? 'rgba(248,250,252,0.6)' : 'transparent' }}><ActivityBadge count={user.activityCounts.waTaps} color="#059669" /></td>
                  <td style={{ padding: '0.6875rem 0.625rem', fontSize: '0.75rem', color: '#94A3B8', whiteSpace: 'nowrap', background: i % 2 !== 0 ? 'rgba(248,250,252,0.6)' : 'transparent' }}>{formatRelativeTime(user.activityCounts.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !isLoading && (
            <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem', padding: '2rem 0' }}>No users match your search</p>
          )}
        </div>
      )}
    </GlassCard>
    </div>
  );
}

// ─── Visitor Analytics Card ───

function VisitorCard({ data }: { data: VisitorAnalyticsData }) {
  const regPct = Math.round(data.registrationRate * 100);
  const items = [
    { label: 'Total Visitors', value: data.totalVisitors, color: '#4F46E5', sub: 'Unique tracked sessions' },
    { label: 'Logged-In', value: data.loggedInVisitors, color: '#059669', sub: 'At least one authenticated event' },
    { label: 'Anonymous', value: data.anonVisitors, color: '#D97706', sub: 'Never logged in' },
    { label: 'Registered Users', value: data.registeredUsers, color: '#0EA5E9', sub: 'Total accounts in DB' },
  ];

  return (
    <GlassCard>
      <SectionTitle sub="Tracked visitor sessions vs registered accounts">Visitor Overview</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.625rem', marginBottom: '1rem' }}>
        {items.map(item => (
          <div key={item.label} style={{
            background: `${item.color}08`, borderRadius: '0.875rem',
            padding: '0.75rem', border: `1px solid ${item.color}12`,
          }}>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: item.color, fontFamily: 'Space Grotesk' }}>{item.value.toLocaleString()}</p>
            <p style={{ margin: '0.125rem 0 0', fontSize: '0.72rem', fontWeight: 600, color: '#0F172A' }}>{item.label}</p>
            <p style={{ margin: 0, fontSize: '0.68rem', color: '#94A3B8' }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Registration rate bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0F172A' }}>Visitor → Account Conversion</span>
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '0.875rem', color: '#4F46E5' }}>{regPct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(79,70,229,0.08)' }}>
          <div style={{ height: '100%', width: `${Math.min(regPct, 100)}%`, borderRadius: 999, background: 'linear-gradient(90deg, #4F46E5, #7C3AED)', transition: 'width 1s ease' }} />
        </div>
        <p style={{ margin: '0.375rem 0 0', fontSize: '0.72rem', color: '#94A3B8' }}>
          {data.loggedInVisitors} of {data.totalVisitors} tracked visitors have a registered account
        </p>
      </div>
    </GlassCard>
  );
}

// ─── Behavior Funnel Card (Views → Wishlist → Cart → Order) ───

function BehaviorFunnelCard({ data }: { data: BehaviorFunnelData }) {
  const steps = [
    { label: 'Product Views', value: data.views, color: '#4F46E5', icon: '👁', rate: null },
    { label: 'Wishlists', value: data.wishlists, color: '#7C3AED', icon: '♡', rate: data.views > 0 ? (data.viewToWishlist * 100).toFixed(1) + '%' : null, rateLabel: 'of views' },
    { label: 'Cart Adds', value: data.carts, color: '#0EA5E9', icon: '🛒', rate: data.wishlists > 0 ? (data.wishlistToCart * 100).toFixed(1) + '%' : null, rateLabel: 'of wishlists' },
    { label: 'Orders', value: data.orders, color: '#059669', icon: '✓', rate: data.carts > 0 ? (data.cartToOrder * 100).toFixed(1) + '%' : null, rateLabel: 'of carts' },
  ];
  const maxVal = Math.max(...steps.map(s => s.value), 1);

  return (
    <GlassCard>
      <SectionTitle sub="All-time behavior funnel: Views → Wishlist → Cart → Order">Purchase Funnel</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {steps.map((step, idx) => {
          const pct = Math.round((step.value / maxVal) * 100);
          return (
            <div key={step.label}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>{step.icon}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>{step.label}</span>
                  {idx > 0 && step.rate && (
                    <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontStyle: 'italic' }}>
                      {step.rate} {(step as any).rateLabel}
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '1.25rem', color: step.color }}>
                  {step.value.toLocaleString()}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(79,70,229,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: step.color, transition: 'width 1s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
      {data.views > 0 && (
        <div style={{
          marginTop: '0.875rem', padding: '0.625rem 0.875rem',
          borderRadius: '0.625rem', background: 'rgba(5,150,105,0.06)',
          border: '1px solid rgba(5,150,105,0.12)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#059669' }}>View → Order Rate</span>
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '1rem', color: '#059669' }}>
            {(data.viewToOrder * 100).toFixed(2)}%
          </span>
        </div>
      )}
    </GlassCard>
  );
}

// ─── Funnel Card ───

function FunnelCard({ funnel }: { funnel: { searches: number; views: number; waTaps: number; searchToView: number; viewToWA: number } }) {
  const items = [
    { label: 'Searches', value: funnel.searches, color: '#0EA5E9', icon: '🔍' },
    { label: 'Product Views', value: funnel.views, color: '#4F46E5', icon: '👁' },
    { label: 'WhatsApp Taps', value: funnel.waTaps, color: '#059669', icon: '💬' },
  ];
  const maxVal = Math.max(...items.map(i => i.value), 1);

  return (
    <GlassCard>
      <SectionTitle sub="Session funnel for the selected period">Conversion Funnel</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map((item, idx) => {
          const pct = Math.round((item.value / maxVal) * 100);
          const convRate = idx === 0
            ? (funnel.searchToView * 100).toFixed(0) + '% → views'
            : idx === 1
            ? (funnel.viewToWA * 100).toFixed(0) + '% → WA'
            : null;
          return (
            <div key={item.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#0F172A' }}>{item.label}</span>
                  {convRate && <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontStyle: 'italic' }}>{convRate}</span>}
                </div>
                <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '1.25rem', color: item.color }}>{item.value}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(79,70,229,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: item.color, transition: 'width 1s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

// ─── Top Products Table ───

function TopProductsTable({ products }: { products: ProductViewStat[] }) {
  return (
    <GlassCard>
      <SectionTitle sub="Ranked by total views in the selected period">Most Viewed Products</SectionTitle>
      {products.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem', padding: '1.5rem 0' }}>No product views recorded in this period</p>
      ) : (
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr>
                {['#', 'Product', 'Category', 'Price', 'Views', 'Unique', 'WA Taps', 'Conv %', 'Last Viewed'].map(h => (
                  <th key={h} style={{
                    textAlign: h === '#' || h === 'Views' || h === 'Unique' || h === 'WA Taps' || h === 'Conv %' ? 'center' : 'left',
                    fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    padding: '0.5rem 0.5rem',
                    borderBottom: '1px solid rgba(79,70,229,0.08)',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.productId}
                  style={{ transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(79,70,229,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.72rem', fontWeight: 700, fontFamily: 'Space Grotesk',
                      background: i < 3 ? 'rgba(79,70,229,0.1)' : 'rgba(148,163,184,0.1)',
                      color: i < 3 ? '#4F46E5' : '#94A3B8',
                    }}>{i + 1}</span>
                  </td>
                  <td style={{ padding: '0.625rem 0.5rem', maxWidth: 160 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.productName}</p>
                  </td>
                  <td style={{ padding: '0.625rem 0.5rem', fontSize: '0.75rem', color: '#64748B', whiteSpace: 'nowrap' }}>{p.categoryName || '—'}</td>
                  <td style={{ padding: '0.625rem 0.5rem', fontSize: '0.75rem', color: '#64748B', whiteSpace: 'nowrap' }}>{formatCedi(p.price)}</td>
                  <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '0.875rem', color: '#4F46E5' }}>{p.views}</span>
                  </td>
                  <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748B' }}>{p.uniqueViewers}</td>
                  <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '0.875rem', color: '#059669' }}>{p.waTaps}</span>
                  </td>
                  <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: 999,
                      background: p.conversionRate > 0.2 ? 'rgba(5,150,105,0.1)' : p.conversionRate > 0 ? 'rgba(79,70,229,0.08)' : 'rgba(148,163,184,0.1)',
                      color: p.conversionRate > 0.2 ? '#059669' : p.conversionRate > 0 ? '#4F46E5' : '#94A3B8',
                    }}>
                      {p.conversionRate > 0 ? `${(p.conversionRate * 100).toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.625rem 0.5rem', fontSize: '0.72rem', color: '#94A3B8', whiteSpace: 'nowrap' }}>{formatRelativeTime(p.lastViewed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}

// ─── Dead Stock Card ───

function DeadStockCard({ products, timeLabel }: { products: ProductViewStat[]; timeLabel: string }) {
  return (
    <GlassCard>
      <SectionTitle sub={`No views in ${timeLabel}`}>Dead Stock ⚠️</SectionTitle>
      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <p style={{ fontSize: '1.5rem', margin: '0 0 0.25rem' }}>🎉</p>
          <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0 }}>All products had views in this period!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {products.slice(0, 10).map(p => (
            <div key={p.productId} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.5rem 0.625rem', borderRadius: '0.625rem',
              background: 'rgba(248,250,252,0.8)',
              border: '1px solid rgba(79,70,229,0.05)',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.productName}</p>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#94A3B8' }}>{p.categoryName || '—'} · {formatCedi(p.price)}</p>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#E11D48', background: 'rgba(225,29,72,0.08)', padding: '0.2rem 0.5rem', borderRadius: 999, flexShrink: 0, marginLeft: '0.5rem' }}>0 views</span>
            </div>
          ))}
          {products.length > 10 && (
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94A3B8', margin: '0.25rem 0 0' }}>+{products.length - 10} more</p>
          )}
        </div>
      )}
    </GlassCard>
  );
}

// ─── Category Breakdown Card ───

function CategoryBreakdown({ trends }: { trends: { name: string; views: number; change: number }[] }) {
  const max = Math.max(...trends.map(t => t.views), 1);
  const colors = ['#4F46E5', '#7C3AED', '#0EA5E9', '#059669', '#D97706', '#E11D48', '#64748B', '#0F172A'];

  return (
    <GlassCard>
      <SectionTitle sub="Product views by category">Category Breakdown</SectionTitle>
      {trends.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem', padding: '1rem 0' }}>No category data available</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {trends.map((t, i) => {
            const pct = Math.round((t.views / max) * 100);
            const color = colors[i % colors.length];
            return (
              <div key={t.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{t.name}</span>
                  <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '0.82rem', color, flexShrink: 0, marginLeft: '0.5rem' }}>{t.views} view{t.views !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: 'rgba(79,70,229,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: color, transition: 'width 0.9s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

// ─── Products Tab ───

function ProductsTab({ timeRange }: { timeRange: TimeRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-products', timeRange],
    queryFn: () => fetchProductAnalytics(timeRange),
    staleTime: 120000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <GlassCard><Skeleton h={120} /></GlassCard>
        <GlassCard><Skeleton h={200} /></GlassCard>
        <div className="two-col-grid">
          <GlassCard><Skeleton h={150} /></GlassCard>
          <GlassCard><Skeleton h={150} /></GlassCard>
        </div>
      </div>
    );
  }

  if (!data) return (
    <GlassCard>
      <p style={{ textAlign: 'center', color: '#94A3B8', padding: '2rem 0' }}>No analytics data available. Check your database connection.</p>
    </GlassCard>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FunnelCard funnel={data.funnel} />
      <TopProductsTable products={data.topProducts} />
      <div className="two-col-grid">
        <DeadStockCard products={data.deadStock} timeLabel={TIME_LABELS[timeRange].toLowerCase()} />
        <CategoryBreakdown trends={data.categoryTrends} />
      </div>
    </div>
  );
}

// ─── Traffic Tab ───

const SOURCE_COLORS: Record<string, string> = {
  direct: '#4F46E5', referral: '#7C3AED', 'Paid Social': '#E1306C',
  'Organic Social': '#059669', 'Organic Search': '#D97706', facebook: '#1877F2',
  google: '#4285F4', instagram: '#E1306C', tiktok: '#000000',
};

const EVENT_TYPE_META: Record<string, { label: string; color: string }> = {
  product_view: { label: 'Product Views', color: '#4F46E5' },
  search: { label: 'Searches', color: '#7C3AED' },
  whatsapp_tap: { label: 'WhatsApp Taps', color: '#25D366' },
  wishlist_add: { label: 'Wishlist Adds', color: '#D97706' },
  cart_add: { label: 'Cart Adds', color: '#059669' },
  order_created: { label: 'Orders Created', color: '#E11D48' },
  page_view: { label: 'Page Views', color: '#0EA5E9' },
  session_start: { label: 'Sessions', color: '#64748B' },
  vendor_view: { label: 'Vendor Profile Views', color: '#8B5CF6' },
  filter_used: { label: 'Filter Interactions', color: '#F59E0B' },
  page_leave: { label: 'Session Ends', color: '#94A3B8' },
};

function TrackerWarning({ label }: { label: string }) {
  return (
    <div style={{
      padding: '1rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.78rem',
      background: 'rgba(217,119,6,0.04)', borderRadius: '0.75rem',
      border: '1px dashed rgba(217,119,6,0.2)',
    }}>
      <p style={{ fontWeight: 600, color: '#D97706', margin: '0 0 0.25rem' }}>{label}</p>
      <p style={{ margin: 0 }}>
        These require the voom-tracker on voomparts.com.
        Events are currently logged server-side without visitor identification.
      </p>
    </div>
  );
}

function TrafficTab() {
  const { data: traffic, isLoading } = useQuery({
    queryKey: ['analytics-traffic'],
    queryFn: fetchTrafficAnalytics,
    staleTime: 60_000,
  });

  if (isLoading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>Loading traffic data...</div>;
  if (!traffic) return (
    <GlassSection>
      <SectionTitle sub="No analytics events recorded in the past 30 days">No Traffic Data Yet</SectionTitle>
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem' }}>
        <p>No events found. Ensure the marketplace backend is logging to <code style={{ background: 'rgba(79,70,229,0.06)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>analytics_events</code>.</p>
      </div>
    </GlassSection>
  );

  const { overview, eventBreakdown, tracking, trafficSources, countries, cities, topPages, devices } = traffic;
  const hasTracker = tracking && tracking.withVisitorId > 0;
  const totalEvents = overview.totalEvents30d;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Tracking Status Banner */}
      <GlassSection style={{
        padding: '0.875rem 1.125rem',
        background: hasTracker ? 'rgba(5,150,105,0.04)' : 'rgba(217,119,6,0.04)',
        border: hasTracker ? '1px solid rgba(5,150,105,0.15)' : '1px solid rgba(217,119,6,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: hasTracker ? '#059669' : '#D97706',
          }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: hasTracker ? '#059669' : '#D97706', margin: 0 }}>
              {hasTracker ? 'Visitor Tracking Active' : 'Server-Side Events Only'}
            </p>
            <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0.125rem 0 0' }}>
              {hasTracker
                ? `${tracking.withVisitorId.toLocaleString()} tracked / ${tracking.withoutVisitorId.toLocaleString()} server-generated`
                : `All ${totalEvents.toLocaleString()} events are server-generated (no visitorId). Deploy voom-tracker on voomparts.com for visitor-level analytics, traffic sources, geo, and device data.`
              }
            </p>
          </div>
          {tracking && tracking.adminEvents > 0 && (
            <span style={{
              fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 999,
              background: 'rgba(100,116,139,0.1)', color: '#64748B',
            }}>
              {tracking.adminEvents} admin event{tracking.adminEvents !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </GlassSection>

      {/* Event Type Breakdown — the main content */}
      <GlassSection>
        <SectionTitle sub={`${totalEvents.toLocaleString()} events in the last 30 days, broken down by type`}>Event Breakdown</SectionTitle>
        {(!eventBreakdown || eventBreakdown.length === 0) ? (
          <p style={{ color: '#94A3B8', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>No events recorded</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {eventBreakdown.map(e => {
              const meta = EVENT_TYPE_META[e.eventType] || { label: e.eventType, color: '#94A3B8' };
              const pct = totalEvents > 0 ? (e.count / totalEvents) * 100 : 0;
              return (
                <div key={e.eventType}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8125rem', color: '#0F172A', fontWeight: 600, fontFamily: 'Plus Jakarta Sans' }}>
                        {meta.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: meta.color, fontFamily: 'Space Grotesk' }}>
                        {e.count.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#94A3B8', width: 40, textAlign: 'right' }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: `${meta.color}12`, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 999, background: meta.color,
                      width: `${Math.max(pct, 1)}%`, transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassSection>

      {/* Visitor-level panels — only useful with tracker */}
      <div className="two-col-grid">
        <GlassSection>
          <SectionTitle sub="Where your visitors come from">Traffic Sources</SectionTitle>
          {trafficSources.length === 0 ? (
            <TrackerWarning label="No traffic source data" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {trafficSources.slice(0, 10).map(s => {
                const total = trafficSources.reduce((sum, x) => sum + x.count, 0);
                const pct = total > 0 ? (s.count / total) * 100 : 0;
                return (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: SOURCE_COLORS[s.name] || '#94A3B8' }} />
                    <span style={{ flex: 1, fontSize: '0.8rem', color: '#0F172A', fontWeight: 500, textTransform: 'capitalize' }}>{s.name}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>{s.count}</span>
                    <span style={{ fontSize: '0.68rem', color: '#94A3B8', width: 40, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassSection>

        <GlassSection>
          <SectionTitle sub="Top countries and cities">Geography</SectionTitle>
          {countries.length === 0 && cities.length === 0 ? (
            <TrackerWarning label="No geo data" />
          ) : (
            <>
              {countries.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Countries</p>
                  {countries.slice(0, 8).map(c => (
                    <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                      <span style={{ fontSize: '0.8rem', color: '#0F172A' }}>{c.name}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Space Grotesk' }}>{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
              {cities.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cities</p>
                  {cities.slice(0, 8).map(c => (
                    <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                      <span style={{ fontSize: '0.8rem', color: '#0F172A' }}>{c.name}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Space Grotesk' }}>{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </GlassSection>
      </div>

      <div className="two-col-grid">
        <GlassSection>
          <SectionTitle sub="Most viewed pages">Top Pages</SectionTitle>
          {topPages.length === 0 ? (
            <TrackerWarning label="No page view data" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {topPages.slice(0, 10).map((p, i) => (
                <div key={p.name} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.375rem 0.5rem', borderRadius: '0.375rem',
                  background: i % 2 === 0 ? 'rgba(248,250,252,0.6)' : 'transparent',
                }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', width: '1.5rem', textAlign: 'center' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.78rem', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Space Grotesk' }}>{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </GlassSection>

        <GlassSection>
          <SectionTitle sub="How users access your site">Devices</SectionTitle>
          {devices.length === 0 ? (
            <TrackerWarning label="No device data" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {devices.map(d => {
                const total = devices.reduce((sum, x) => sum + x.count, 0);
                const pct = total > 0 ? (d.count / total) * 100 : 0;
                return (
                  <div key={d.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#0F172A', textTransform: 'capitalize' }}>{d.name}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>{d.count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'rgba(79,70,229,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: '#4F46E5', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassSection>
      </div>

      {/* GA4 Placeholder */}
      <GlassSection style={{
        background: 'rgba(66,133,244,0.03)',
        border: '1px dashed rgba(66,133,244,0.2)',
      }}>
        <SectionTitle sub="Connect Google Analytics for full visitor-level data">Google Analytics (GA4)</SectionTitle>
        <div style={{ padding: '0.5rem 0', color: '#64748B', fontSize: '0.8125rem', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 0.5rem' }}>
            GA4 tracks your real 1.2K+ visitors on voomparts.com with full traffic source, geo, device, and behavior data.
            To connect it to this dashboard:
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.78rem' }}>
            <li>Create a service account in Google Cloud Console</li>
            <li>Enable the Google Analytics Data API</li>
            <li>Grant the service account Viewer access to your GA4 property</li>
            <li>Set <code style={{ background: 'rgba(66,133,244,0.08)', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>GA4_PROPERTY_ID</code>, <code style={{ background: 'rgba(66,133,244,0.08)', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>GA4_CLIENT_EMAIL</code>, and <code style={{ background: 'rgba(66,133,244,0.08)', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>GA4_PRIVATE_KEY</code> in your environment</li>
          </ol>
        </div>
      </GlassSection>
    </div>
  );
}

// ─── Engagement Tab ───

function EngagementTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-engagement'],
    queryFn: fetchEngagementAnalytics,
    staleTime: 120_000,
  });

  if (isLoading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>Loading engagement data...</div>;
  if (!data) return (
    <GlassSection>
      <SectionTitle sub="Requires new marketplace event types (vendor_view, filter_used, page_leave)">No Engagement Data Yet</SectionTitle>
      <p style={{ color: '#94A3B8', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>
        Engagement analytics will populate once the marketplace ships the new tracking events.
      </p>
    </GlassSection>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* WhatsApp Conversion Funnel */}
      <GlassSection>
        <SectionTitle sub="Product views → WhatsApp taps (7d)">WhatsApp Conversion Funnel</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {[
            { label: 'Product Views', value: data.whatsappFunnel.views, color: '#4F46E5' },
            { label: 'WhatsApp Taps', value: data.whatsappFunnel.taps, color: '#25D366' },
            { label: 'Tap Rate', value: `${data.whatsappFunnel.tapRate}%`, color: data.whatsappFunnel.tapRate > 10 ? '#059669' : '#D97706' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(248,250,252,0.8)' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, margin: 0, fontFamily: 'Space Grotesk' }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
              <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: '0.125rem 0 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </GlassSection>

      <div className="two-col-grid">
        {/* Search Click-Through Rate */}
        <GlassSection>
          <SectionTitle sub="Search → product view conversion (7d)">Search CTR</SectionTitle>
          {data.searchCTR.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>No search CTR data yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {data.searchCTR.slice(0, 10).map((s, i) => (
                <div key={s.query} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.375rem 0.5rem', borderRadius: '0.375rem',
                  background: i % 2 === 0 ? 'rgba(248,250,252,0.6)' : 'transparent',
                }}>
                  <span style={{ flex: 1, fontSize: '0.78rem', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.query}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8', whiteSpace: 'nowrap' }}>
                    {s.searches} search{s.searches !== 1 ? 'es' : ''} → {s.clicks} click{s.clicks !== 1 ? 's' : ''}
                  </span>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, fontFamily: 'Space Grotesk',
                    color: s.ctr > 20 ? '#059669' : s.ctr > 5 ? '#D97706' : '#E11D48',
                    minWidth: 40, textAlign: 'right',
                  }}>
                    {s.ctr}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassSection>

        {/* Filter Usage */}
        <GlassSection>
          <SectionTitle sub={`${data.filterUsage.totalFilterEvents} filter interactions (7d)`}>Filter Usage</SectionTitle>
          {data.filterUsage.makes.length === 0 && data.filterUsage.categories.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>No filter events yet</p>
          ) : (
            <>
              {data.filterUsage.makes.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Makes</p>
                  {data.filterUsage.makes.slice(0, 8).map(m => (
                    <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                      <span style={{ fontSize: '0.8rem', color: '#0F172A' }}>{m.name}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Space Grotesk' }}>{m.count}</span>
                    </div>
                  ))}
                </div>
              )}
              {data.filterUsage.categories.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Categories</p>
                  {data.filterUsage.categories.slice(0, 8).map(c => (
                    <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                      <span style={{ fontSize: '0.8rem', color: '#0F172A' }}>{c.name}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7C3AED', fontFamily: 'Space Grotesk' }}>{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </GlassSection>
      </div>

      <div className="two-col-grid">
        {/* Vendor Page Views */}
        <GlassSection>
          <SectionTitle sub="Most viewed vendor profiles (7d)">Vendor Views</SectionTitle>
          {data.vendorViews.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>No vendor view events yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {data.vendorViews.slice(0, 10).map((v, i) => (
                <div key={v.name} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.375rem 0.5rem', borderRadius: '0.375rem',
                  background: i % 2 === 0 ? 'rgba(248,250,252,0.6)' : 'transparent',
                }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', width: '1.5rem', textAlign: 'center' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.78rem', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8B5CF6', fontFamily: 'Space Grotesk' }}>{v.count}</span>
                </div>
              ))}
            </div>
          )}
        </GlassSection>

        {/* Session Duration */}
        <GlassSection>
          <SectionTitle sub="Average time on site (14d)">Session Duration</SectionTitle>
          {data.sessionDurations.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>No session end events yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {data.sessionDurations.map(d => (
                <div key={d.day} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.3rem 0.5rem', borderRadius: '0.375rem',
                  background: 'rgba(248,250,252,0.6)',
                }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{d.day}</span>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#0F172A' }}>
                      <strong style={{ fontFamily: 'Space Grotesk', color: '#4F46E5' }}>{d.avgSessionSec}s</strong> avg
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#0F172A' }}>
                      <strong style={{ fontFamily: 'Space Grotesk', color: '#7C3AED' }}>{d.avgPages}</strong> pages
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>{d.sessions} sessions</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassSection>
      </div>
    </div>
  );
}

// ─── Supply-Demand Gap Tab ───

function SupplyDemandTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['supply-demand-gaps'],
    queryFn: fetchSupplyDemandGaps,
    staleTime: 120_000,
  });

  if (isLoading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>Loading supply-demand data...</div>;
  if (!data || (data.gaps.length === 0 && data.topSearches.length === 0)) return (
    <GlassSection>
      <SectionTitle sub="Cross-references buyer searches with vendor pipeline">No Search Data Yet</SectionTitle>
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem' }}>
        Supply-demand gap analysis requires search event data from the marketplace.
      </div>
    </GlassSection>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Tracking warning if result counts aren't being sent */}
      {!data.resultCountTracked && (
        <GlassSection style={{
          padding: '0.875rem 1.125rem',
          background: 'rgba(217,119,6,0.04)',
          border: '1px solid rgba(217,119,6,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706', flexShrink: 0, marginTop: '0.25rem' }} />
            <div>
              <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#D97706', margin: 0 }}>
                Search result counts not tracked
              </p>
              <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0.125rem 0 0' }}>
                The marketplace is logging search queries but not how many results were returned.
                Zero-result rate and supply gaps cannot be calculated without this data.
                The marketplace needs to include <code style={{ background: 'rgba(217,119,6,0.08)', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>resultCount</code> in search event metadata.
              </p>
            </div>
          </div>
        </GlassSection>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
        {[
          { label: 'Total Searches (7d)', value: data.totalSearches.toLocaleString(), color: '#4F46E5' },
          { label: 'Unique Queries', value: data.uniqueQueries ?? data.topSearches.length, color: '#7C3AED' },
          { label: 'Zero-Result Gaps', value: data.resultCountTracked ? data.gaps.length : 'N/A', color: '#E11D48' },
          { label: 'Zero-Result Rate', value: data.resultCountTracked ? `${data.zeroResultRate}%` : 'N/A', color: '#D97706' },
        ].map(s => (
          <GlassSection key={s.label} style={{ padding: '0.875rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: typeof s.value === 'string' && s.value === 'N/A' ? '#CBD5E1' : s.color, margin: 0, fontFamily: 'Space Grotesk' }}>{s.value}</p>
            <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: '0.125rem 0 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{s.label}</p>
          </GlassSection>
        ))}
      </div>

      {/* Supply Gaps — the killer table */}
      <GlassSection>
        <SectionTitle sub="Buyers searched but found nothing — these are vendor recruitment targets">
          Supply Gaps (Zero-Result Searches)
        </SectionTitle>
        {data.gaps.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>No zero-result searches in the last 7 days</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {data.gaps.map(gap => (
              <div key={gap.query} style={{
                padding: '0.75rem', borderRadius: '0.75rem',
                background: 'rgba(225,29,72,0.03)', borderLeft: '3px solid #E11D48',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>"{gap.query}"</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#E11D48', fontFamily: 'Space Grotesk' }}>
                    {gap.searchCount} search{gap.searchCount !== 1 ? 'es' : ''}
                  </span>
                </div>
                {gap.matchedVendors.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <p style={{ fontSize: '0.68rem', color: '#64748B', margin: 0, fontWeight: 600 }}>Likely vendors in pipeline:</p>
                    {gap.matchedVendors.map((v: any) => (
                      <div key={v.vendorId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', background: 'rgba(248,250,252,0.6)' }}>
                        <span style={{ fontSize: '0.78rem', color: '#0F172A' }}>{v.businessName} ({v.city || 'Ghana'})</span>
                        <a
                          href={`https://wa.me/${(v.whatsapp || v.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${v.businessName}, buyers on VOOM are searching for "${gap.query}". Do you carry this part? List it at voomparts.com`)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: '0.15rem 0.5rem', borderRadius: '0.375rem',
                            background: '#25D366', color: 'white', fontSize: '0.68rem', fontWeight: 600,
                            textDecoration: 'none', flexShrink: 0,
                          }}
                        >
                          Message
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.72rem', color: '#94A3B8', margin: 0 }}>No matching vendors found in pipeline</p>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassSection>

      {/* Top Searches */}
      <GlassSection>
        <SectionTitle sub="All search queries ranked by volume (7 days)">Top Searches</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {data.topSearches.slice(0, 20).map((s, i) => {
            const isZero = s.resultCount === 0;
            return (
              <div key={s.query} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.375rem 0.5rem', borderRadius: '0.375rem',
                background: isZero ? 'rgba(225,29,72,0.04)' : i % 2 === 0 ? 'rgba(248,250,252,0.6)' : 'transparent',
                borderLeft: isZero ? '3px solid #E11D48' : '3px solid transparent',
              }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', width: '1.5rem', textAlign: 'center' }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: '0.78rem', color: isZero ? '#E11D48' : '#0F172A', fontWeight: isZero ? 600 : 400 }}>{s.query}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', fontFamily: 'Space Grotesk' }}>{s.searchCount}x</span>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 600, padding: '0.1rem 0.35rem', borderRadius: 999,
                  color: isZero ? '#E11D48' : '#059669',
                  background: isZero ? 'rgba(225,29,72,0.1)' : 'rgba(5,150,105,0.1)',
                }}>
                  {s.resultCount} result{s.resultCount !== 1 ? 's' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </GlassSection>
    </div>
  );
}

// ─── Unit Economics Tab ───

function UnitEconomicsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['unit-economics'],
    queryFn: fetchUnitEconomics,
    staleTime: 120_000,
  });

  if (isLoading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>Loading unit economics...</div>;
  if (!data) return (
    <GlassSection>
      <SectionTitle sub="Vendor LTV, CAC, churn, activation metrics">No Data Available</SectionTitle>
      <p style={{ color: '#94A3B8', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>
        Connect the database to see unit economics.
      </p>
    </GlassSection>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Core Unit Economics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
        {[
          { label: 'MRR', value: `GH₵ ${data.mrr.toLocaleString()}`, color: '#059669' },
          { label: 'ARPU', value: `GH₵ ${data.arpu}`, sub: 'Avg revenue per vendor', color: '#4F46E5' },
          { label: 'Vendor LTV', value: `GH₵ ${data.ltv.toLocaleString()}`, sub: 'Lifetime value', color: '#7C3AED' },
          { label: 'CAC', value: data.cac > 0 ? `GH₵ ${data.cac}` : '$0', sub: 'Founder time only', color: '#D97706' },
          { label: 'LTV:CAC', value: data.ltvCacRatio ? `${data.ltvCacRatio}:1` : 'N/A', sub: 'Target: >3:1', color: '#0F172A' },
        ].map(s => (
          <GlassSection key={s.label} style={{ padding: '0.875rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color, margin: 0, fontFamily: 'Space Grotesk' }}>{s.value}</p>
            <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0F172A', margin: '0.25rem 0 0' }}>{s.label}</p>
            {(s as any).sub && <p style={{ fontSize: '0.62rem', color: '#94A3B8', margin: '0.125rem 0 0' }}>{(s as any).sub}</p>}
          </GlassSection>
        ))}
      </div>

      {/* Vendor Funnel Metrics */}
      <GlassSection>
        <SectionTitle sub="Vendor lifecycle conversion rates">Vendor Funnel</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {[
            { label: 'Total Vendors in Pipeline', value: data.totalVendors, pct: 100, color: '#4F46E5' },
            { label: 'Active (with sales)', value: data.activeVendors, pct: data.activationRate, color: '#059669' },
            { label: 'Paid Subscribers', value: data.paidVendors, pct: data.conversionToPaid, color: '#7C3AED' },
            { label: 'Churned / Lost', value: data.churnedVendors, pct: data.churnRate, color: '#E11D48' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#0F172A', fontWeight: 500 }}>{item.label}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                  {item.value} <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 400 }}>({item.pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(79,70,229,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.min(item.pct, 100)}%`, borderRadius: 999,
                  background: item.color, transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </GlassSection>

      {/* Investor-ready interpretation */}
      <GlassSection>
        <SectionTitle sub="What these numbers mean for fundraising">Investor Lens</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {[
            {
              metric: 'Activation Rate',
              value: `${data.activationRate}%`,
              verdict: data.activationRate > 20 ? 'Healthy' : data.activationRate > 5 ? 'Needs improvement' : 'Critical — vendors registering but not listing',
              color: data.activationRate > 20 ? '#059669' : data.activationRate > 5 ? '#D97706' : '#E11D48',
            },
            {
              metric: 'Paid Conversion',
              value: `${data.conversionToPaid}%`,
              verdict: data.conversionToPaid > 10 ? 'Strong monetization signal' : data.conversionToPaid > 2 ? 'Early traction' : 'Pre-revenue — focus on activation first',
              color: data.conversionToPaid > 10 ? '#059669' : data.conversionToPaid > 2 ? '#D97706' : '#64748B',
            },
            {
              metric: 'Churn Rate',
              value: `${data.churnRate}%`,
              verdict: data.churnRate < 5 ? 'Excellent retention' : data.churnRate < 15 ? 'Acceptable for early stage' : 'High churn — investigate onboarding',
              color: data.churnRate < 5 ? '#059669' : data.churnRate < 15 ? '#D97706' : '#E11D48',
            },
          ].map(item => (
            <div key={item.metric} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
              background: `${item.color}08`, borderLeft: `3px solid ${item.color}`,
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A' }}>{item.metric}: </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: item.color, fontFamily: 'Space Grotesk' }}>{item.value}</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: item.color, fontWeight: 500 }}>{item.verdict}</span>
            </div>
          ))}
        </div>
      </GlassSection>
    </div>
  );
}

// ─── Main Analytics Component ───

export function Analytics() {
  const [tab, setTab] = useState<Tab>('users');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <UserAnalyticsDrawer userId={selectedUserId} onClose={() => setSelectedUserId(null)} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Tab switcher */}
        <div style={{ display: 'flex', background: 'rgba(79,70,229,0.07)', borderRadius: '0.875rem', padding: '0.25rem', gap: '0.125rem' }}>
          {(['users', 'products', 'traffic', 'engagement', 'gaps', 'economics'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: 'none', cursor: 'pointer',
              background: tab === t ? '#fff' : 'transparent',
              fontWeight: tab === t ? 700 : 400, fontSize: '0.8rem',
              color: tab === t ? '#4F46E5' : '#64748B',
              boxShadow: tab === t ? '0 1px 6px rgba(79,70,229,0.15)' : 'none',
              transition: 'all 0.15s', fontFamily: 'Plus Jakarta Sans',
            }}>
              {t === 'users' ? '👤 Users' : t === 'products' ? '📦 Products' : t === 'traffic' ? '🌐 Traffic' : t === 'engagement' ? '📊 Engagement' : t === 'gaps' ? '🔍 Supply Gaps' : '💰 Economics'}
            </button>
          ))}
        </div>

        {/* Time range filter — only relevant for Products tab */}
        {tab === 'products' && (
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {(Object.keys(TIME_LABELS) as TimeRange[]).map(tr => (
              <button key={tr} onClick={() => setTimeRange(tr)} style={{
                padding: '0.375rem 0.75rem', borderRadius: '0.625rem',
                border: `1px solid ${timeRange === tr ? '#4F46E5' : 'rgba(79,70,229,0.15)'}`,
                background: timeRange === tr ? 'rgba(79,70,229,0.09)' : 'transparent',
                color: timeRange === tr ? '#4F46E5' : '#64748B',
                fontSize: '0.78rem', fontWeight: timeRange === tr ? 700 : 400,
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'Plus Jakarta Sans',
              }}>
                {TIME_LABELS[tr]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {tab === 'users' && <UsersTab onSelectUser={setSelectedUserId} />}
      {tab === 'products' && <ProductsTab timeRange={timeRange} />}
      {tab === 'traffic' && <TrafficTab />}
      {tab === 'engagement' && <EngagementTab />}
      {tab === 'gaps' && <SupplyDemandTab />}
      {tab === 'economics' && <UnitEconomicsTab />}
    </div>
  );
}
