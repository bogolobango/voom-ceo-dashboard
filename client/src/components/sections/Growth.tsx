/**
 * Growth Section — Arctic Glass Design System
 * Startup health KPIs, cohort analysis, and growth trajectory
 */

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';
import { MetricCard } from '../MetricCard';
import type { DashboardKPIs } from '../../lib/voomApi';

interface GrowthProps {
  kpis: DashboardKPIs;
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

const growthData = [
  { month: 'Oct', vendors: 2, products: 12, orders: 3, gmv: 450 },
  { month: 'Nov', vendors: 5, products: 34, orders: 11, gmv: 1820 },
  { month: 'Dec', vendors: 9, products: 78, orders: 24, gmv: 4200 },
  { month: 'Jan', vendors: 18, products: 134, orders: 41, gmv: 8900 },
  { month: 'Feb', vendors: 28, products: 198, orders: 63, gmv: 15400 },
  { month: 'Mar', vendors: 34, products: 247, orders: 48, gmv: 19800 },
];

const radarData = [
  { metric: 'Supply', value: 68 },
  { metric: 'Demand', value: 42 },
  { metric: 'GMV', value: 35 },
  { metric: 'Retention', value: 71 },
  { metric: 'NPS', value: 82 },
  { metric: 'Coverage', value: 28 },
];

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

export function Growth({ kpis }: GrowthProps) {
  const startupHealth = [
    { label: 'Vendor Growth MoM', value: `+${kpis.vendorGrowth.toFixed(1)}%`, color: '#059669', status: 'good' },
    { label: 'GMV Growth MoM', value: `+${kpis.gmvGrowth.toFixed(1)}%`, color: '#059669', status: 'good' },
    { label: 'Order Growth MoM', value: `+${kpis.orderGrowth.toFixed(1)}%`, color: '#059669', status: 'good' },
    { label: 'Lead CVR', value: `${kpis.leadConversionRate}%`, color: '#D97706', status: 'warn' },
    { label: 'Vendor Approval Rate', value: `${kpis.vendorApprovalRate.toFixed(0)}%`, color: '#4F46E5', status: 'good' },
    { label: 'Order Completion Rate', value: `${kpis.orderCompletionRate.toFixed(0)}%`, color: '#4F46E5', status: 'good' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Growth Dashboard
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
          VOOM Ghana · Early Stage · Launch trajectory since October 2025
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <MetricCard label="Vendor Growth" value={kpis.vendorGrowth} format="percent" variant="emerald" delay={0} subtitle="Month over month" />
        <MetricCard label="GMV Growth" value={kpis.gmvGrowth} format="percent" variant="emerald" delay={1} subtitle="Month over month" />
        <MetricCard label="Order Growth" value={kpis.orderGrowth} format="percent" variant="emerald" delay={2} subtitle="Month over month" />
      </div>

      {/* Growth Trajectory */}
      <GlassSection>
        <SectionTitle sub="Oct 2025 – Mar 2026">Growth Trajectory</SectionTitle>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={growthData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,70,229,0.05)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="vendors" stroke="#4F46E5" strokeWidth={2.5} dot={{ fill: '#4F46E5', r: 4 }} name="Vendors" />
            <Line type="monotone" dataKey="orders" stroke="#059669" strokeWidth={2.5} dot={{ fill: '#059669', r: 4 }} name="Orders" />
          </LineChart>
        </ResponsiveContainer>
      </GlassSection>

      {/* Startup Health + Radar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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

        <GlassSection>
          <SectionTitle sub="Marketplace maturity score">Platform Radar</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(79,70,229,0.1)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'Plus Jakarta Sans' }} />
              <Radar name="VOOM" dataKey="value" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </GlassSection>
      </div>

      {/* Milestones */}
      <GlassSection>
        <SectionTitle sub="Launch milestones">Roadmap Progress</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { milestone: 'Marketplace MVP launched', date: 'Oct 2025', done: true },
            { milestone: 'First 10 vendors onboarded', date: 'Nov 2025', done: true },
            { milestone: 'First paid order processed', date: 'Nov 2025', done: true },
            { milestone: 'Tonaton lead scraper built', date: 'Mar 2026', done: true },
            { milestone: 'WhatsApp broadcast campaign', date: 'Mar 2026', done: true },
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
