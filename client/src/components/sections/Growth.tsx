/**
 * Growth Section — Arctic Glass Design System
 * Startup health KPIs, growth trajectory, and vendor tier distribution
 * Now powered by REAL data from Render PostgreSQL
 */

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PieChart, Pie, Cell } from 'recharts';
import { MetricCard } from '../MetricCard';
import type { DashboardKPIs, GrowthData, Vendor } from '../../lib/voomApi';

interface GrowthProps {
  kpis: DashboardKPIs;
  growthData: GrowthData | null;
  vendors: Vendor[];
}

function GlassSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="glass-card" style={{ padding: '1.25rem', ...style }}>{children}</div>;
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>{children}</h3>
      {sub && <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.125rem' }}>{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(79,70,229,0.15)', borderRadius: '0.75rem',
      padding: '0.625rem 0.875rem', boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.25rem' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: '0.8125rem', fontWeight: 700, color: p.color, fontFamily: 'Space Grotesk' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const TIER_COLORS: Record<string, string> = {
  free: '#94A3B8',
  starter: '#4F46E5',
  pro: '#7C3AED',
  business: '#059669',
  enterprise: '#D97706',
};

function monthLabel(yyyymm: string): string {
  const [, m] = yyyymm.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(m, 10) - 1] || yyyymm;
}

