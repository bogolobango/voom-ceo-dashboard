/**
 * Vendors Section — Arctic Glass Design System
 * Full vendor table, pipeline status, and approval metrics
 */

import { useState, useMemo } from 'react';
import type { Vendor } from '../../lib/voomApi';

interface VendorsProps {
  vendors: Vendor[];
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  approved: { bg: 'rgba(5,150,105,0.1)', color: '#059669', label: 'Approved' },
  pending: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', label: 'Pending' },
  rejected: { bg: 'rgba(225,29,72,0.1)', color: '#E11D48', label: 'Rejected' },
  suspended: { bg: 'rgba(100,116,139,0.1)', color: '#64748B', label: 'Suspended' },
};

export function Vendors({ vendors }: VendorsProps) {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => vendors.filter(v => {
    const matchStatus = filter === 'all' || v.status === filter;
    const matchSearch = !search || v.businessName.toLowerCase().includes(search.toLowerCase()) ||
      (v.city || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }), [vendors, filter, search]);

  const counts = useMemo(() => ({
    all: vendors.length,
    approved: vendors.filter(v => v.status === 'approved').length,
    pending: vendors.filter(v => v.status === 'pending').length,
    rejected: vendors.filter(v => v.status === 'rejected').length,
  }), [vendors]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Vendor Pipeline
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
            {counts.approved} active · {counts.pending} awaiting approval
          </p>
        </div>
        <div style={{
          padding: '0.5rem 1rem',
          borderRadius: '0.75rem',
          background: 'rgba(79,70,229,0.1)',
          color: '#4F46E5',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          + Invite Vendor
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="glass-card" style={{ padding: '0.375rem', display: 'flex', gap: '0.25rem' }}>
        {(['all', 'approved', 'pending', 'rejected'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '0.625rem',
              border: 'none',
              background: filter === s ? '#4F46E5' : 'transparent',
              color: filter === s ? 'white' : '#64748B',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'Plus Jakarta Sans',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s as keyof typeof counts] ?? vendors.length})
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search vendors by name or city..."
          style={{
            width: '100%',
            padding: '0.75rem 1rem 0.75rem 2.5rem',
            borderRadius: '0.875rem',
            border: '1px solid rgba(79,70,229,0.12)',
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(8px)',
            fontSize: '0.875rem',
            color: '#0F172A',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <svg style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>

      {/* Vendor List — card style on mobile, table on desktop */}
      <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Desktop Table Header — hidden on mobile */}
        <div className="vendor-table-header" style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid rgba(79,70,229,0.06)',
          background: 'rgba(248,250,252,0.8)',
        }}>
          {['Business Name', 'City', 'Status', 'Sales', 'Rating'].map(h => (
            <p key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
              {h}
            </p>
          ))}
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {filtered.map((vendor, i) => {
            const st = STATUS_STYLES[vendor.status] || STATUS_STYLES.pending;
            return (
              <div
                key={vendor.id}
                className="vendor-row"
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(79,70,229,0.04)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {/* Mobile card layout */}
                <div className="vendor-mobile-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '0.625rem', flexShrink: 0,
                      background: `hsl(${(vendor.id * 47) % 360}, 65%, 92%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.875rem', fontWeight: 800,
                      color: `hsl(${(vendor.id * 47) % 360}, 55%, 40%)`,
                    }}>
                      {vendor.businessName.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {vendor.businessName}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: '#94A3B8', margin: 0 }}>{vendor.phone}</p>
                    </div>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 600,
                      background: st.bg, color: st.color,
                      padding: '0.15rem 0.5rem', borderRadius: 999, flexShrink: 0,
                    }}>{st.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', paddingLeft: '2.875rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{vendor.city || '—'}</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Sales: <strong style={{ color: '#0F172A', fontFamily: 'Space Grotesk' }}>{vendor.totalSales || 0}</strong></span>
                    {vendor.rating && <span style={{ fontSize: '0.72rem', color: '#F59E0B' }}>★ {vendor.rating}</span>}
                  </div>
                </div>

                {/* Desktop table layout */}
                <div className="vendor-desktop-row" style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '0.5rem', flexShrink: 0,
                      background: `hsl(${(vendor.id * 47) % 360}, 65%, 92%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 800,
                      color: `hsl(${(vendor.id * 47) % 360}, 55%, 40%)`,
                    }}>{vendor.businessName.charAt(0)}</div>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>{vendor.businessName}</p>
                      <p style={{ fontSize: '0.7rem', color: '#94A3B8', margin: 0 }}>{vendor.phone}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: '#475569' }}>{vendor.city || '—'}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, background: st.bg, color: st.color, padding: '0.2rem 0.6rem', borderRadius: 999 }}>{st.label}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>{vendor.totalSales || 0}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {vendor.rating ? (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', fontFamily: 'Space Grotesk' }}>{vendor.rating}</span></>
                    ) : <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>—</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center' }}>
        Showing {filtered.length} of {vendors.length} vendors · Connect VOOM backend for live data
      </p>
    </div>
  );
}
