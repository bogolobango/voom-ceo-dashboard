/**
 * Overview Section — Arctic Glass Design System
 * Hero KPI row + GMV chart + vendor pipeline + recent orders + lead funnel
 */

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { MetricCard } from '../MetricCard';
import type { DashboardKPIs, Order, Vendor } from '../../lib/voomApi';
import { generateRevenueChartData, getTopVendors, getOrderStatusDist } from '../../lib/voomApi';

interface OverviewProps {
  kpis: DashboardKPIs;
  orders: Order[];
  vendors: Vendor[];
  loading: boolean;
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  delivered: '#059669',
  shipped: '#4F46E5',
  processing: '#7C3AED',
  confirmed: '#0EA5E9',
  pending: '#F59E0B',
  cancelled: '#EF4444',
};

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h2 style={{
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '1rem',
        fontWeight: 700,
        color: '#0F172A',
        margin: 0,
      }}>
        {children}
      </h2>
      {sub && <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.125rem' }}>{sub}</p>}
    </div>
  );
}

function GlassSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="glass-card" style={{ padding: '1.25rem', ...style }}>
      {children}
    </div>
  );
}

function IconStore() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IconBox() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>; }
function IconCart() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>; }
function IconGMV() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>; }
function IconPhone() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z"/></svg>; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(79,70,229,0.15)',
      borderRadius: '0.75rem',
      padding: '0.625rem 0.875rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.25rem' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: '0.875rem', fontWeight: 700, color: p.color || '#4F46E5', fontFamily: 'Space Grotesk' }}>
          {p.name === 'revenue' ? `GH₵ ${p.value.toLocaleString()}` : p.value}
        </p>
      ))}
    </div>
  );
};

