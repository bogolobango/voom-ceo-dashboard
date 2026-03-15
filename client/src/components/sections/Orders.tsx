/**
 * Orders Section — Arctic Glass Design System
 * Full order table with status, buyer, amount, and city breakdown
 */

import { useState, useMemo } from 'react';
import type { Order, DashboardKPIs } from '../../lib/voomApi';
import { MetricCard } from '../MetricCard';

interface OrdersProps {
  orders: Order[];
  kpis: DashboardKPIs;
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  delivered: { bg: 'rgba(5,150,105,0.1)', color: '#059669' },
  shipped: { bg: 'rgba(79,70,229,0.1)', color: '#4F46E5' },
  processing: { bg: 'rgba(124,58,237,0.1)', color: '#7C3AED' },
  confirmed: { bg: 'rgba(14,165,233,0.1)', color: '#0EA5E9' },
  pending: { bg: 'rgba(245,158,11,0.1)', color: '#F59E0B' },
  cancelled: { bg: 'rgba(239,68,68,0.1)', color: '#EF4444' },
};

export function Orders({ orders, kpis }: OrdersProps) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => orders.filter(o => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchSearch = !search ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (o.buyerName || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }), [orders, statusFilter, search]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filtered]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return counts;
  }, [orders]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Orders
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
          {orders.length} total orders · All amounts in GH₵
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <MetricCard label="Total Orders" value={kpis.totalOrders} trend={kpis.orderGrowth} variant="indigo" delay={0} />
        <MetricCard label="Delivered" value={kpis.completedOrders} variant="emerald" delay={1} />
        <MetricCard label="Completion Rate" value={kpis.orderCompletionRate} format="percent" variant="emerald" delay={2} />
        <MetricCard label="Avg Order Value" value={kpis.avgOrderValue} format="cedis" variant="indigo" delay={3} />
      </div>

      {/* Status Filter */}
      <div className="glass-card" style={{ padding: '0.375rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
        {['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: 'none',
              background: statusFilter === s ? '#4F46E5' : 'transparent',
              color: statusFilter === s ? 'white' : '#64748B',
              fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
              transition: 'all 0.15s ease', fontFamily: 'Plus Jakarta Sans',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} ({statusCounts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by order number or buyer name..."
          style={{
            width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem',
            borderRadius: '0.875rem', border: '1px solid rgba(79,70,229,0.12)',
            background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)',
            fontSize: '0.875rem', color: '#0F172A', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <svg style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>

      {/* Orders Table */}
      <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr',
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid rgba(79,70,229,0.06)',
          background: 'rgba(248,250,252,0.8)',
        }}>
          {['Order #', 'Buyer', 'City', 'Amount', 'Status'].map(h => (
            <p key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
              {h}
            </p>
          ))}
        </div>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {sorted.map((order, i) => {
            const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
            return (
              <div
                key={order.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr',
                  padding: '0.875rem 1.25rem',
                  borderBottom: i < sorted.length - 1 ? '1px solid rgba(79,70,229,0.04)' : 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(79,70,229,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center' }}>
                  {order.orderNumber}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#0F172A', display: 'flex', alignItems: 'center' }}>
                  {order.buyerName || 'Anonymous'}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center' }}>
                  {order.shippingCity || '—'}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center' }}>
                  GH₵ {parseFloat(order.totalAmount).toFixed(0)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, background: st.bg, color: st.color, padding: '0.2rem 0.6rem', borderRadius: 999 }}>
                    {order.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
