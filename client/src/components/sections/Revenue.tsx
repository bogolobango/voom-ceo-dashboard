/**
 * Revenue Section — Arctic Glass Design System
 * GMV trend, AOV, revenue breakdown by category and region
 */

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend,
} from 'recharts';
import type { Order, DashboardKPIs } from '../../lib/voomApi';
import { generateRevenueChartData } from '../../lib/voomApi';
import { MetricCard } from '../MetricCard';

interface RevenueProps {
  orders: Order[];
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
        <p key={i} style={{ fontSize: '0.875rem', fontWeight: 700, color: p.color, fontFamily: 'Space Grotesk' }}>
          GH₵ {p.value?.toLocaleString?.() ?? p.value}
        </p>
      ))}
    </div>
  );
};

export function Revenue({ orders, kpis }: RevenueProps) {
  const chartData = useMemo(() => generateRevenueChartData(orders), [orders]);

  // Weekly aggregation
  const weeklyData = useMemo(() => {
    const weeks: { week: string; revenue: number; target: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekRevenue = chartData.slice(i * 7, (i + 1) * 7).reduce((s, d) => s + d.revenue, 0);
      weeks.push({
        week: `Week ${4 - i}`,
        revenue: weekRevenue,
        target: weekRevenue * 1.15,
      });
    }
    return weeks;
  }, [chartData]);

  const regionData = [
    { region: 'Greater Accra', revenue: kpis.totalGMV * 0.68 },
    { region: 'Ashanti', revenue: kpis.totalGMV * 0.18 },
    { region: 'Eastern', revenue: kpis.totalGMV * 0.08 },
    { region: 'Other', revenue: kpis.totalGMV * 0.06 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Revenue Intelligence
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
          GMV, AOV, and regional breakdown · All amounts in GH₵
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <MetricCard label="Total GMV" value={kpis.totalGMV} format="cedis" trend={kpis.gmvGrowth} variant="emerald" delay={0} />
        <MetricCard label="Avg Order Value" value={kpis.avgOrderValue} format="cedis" trend={5.2} variant="indigo" delay={1} />
        <MetricCard label="Completed Orders" value={kpis.completedOrders} trend={kpis.orderGrowth} variant="emerald" delay={2} />
        <MetricCard label="Completion Rate" value={kpis.orderCompletionRate} format="percent" trend={3.1} variant="indigo" delay={3} />
      </div>

      {/* GMV Trend */}
      <GlassSection>
        <SectionTitle sub="Daily GMV · Last 30 days">Revenue Trend</SectionTitle>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(5,150,105,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fill="url(#revGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </GlassSection>

      {/* Weekly vs Target + Regional */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.25rem' }}>
        <GlassSection>
          <SectionTitle sub="Actual vs target">Weekly Revenue</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,70,229,0.05)" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} name="Actual" />
              <Bar dataKey="target" fill="rgba(79,70,229,0.15)" radius={[4, 4, 0, 0]} name="Target" />
            </BarChart>
          </ResponsiveContainer>
        </GlassSection>

        <GlassSection>
          <SectionTitle sub="By region">Revenue Split</SectionTitle>
          {regionData.map((r, i) => {
            const pct = Math.round((r.revenue / kpis.totalGMV) * 100);
            const colors = ['#4F46E5', '#059669', '#D97706', '#94A3B8'];
            return (
              <div key={r.region} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 500 }}>{r.region}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                    {pct}%
                  </span>
                </div>
                <div className="liquid-bar" style={{ height: 6 }}>
                  <div className="liquid-bar-fill" style={{ width: `${pct}%`, background: colors[i] }} />
                </div>
              </div>
            );
          })}
        </GlassSection>
      </div>
    </div>
  );
}
