/**
 * Part Requests Section — Arctic Glass Design System
 * Real buyer demand pipeline from database
 * Mobile: card view · Desktop: table grid
 */

import { useState, useMemo } from 'react';
import { MetricCard } from '../MetricCard';
import type { DashboardKPIs, PartRequest } from '../../lib/voomApi';

interface PartRequestsProps {
  partRequests: PartRequest[];
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

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', label: 'Open' },
  fulfilled: { bg: 'rgba(5,150,105,0.1)', color: '#059669', label: 'Fulfilled' },
  closed: { bg: 'rgba(100,116,139,0.1)', color: '#64748B', label: 'Closed' },
};

export function PartRequests({ partRequests, kpis }: PartRequestsProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => partRequests.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch = !search ||
      r.partName.toLowerCase().includes(search.toLowerCase()) ||
      (r.make || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.model || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.guestName || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }), [partRequests, statusFilter, search]);

  const statusCounts = useMemo(() => ({
    all: partRequests.length,
    open: partRequests.filter(r => r.status === 'open').length,
    fulfilled: partRequests.filter(r => r.status === 'fulfilled').length,
    closed: partRequests.filter(r => r.status === 'closed').length,
  }), [partRequests]);

  // Top requested makes
  const topMakes = useMemo(() => {
    const dist: Record<string, number> = {};
    partRequests.forEach(r => {
      if (r.make) dist[r.make] = (dist[r.make] || 0) + 1;
    });
    return Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [partRequests]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Part Requests
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
          Buyer demand pipeline · {partRequests.length} total requests
        </p>
      </div>

      {/* KPI Row */}
      <div className="four-col-grid">
        <MetricCard label="Total Requests" value={kpis.totalPartRequests} variant="indigo" delay={0} subtitle="All time" />
        <MetricCard label="Open" value={kpis.openPartRequests} variant="amber" delay={1} subtitle="Awaiting fulfillment" />
        <MetricCard label="Fulfilled" value={kpis.fulfilledPartRequests} variant="emerald" delay={2}
          subtitle={kpis.totalPartRequests > 0 ? `${Math.round((kpis.fulfilledPartRequests / kpis.totalPartRequests) * 100)}% fill rate` : '0% fill rate'} />
        <MetricCard label="Closed" value={statusCounts.closed} variant="default" delay={3} subtitle="No longer needed" />
      </div>

      {/* Top Requested Makes */}
      {topMakes.length > 0 && (
        <GlassSection>
          <SectionTitle sub="Most requested vehicle makes">Demand Signals</SectionTitle>
          <div className="five-col-grid">
            {topMakes.map(([make, count], i) => {
              const colors = ['#4F46E5', '#059669', '#D97706', '#7C3AED', '#0EA5E9'];
              return (
                <div key={make} style={{
                  padding: '0.875rem',
                  borderRadius: '0.875rem',
                  background: `${colors[i]}08`,
                  border: `1px solid ${colors[i]}20`,
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: '1.25rem', fontWeight: 800, color: colors[i], fontFamily: 'Space Grotesk', margin: 0 }}>
                    {count}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem', fontWeight: 500 }}>{make}</p>
                </div>
              );
            })}
          </div>
        </GlassSection>
      )}

      {/* Status Filter */}
      <div className="glass-card" style={{ padding: '0.375rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
        {(['all', 'open', 'fulfilled', 'closed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              flex: 1, minWidth: 60, padding: '0.5rem', borderRadius: '0.625rem', border: 'none',
              background: statusFilter === s ? '#4F46E5' : 'transparent',
              color: statusFilter === s ? 'white' : '#64748B',
              fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
              transition: 'all 0.15s ease', fontFamily: 'Plus Jakarta Sans',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} ({statusCounts[s as keyof typeof statusCounts] ?? 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by part name, make, model, or requester..."
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

      {/* Requests Table */}
      <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Desktop header */}
        <div className="table-header-row" style={{
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.8fr',
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid rgba(79,70,229,0.06)',
          background: 'rgba(248,250,252,0.8)',
        }}>
          {['Part Name', 'Vehicle', 'Requester', 'Phone', 'Budget', 'Status'].map(h => (
            <p key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
              {h}
            </p>
          ))}
        </div>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {filtered.map((req, i) => {
            const st = STATUS_STYLES[req.status] || STATUS_STYLES.open;
            const vehicle = [req.make, req.model, req.year].filter(Boolean).join(' ') || '—';
            return (
              <div key={req.id}>
                {/* Mobile card */}
                <div className="table-mobile-card" style={{
                  padding: '0.875rem 1rem',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(79,70,229,0.04)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>
                        {req.partName}
                      </span>
                      <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0.125rem 0 0' }}>
                        {vehicle}
                      </p>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, background: st.bg, color: st.color, padding: '0.2rem 0.5rem', borderRadius: 999, flexShrink: 0, marginLeft: '0.5rem' }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      {req.guestName || '—'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
                      {req.budget || '—'}
                    </span>
                  </div>
                </div>

                {/* Desktop row */}
                <div
                  className="table-desktop-row"
                  style={{
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.8fr',
                    padding: '0.875rem 1.25rem',
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(79,70,229,0.04)' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(79,70,229,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center' }}>
                    {req.partName}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center' }}>
                    {vehicle}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#0F172A', display: 'flex', alignItems: 'center' }}>
                    {req.guestName || '—'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#475569', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center' }}>
                    {req.contactPhone}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center' }}>
                    {req.budget || '—'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, background: st.bg, color: st.color, padding: '0.2rem 0.5rem', borderRadius: 999 }}>
                      {st.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
