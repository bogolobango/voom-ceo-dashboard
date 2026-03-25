/**
 * Revenue Section — Arctic Glass Design System
 * GMV trend, AOV, commission, payment methods, and regional breakdown
 * Now powered by REAL data from Render PostgreSQL
 */

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from 'recharts';
import type { Order, DashboardKPIs, RevenueData } from '../../lib/voomApi';
import { generateRevenueChartData } from '../../lib/voomApi';
import { MetricCard } from '../MetricCard';

interface RevenueProps {
  orders: Order[];
  kpis: DashboardKPIs;
  revenueData: RevenueData | null;
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

const PAYMENT_COLORS: Record<string, string> = {
  pay_on_delivery: '#D97706',
  mobile_money: '#059669',
  card: '#4F46E5',
};

const PAYMENT_LABELS: Record<string, string> = {
  pay_on_delivery: 'Pay on Delivery',
  mobile_money: 'Mobile Money',
  card: 'Card',
};

export function Revenue({ orders, kpis, revenueData }: RevenueProps) {
  const chartData = useMemo(() => generateRevenueChartData(orders), [orders]);

  // Weekly aggregation from chart data
  const weeklyData = useMemo(() => {
    const weeks: { week: string; revenue: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekRevenue = chartData.slice(i * 7, (i + 1) * 7).reduce((s, d) => s + d.revenue, 0);
      weeks.push({
        week: `Week ${4 - i}`,
        revenue: weekRevenue,
      });
    }
    return weeks;
  }, [chartData]);

  // Regional data from API
  const regionData = useMemo(() => {
    if (revenueData?.byRegion?.length) {
      return revenueData.byRegion.slice(0, 6);
    }
    return [];
  }, [revenueData]);

  // Payment method data from API
  const paymentData = useMemo(() => {
    if (revenueData?.byPaymentMethod?.length) {
      return revenueData.byPaymentMethod;
    }
    return [];
  }, [revenueData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Revenue Intelligence
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
          GMV, AOV, commission, and regional breakdown · All amounts in GH₵
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <MetricCard label="Total GMV" value={kpis.totalGMV} format="cedis" trend={kpis.gmvGrowth} variant="emerald" delay={0} />
        <MetricCard label="Commission Earned" value={kpis.totalCommission} format="cedis" variant="indigo" delay={1} subtitle="12% default rate" />
        <MetricCard label="Avg Order Value" value={kpis.avgOrderValue} format="cedis" variant="indigo" delay={2} />
        <MetricCard label="Completion Rate" value={kpis.orderCompletionRate} format="percent" variant="emerald" delay={3} />
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

      {/* Weekly + Regional/Payment */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.25rem' }}>
        <GlassSection>
          <SectionTitle sub="Weekly totals">Weekly Revenue</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,70,229,0.05)" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </GlassSection>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Regional Split */}
          {regionData.length > 0 && (
            <GlassSection>
              <SectionTitle sub="By region">Revenue Split</SectionTitle>
              {regionData.map((r, i) => {
                const totalRev = revenueData?.totalRevenue || 1;
                const pct = Math.round((r.total / totalRev) * 100);
                const colors = ['#4F46E5', '#059669', '#D97706', '#7C3AED', '#0EA5E9', '#94A3B8'];
                return (
                  <div key={r.region} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 500 }}>{r.region}</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="liquid-bar" style={{ height: 6 }}>
                      <div className="liquid-bar-fill" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                    </div>
                  </div>
                );
              })}
            </GlassSection>
          )}

          {/* Payment Methods */}
          {paymentData.length > 0 && (
            <GlassSection>
              <SectionTitle sub="By payment method">Payment Mix</SectionTitle>
              {paymentData.map(p => {
                const totalRev = revenueData?.totalRevenue || 1;
                const pct = Math.round((p.total / totalRev) * 100);
                const color = PAYMENT_COLORS[p.method] || '#94A3B8';
                return (
                  <div key={p.method} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 500 }}>
                        {PAYMENT_LABELS[p.method] || p.method}
                      </span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                        GH₵ {p.total.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="liquid-bar" style={{ height: 6 }}>
                      <div className="liquid-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </GlassSection>
          )}
        </div>
      </div>
    </div>
  );
}