export function Overview({ kpis, orders, vendors, loading }: OverviewProps) {
  const chartData = useMemo(() => generateRevenueChartData(orders), [orders]);
  const topVendors = useMemo(() => getTopVendors(vendors, 5), [vendors]);
  const orderDist = useMemo(() => getOrderStatusDist(orders), [orders]);
  const recentOrders = useMemo(() => [...orders].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 8), [orders]);

  const pieData = Object.entries(orderDist).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    color: ORDER_STATUS_COLORS[status] || '#94A3B8',
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '3px solid rgba(79,70,229,0.2)',
            borderTopColor: '#4F46E5',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: '#94A3B8', fontSize: '0.875rem' }}>Loading VOOM data...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Hero KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
        <MetricCard
          label="Total Vendors"
          value={kpis.totalVendors}
          trend={kpis.vendorGrowth}
          icon={<IconStore />}
          variant="indigo"
          delay={0}
          subtitle={`${kpis.approvedVendors} active · ${kpis.pendingVendors} pending`}
        />
        <MetricCard
          label="Total Products"
          value={kpis.totalProducts}
          trend={12.3}
          icon={<IconBox />}
          variant="indigo"
          delay={1}
          subtitle={`${kpis.totalCategories} categories`}
        />
        <MetricCard
          label="Total Orders"
          value={kpis.totalOrders}
          trend={kpis.orderGrowth}
          icon={<IconCart />}
          variant="emerald"
          delay={2}
          subtitle={`${kpis.completedOrders} delivered`}
        />
        <MetricCard
          label="GMV (30d)"
          value={kpis.totalGMV}
          format="cedis"
          trend={kpis.gmvGrowth}
          icon={<IconGMV />}
          variant="emerald"
          delay={3}
          subtitle={`Avg GH₵ ${kpis.avgOrderValue.toFixed(0)}/order`}
        />
        <MetricCard
          label="Tonaton Leads"
          value={kpis.totalLeads}
          trend={null as any}
          icon={<IconPhone />}
          variant="amber"
          delay={4}
          subtitle={`${kpis.leadsContacted} contacted · ${kpis.leadConversionRate}% CVR`}
        />
      </div>

      {/* ── GMV Chart + Order Distribution ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
        <GlassSection>
          <SectionTitle sub="Last 30 days · GH₵">GMV & Order Volume</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,70,229,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94A3B8', fontFamily: 'Inter' }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94A3B8', fontFamily: 'Inter' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v > 0 ? `${(v / 1000).toFixed(0)}k` : '0'}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2} fill="url(#gmvGrad)" name="revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassSection>

        <GlassSection>
          <SectionTitle sub="By status">Order Distribution</SectionTitle>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <PieChart width={160} height={160}>
              <Pie data={pieData} cx={80} cy={80} innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number, name: string) => [v, name]} />
            </PieChart>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {pieData.slice(0, 5).map(item => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: '#475569' }}>{item.name}</span>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </GlassSection>
      </div>

      {/* ── Top Vendors + Recent Orders ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Top Vendors */}
        <GlassSection>
          <SectionTitle sub="By total sales">Top Vendors</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {topVendors.map((vendor, i) => {
              const maxSales = topVendors[0]?.totalSales || 1;
              const pct = ((vendor.totalSales || 0) / maxSales) * 100;
              return (
                <div key={vendor.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '0.375rem',
                        background: `hsl(${i * 60 + 240}, 70%, 92%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.625rem', fontWeight: 800, color: `hsl(${i * 60 + 240}, 60%, 40%)`,
                      }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#0F172A' }}>
                        {vendor.businessName}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Space Grotesk' }}>
                      {vendor.totalSales}
                    </span>
                  </div>
                  <div className="liquid-bar" style={{ height: 4 }}>
                    <div
                      className="liquid-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, hsl(${i * 60 + 240}, 70%, 60%), hsl(${i * 60 + 270}, 70%, 55%))`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassSection>

        {/* Recent Orders */}
        <GlassSection>
          <SectionTitle sub="Last 8 orders">Recent Orders</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentOrders.map(order => {
              const statusColor = ORDER_STATUS_COLORS[order.status] || '#94A3B8';
              return (
                <div key={order.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0.625rem',
                  borderRadius: '0.625rem',
                  background: 'rgba(248,250,252,0.8)',
                }}>
                  <div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                      {order.orderNumber}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                      {order.buyerName || 'Anonymous'} · {order.shippingCity || 'Ghana'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                      GH₵ {parseFloat(order.totalAmount).toFixed(0)}
                    </p>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 600,
                      color: statusColor,
                      background: `${statusColor}18`,
                      padding: '0.1rem 0.4rem',
                      borderRadius: 999,
                    }}>
                      {order.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassSection>
      </div>

      {/* ── Ghana Map + Lead Funnel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Ghana Map */}
        <GlassSection style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <SectionTitle sub="Vendor & lead concentration">Geographic Coverage</SectionTitle>
          <div style={{ position: 'relative', width: '100%', maxWidth: 260 }}>
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310419663030063122/S24DoyCSFkWt7Q8ajupqHx/voom-ghana-map_48bcae34.png"
              alt="Ghana coverage map"
              style={{ width: '100%', borderRadius: '0.75rem', opacity: 0.9 }}
            />
            <div style={{
              position: 'absolute', bottom: 12, left: 12, right: 12,
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(8px)',
              borderRadius: '0.625rem',
              padding: '0.5rem 0.75rem',
              border: '1px solid rgba(255,255,255,0.9)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {[
                  { city: 'Accra', count: 68 },
                  { city: 'Kumasi', count: 12 },
                  { city: 'Tamale', count: 4 },
                ].map(c => (
                  <div key={c.city} style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Space Grotesk', lineHeight: 1 }}>{c.count}</p>
                    <p style={{ fontSize: '0.65rem', color: '#64748B' }}>{c.city}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassSection>

        {/* Lead Funnel */}
        <GlassSection>
          <SectionTitle sub="Tonaton scraper pipeline">Lead Funnel</SectionTitle>
          {[
            { stage: 'Scraped from Tonaton', count: kpis.totalLeads, color: '#4F46E5', pct: 100 },
            { stage: 'WhatsApp Contacted', count: kpis.leadsContacted, color: '#7C3AED', pct: Math.round((kpis.leadsContacted / kpis.totalLeads) * 100) },
            { stage: 'Responded', count: Math.floor(kpis.leadsContacted * 0.42), color: '#0EA5E9', pct: Math.round((kpis.leadsContacted * 0.42 / kpis.totalLeads) * 100) },
            { stage: 'Vendor Registered', count: Math.floor(kpis.leadsContacted * 0.18), color: '#059669', pct: Math.round((kpis.leadsContacted * 0.18 / kpis.totalLeads) * 100) },
            { stage: 'First Listing Live', count: Math.floor(kpis.leadsContacted * 0.084), color: '#F59E0B', pct: Math.round((kpis.leadsContacted * 0.084 / kpis.totalLeads) * 100) },
          ].map((item, i) => (
            <div key={i} style={{ marginBottom: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>{item.stage}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                  {item.count} <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 400 }}>({item.pct}%)</span>
                </span>
              </div>
              <div className="liquid-bar" style={{ height: 6 }}>
                <div
                  className="liquid-bar-fill"
                  style={{ width: `${item.pct}%`, background: item.color }}
                />
              </div>
            </div>
          ))}
        </GlassSection>
      </div>
    </div>
  );
}