export function Growth({ kpis, growthData, vendors }: GrowthProps) {
  // Build cumulative growth data from API
  const growthChartData = useMemo(() => {
    if (!growthData) return [];
    const months = new Set<string>();
    growthData.vendorGrowth.forEach(v => months.add(v.month));
    growthData.orderGrowth.forEach(o => months.add(o.month));
    growthData.productGrowth.forEach(p => months.add(p.month));

    const sortedMonths = Array.from(months).sort();
    const vendorMap = new Map(growthData.vendorGrowth.map(v => [v.month, v.count]));
    const orderMap = new Map(growthData.orderGrowth.map(o => [o.month, o.count]));
    const productMap = new Map(growthData.productGrowth.map(p => [p.month, p.count]));

    let cVendors = 0, cOrders = 0, cProducts = 0;
    return sortedMonths.map(month => {
      cVendors += vendorMap.get(month) || 0;
      cOrders += orderMap.get(month) || 0;
      cProducts += productMap.get(month) || 0;
      return {
        month: monthLabel(month),
        vendors: cVendors,
        orders: cOrders,
        products: cProducts,
      };
    });
  }, [growthData]);

  // Tier distribution from real vendor data
  const tierData = useMemo(() => {
    const dist: Record<string, number> = {};
    vendors.forEach(v => {
      dist[v.tier] = (dist[v.tier] || 0) + 1;
    });
    return Object.entries(dist).map(([tier, count]) => ({
      name: tier.charAt(0).toUpperCase() + tier.slice(1),
      value: count,
      color: TIER_COLORS[tier] || '#94A3B8',
    }));
  }, [vendors]);

  const radarData = useMemo(() => [
    { metric: 'Supply', value: Math.min(100, kpis.totalProducts) },
    { metric: 'Demand', value: Math.min(100, kpis.totalPartRequests * 2) },
    { metric: 'GMV', value: Math.min(100, Math.round(kpis.totalGMV / 1000)) },
    { metric: 'Vendors', value: Math.min(100, kpis.totalVendors * 3) },
    { metric: 'Completion', value: Math.round(kpis.orderCompletionRate) },
    { metric: 'Categories', value: Math.min(100, kpis.totalCategories * 5) },
  ], [kpis]);

  const startupHealth = [
    { label: 'Vendor Approval Rate', value: `${kpis.vendorApprovalRate.toFixed(0)}%`, color: kpis.vendorApprovalRate > 50 ? '#059669' : '#D97706' },
    { label: 'Order Completion Rate', value: `${kpis.orderCompletionRate.toFixed(0)}%`, color: kpis.orderCompletionRate > 50 ? '#059669' : '#D97706' },
    { label: 'Part Request Fill Rate', value: kpis.totalPartRequests > 0 ? `${Math.round((kpis.fulfilledPartRequests / kpis.totalPartRequests) * 100)}%` : '0%', color: '#4F46E5' },
    { label: 'Total Users', value: String(kpis.totalUsers), color: '#4F46E5' },
    { label: 'Total GMV', value: `GH₵ ${kpis.totalGMV.toLocaleString()}`, color: '#059669' },
    { label: 'Commission Earned', value: `GH₵ ${kpis.totalCommission.toLocaleString()}`, color: '#059669' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Growth Dashboard
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
          VOOM Ghana · Marketplace growth trajectory
        </p>
      </div>

      {/* KPI Row */}
      <div className="three-col-grid">
        <MetricCard label="Vendor Growth" value={kpis.vendorGrowth} format="percent" variant="emerald" delay={0} subtitle="Month over month" />
        <MetricCard label="GMV Growth" value={kpis.gmvGrowth} format="percent" variant="emerald" delay={1} subtitle="Month over month" />
        <MetricCard label="Order Growth" value={kpis.orderGrowth} format="percent" variant="emerald" delay={2} subtitle="Month over month" />
      </div>

      {/* Growth Trajectory */}
      {growthChartData.length > 0 && (
        <GlassSection>
          <SectionTitle sub="Cumulative growth over time">Growth Trajectory</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={growthChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,70,229,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="vendors" stroke="#4F46E5" strokeWidth={2.5} dot={{ fill: '#4F46E5', r: 4 }} name="Vendors" />
              <Line type="monotone" dataKey="orders" stroke="#059669" strokeWidth={2.5} dot={{ fill: '#059669', r: 4 }} name="Orders" />
              <Line type="monotone" dataKey="products" stroke="#D97706" strokeWidth={2.5} dot={{ fill: '#D97706', r: 4 }} name="Products" />
            </LineChart>
          </ResponsiveContainer>
        </GlassSection>
      )}

      {/* Startup Health + Radar + Tier Distribution */}
      <div className="two-col-grid">
        <GlassSection>
          <SectionTitle sub="Key health indicators">Startup Health Check</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {startupHealth.map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.625rem 0.875rem',
                borderRadius: '0.75rem',
                background: 'rgba(248,250,252,0.8)',
                border: `1px solid ${item.color}20`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 500 }}>{item.label}</span>
                </div>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: item.color, fontFamily: 'Space Grotesk' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </GlassSection>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <GlassSection>
            <SectionTitle sub="Marketplace maturity score">Platform Radar</SectionTitle>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(79,70,229,0.1)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'Plus Jakarta Sans' }} />
                <Radar name="VOOM" dataKey="value" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </GlassSection>

          {tierData.length > 0 && (
            <GlassSection>
              <SectionTitle sub="Subscription tiers">Vendor Tiers</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <PieChart width={100} height={100}>
                  <Pie data={tierData} cx={50} cy={50} innerRadius={28} outerRadius={45} paddingAngle={3} dataKey="value">
                    {tierData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
                  {tierData.map(item => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.color }} />
                        <span style={{ fontSize: '0.75rem', color: '#475569' }}>{item.name}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0F172A', fontFamily: 'Space Grotesk' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassSection>
          )}
        </div>
      </div>

      {/* Milestones */}
      <GlassSection>
        <SectionTitle sub="Launch milestones">Roadmap Progress</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { milestone: 'Marketplace MVP launched', date: 'Oct 2025', done: true },
            { milestone: 'First 10 vendors onboarded', date: 'Nov 2025', done: true },
            { milestone: 'First paid order processed', date: 'Nov 2025', done: true },
            { milestone: 'Part request system launched', date: 'Jan 2026', done: true },
            { milestone: 'Vendor subscription tiers', date: 'Feb 2026', done: true },
            { milestone: 'CEO Dashboard connected to Render DB', date: 'Mar 2026', done: true },
            { milestone: '100 active vendors', date: 'Apr 2026', done: false },
            { milestone: 'GH₵ 100k GMV milestone', date: 'May 2026', done: false },
            { milestone: 'Kumasi expansion', date: 'Q3 2026', done: false },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: item.done ? '#059669' : 'rgba(148,163,184,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.done
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#CBD5E1' }} />
                }
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: item.done ? 600 : 400, color: item.done ? '#0F172A' : '#94A3B8' }}>
                  {item.milestone}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontFamily: 'Space Grotesk' }}>{item.date}</span>
            </div>
          ))}
        </div>
      </GlassSection>
    </div>
  );
}
