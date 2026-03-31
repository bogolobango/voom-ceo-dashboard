/**
 * Vendors Section — Arctic Glass Design System
 * Full vendor table with Claim My Page workflow integration:
 *   - Unclaimed   : vendor.userId === null → show WhatsApp invite
 *   - Claim Request: vendor.userId !== null && status === 'pending' → inline approve/reject
 *   - Active      : status === 'approved'
 *   - Rejected    : status === 'rejected'
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Vendor } from '../../lib/voomApi';
import {
  fetchOutreachInvites,
  sendOutreachInvite,
  reviewVendorDocs,
  generateClaimLink,
} from '../../lib/voomApi';
import { VendorDetailDrawer } from '../VendorDetailDrawer';
import { InviteVendorModal, type VendorPrefill } from '../InviteVendorModal';

function hasValidToken(v: Vendor): boolean {
  return !!(
    v.claimToken &&
    v.claimStatus === 'unclaimed' &&
    v.claimTokenExpiresAt &&
    new Date(v.claimTokenExpiresAt) > new Date()
  );
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
    background: '#0F172A', color: 'white', padding: '0.625rem 1.25rem',
    borderRadius: '0.75rem', fontSize: '0.8125rem', fontWeight: 600,
    fontFamily: 'Plus Jakarta Sans', zIndex: '9999',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    transition: 'opacity 0.3s ease',
  });
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2200);
}

interface VendorsProps {
  vendors: Vendor[];
  onRefresh?: () => void;
}

type FilterKey = 'all' | 'claim_requests' | 'approved' | 'rejected' | 'unclaimed';

function isClaimed(v: Vendor) { return v.userId !== null && v.userId !== 0; }
function isUnclaimed(v: Vendor) { return !isClaimed(v); }
function isClaimRequest(v: Vendor) { return isClaimed(v) && v.status === 'pending'; }

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  approved:  { bg: 'rgba(5,150,105,0.1)',   color: '#059669', label: 'Active' },
  pending:   { bg: 'rgba(217,119,6,0.1)',   color: '#D97706', label: 'Pending' },
  rejected:  { bg: 'rgba(225,29,72,0.1)',   color: '#E11D48', label: 'Rejected' },
  suspended: { bg: 'rgba(100,116,139,0.1)', color: '#64748B', label: 'Suspended' },
};

export function Vendors({ vendors, onRefresh }: VendorsProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter]               = useState<FilterKey>('all');
  const [search, setSearch]               = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [inviteOpen, setInviteOpen]       = useState(false);
  const [prefillVendor, setPrefillVendor] = useState<VendorPrefill | undefined>(undefined);
  const [invitedMap, setInvitedMap]       = useState<Map<number, string>>(new Map());
  const [invitingId, setInvitingId]       = useState<number | null>(null);
  const [reviewedIds, setReviewedIds]     = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchOutreachInvites()
      .then(rows => setInvitedMap(new Map(rows.map(r => [r.vendorId, r.invitedAt]))))
      .catch(() => {});
  }, []);

  const reviewMutation = useMutation({
    mutationFn: ({ vendorId, approved }: { vendorId: number; approved: boolean }) =>
      reviewVendorDocs(vendorId, approved),
    onSuccess: (_, { vendorId }) => {
      setReviewedIds(prev => new Set([...prev, vendorId]));
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      onRefresh?.();
    },
  });

  const generateClaimMutation = useMutation({
    mutationFn: (vendorId: number) => generateClaimLink(vendorId),
    onSuccess: async (data, vendorId) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      onRefresh?.();
      try {
        const { whatsappUrl } = await sendOutreachInvite(vendorId);
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      } catch { /* silent */ }
    },
  });

  const handleInvite = useCallback((e: React.MouseEvent, vendor: Vendor) => {
    e.stopPropagation();
    setPrefillVendor({
      vendorId: vendor.id,
      businessName: vendor.businessName,
      phone: (vendor as any).whatsapp || vendor.phone,
      city: vendor.city,
    });
    setInviteOpen(true);
  }, []);

  const counts = useMemo(() => ({
    all:            vendors.length,
    claim_requests: vendors.filter(isClaimRequest).length,
    approved:       vendors.filter(v => v.status === 'approved').length,
    rejected:       vendors.filter(v => v.status === 'rejected').length,
    unclaimed:      vendors.filter(isUnclaimed).length,
  }), [vendors]);

  const filtered = useMemo(() => vendors.filter(v => {
    const q = search.toLowerCase().replace(/[\s\-\(\)+]/g, '');
    const matchSearch = !search ||
      v.businessName.toLowerCase().includes(search.toLowerCase()) ||
      (v.city || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.phone || '').replace(/[\s\-\(\)+]/g, '').includes(q) ||
      (v.whatsapp || '').replace(/[\s\-\(\)+]/g, '').includes(q);
    if (!matchSearch) return false;
    switch (filter) {
      case 'claim_requests': return isClaimRequest(v);
      case 'approved':       return v.status === 'approved';
      case 'rejected':       return v.status === 'rejected';
      case 'unclaimed':      return isUnclaimed(v);
      default:               return true;
    }
  }), [vendors, filter, search]);

  const TABS: { key: FilterKey; label: string; accent?: string }[] = [
    { key: 'all',            label: 'All' },
    { key: 'claim_requests', label: 'Claim Requests', accent: '#D97706' },
    { key: 'approved',       label: 'Active' },
    { key: 'rejected',       label: 'Rejected' },
    { key: 'unclaimed',      label: 'Unclaimed' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Vendor Pipeline
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
            {counts.approved} active · {counts.claim_requests} pending review · {counts.unclaimed} unclaimed
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          style={{
            padding: '0.5rem 1rem', borderRadius: '0.75rem',
            background: 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)',
            color: 'white', fontSize: '0.8125rem', fontWeight: 700,
            cursor: 'pointer', border: 'none', fontFamily: 'Plus Jakarta Sans',
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            boxShadow: '0 2px 8px rgba(79,70,229,0.25)', whiteSpace: 'nowrap',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Invite Vendor
        </button>
      </div>

      {/* Claim Request Alert Banner */}
      {counts.claim_requests > 0 && (
        <div
          onClick={() => setFilter('claim_requests')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.875rem',
            background: 'linear-gradient(135deg, rgba(217,119,6,0.08) 0%, rgba(245,158,11,0.06) 100%)',
            border: '1px solid rgba(217,119,6,0.25)',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '0.625rem', flexShrink: 0,
            background: 'rgba(217,119,6,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
              <path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9S3 16.97 3 12 7.03 3 12 3s9 4.03 9 9z"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400E', margin: 0 }}>
              {counts.claim_requests} vendor{counts.claim_requests !== 1 ? 's have' : ' has'} claimed {counts.claim_requests !== 1 ? 'their pages' : 'their page'} — pending your review
            </p>
            <p style={{ fontSize: '0.75rem', color: '#B45309', marginTop: '0.125rem' }}>
              Tap to review claim requests and approve or reject
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="glass-card" style={{ padding: '0.375rem', display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
        {TABS.map(tab => {
          const count = counts[tab.key];
          const isActive = filter === tab.key;
          const accent = tab.accent || '#4F46E5';
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                flex: '1 0 auto', padding: '0.5rem 0.625rem',
                borderRadius: '0.625rem', border: 'none',
                background: isActive ? (tab.key === 'claim_requests' ? '#D97706' : '#4F46E5') : 'transparent',
                color: isActive ? 'white' : tab.accent || '#64748B',
                fontWeight: 600, fontSize: '0.78rem',
                cursor: 'pointer', transition: 'all 0.15s ease',
                fontFamily: 'Plus Jakarta Sans', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                justifyContent: 'center',
              }}
            >
              {tab.label}
              <span style={{
                minWidth: 18, height: 18, borderRadius: 999, fontSize: '0.65rem', fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? 'rgba(255,255,255,0.25)' : (tab.key === 'claim_requests' && count > 0 ? 'rgba(217,119,6,0.15)' : 'rgba(100,116,139,0.1)'),
                color: isActive ? 'white' : (tab.key === 'claim_requests' && count > 0 ? accent : '#64748B'),
                padding: '0 4px',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, city or phone number..."
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

      {/* Vendor List */}
      <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Desktop Table Header */}
        <div className="vendor-table-header" style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 0.75fr 0.75fr 1.1fr',
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid rgba(79,70,229,0.06)',
          background: 'rgba(248,250,252,0.8)',
        }}>
          {['Business', 'City', 'Status', 'Sales', 'Rating', 'Action'].map(h => (
            <p key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
              {h}
            </p>
          ))}
        </div>

        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: '#94A3B8' }}>No vendors match this filter.</p>
            </div>
          )}
          {filtered.map((vendor, i) => {
            const claimRequest = isClaimRequest(vendor);
            const unclaimed    = isUnclaimed(vendor);
            const reviewed     = reviewedIds.has(vendor.id);
            const invitedAt    = invitedMap.get(vendor.id);
            const st           = STATUS_STYLES[vendor.status] || STATUS_STYLES.pending;
            const isReviewing  = reviewMutation.isPending && !reviewed;

            return (
              <div
                key={vendor.id}
                className="vendor-row"
                onClick={() => { setSelectedVendorId(vendor.id); setDrawerOpen(true); }}
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(79,70,229,0.04)' : 'none',
                  cursor: 'pointer',
                  background: claimRequest && !reviewed ? 'rgba(217,119,6,0.03)' : undefined,
                  borderLeft: claimRequest && !reviewed ? '3px solid #D97706' : '3px solid transparent',
                }}
              >
                {/* ── Mobile Card ── */}
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
                    {claimRequest && !reviewed ? (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'rgba(217,119,6,0.12)', color: '#D97706', padding: '0.15rem 0.5rem', borderRadius: 999, flexShrink: 0 }}>
                        Claimed ·Review
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, background: st.bg, color: st.color, padding: '0.15rem 0.5rem', borderRadius: 999, flexShrink: 0 }}>
                        {st.label}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.625rem', paddingLeft: '2.875rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{vendor.city || '—'}</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      Sales: <strong style={{ color: '#0F172A', fontFamily: 'Space Grotesk' }}>{vendor.totalSales || 0}</strong>
                    </span>
                    {vendor.rating && <span style={{ fontSize: '0.72rem', color: '#F59E0B' }}>★ {vendor.rating}</span>}

                    {/* Mobile action */}
                    {claimRequest && !reviewed ? (
                      <div style={{ display: 'flex', gap: '0.375rem' }} onClick={e => e.stopPropagation()}>
                        <button disabled={isReviewing} onClick={e => { e.stopPropagation(); reviewMutation.mutate({ vendorId: vendor.id, approved: true }); }}
                          style={{ fontSize: '0.65rem', fontWeight: 700, color: 'white', background: '#059669', border: 'none', padding: '0.2rem 0.625rem', borderRadius: 999, cursor: 'pointer' }}>
                          Approve
                        </button>
                        <button disabled={isReviewing} onClick={e => { e.stopPropagation(); reviewMutation.mutate({ vendorId: vendor.id, approved: false }); }}
                          style={{ fontSize: '0.65rem', fontWeight: 700, color: '#E11D48', background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.25)', padding: '0.2rem 0.625rem', borderRadius: 999, cursor: 'pointer' }}>
                          Reject
                        </button>
                      </div>
                    ) : unclaimed ? (
                      vendor.claimStatus === 'claimed' ? (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'rgba(5,150,105,0.1)', color: '#059669', padding: '0.15rem 0.5rem', borderRadius: 999 }}>Claimed ✓</span>
                      ) : hasValidToken(vendor) ? (
                        <div style={{ display: 'flex', gap: '0.375rem' }} onClick={e => e.stopPropagation()}>
                          <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`https://voomparts.com/claim/${vendor.claimToken}`); showToast('Claim link copied!'); }}
                            style={{ fontSize: '0.65rem', fontWeight: 700, color: '#4F46E5', background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)', padding: '0.15rem 0.5rem', borderRadius: 999, cursor: 'pointer' }}>
                            Copy
                          </button>
                          <button onClick={e => handleInvite(e, vendor)} disabled={invitingId === vendor.id}
                            style={{ fontSize: '0.65rem', fontWeight: 700, color: 'white', background: '#25D366', border: 'none', padding: '0.15rem 0.5rem', borderRadius: 999, cursor: 'pointer' }}>
                            WA
                          </button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); generateClaimMutation.mutate(vendor.id); }} disabled={generateClaimMutation.isPending}
                          style={{ fontSize: '0.65rem', fontWeight: 700, color: 'white', background: '#4F46E5', border: 'none', padding: '0.15rem 0.5rem', borderRadius: 999, cursor: 'pointer' }}>
                          {generateClaimMutation.isPending ? '…' : 'Send Link'}
                        </button>
                      )
                    ) : reviewed ? (
                      <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Reviewed ✓</span>
                    ) : null}
                  </div>
                </div>

                {/* ── Desktop Row ── */}
                <div className="vendor-desktop-row" style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 0.75fr 0.75fr 1.1fr',
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

                  {/* Status badge — highlight claim requests differently */}
                  {claimRequest && !reviewed ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(217,119,6,0.1)', color: '#D97706', padding: '0.2rem 0.6rem', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                      Claim Request
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, background: st.bg, color: st.color, padding: '0.2rem 0.6rem', borderRadius: 999 }}>
                      {unclaimed ? 'Unclaimed' : reviewed ? 'Reviewed' : st.label}
                    </span>
                  )}

                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                    {vendor.totalSales || 0}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {vendor.rating ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', fontFamily: 'Space Grotesk' }}>{vendor.rating}</span>
                      </>
                    ) : <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>—</span>}
                  </div>

                  {/* Action column — 3-case claim logic for unclaimed, approve/reject for claim requests */}
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                    {claimRequest && !reviewed ? (
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button disabled={isReviewing} onClick={() => reviewMutation.mutate({ vendorId: vendor.id, approved: true })}
                          style={{ padding: '0.3rem 0.625rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700, background: '#059669', color: 'white', border: 'none', cursor: isReviewing ? 'wait' : 'pointer', fontFamily: 'Plus Jakarta Sans' }}>
                          {isReviewing ? '…' : '✓ Approve'}
                        </button>
                        <button disabled={isReviewing} onClick={() => reviewMutation.mutate({ vendorId: vendor.id, approved: false })}
                          style={{ padding: '0.3rem 0.625rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(225,29,72,0.08)', color: '#E11D48', border: '1px solid rgba(225,29,72,0.2)', cursor: isReviewing ? 'wait' : 'pointer', fontFamily: 'Plus Jakarta Sans' }}>
                          ✕ Reject
                        </button>
                      </div>
                    ) : unclaimed ? (
                      vendor.claimStatus === 'claimed' ? (
                        /* Case C — already claimed */
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(5,150,105,0.1)', color: '#059669', padding: '0.25rem 0.625rem', borderRadius: '0.5rem' }}>
                          Claimed ✓
                        </span>
                      ) : hasValidToken(vendor) ? (
                        /* Case A — valid token exists */
                        <>
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <button
                              title="Copy claim link to clipboard"
                              onClick={() => { navigator.clipboard.writeText(`https://voomparts.com/claim/${vendor.claimToken}`); showToast('Claim link copied!'); }}
                              style={{ padding: '0.3rem 0.625rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(79,70,229,0.08)', color: '#4F46E5', border: '1px solid rgba(79,70,229,0.2)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                              Copy Link
                            </button>
                            <button
                              title="Send via WhatsApp"
                              onClick={e => handleInvite(e, vendor)}
                              disabled={invitingId === vendor.id}
                              style={{ padding: '0.3rem 0.625rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700, background: '#25D366', color: 'white', border: 'none', cursor: invitingId === vendor.id ? 'wait' : 'pointer', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              WhatsApp
                            </button>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: '#94A3B8', paddingLeft: '0.125rem' }}>
                            Expires {vendor.claimTokenExpiresAt ? formatExpiry(vendor.claimTokenExpiresAt) : '—'}
                          </span>
                        </>
                      ) : (
                        /* Case B — no token or expired */
                        <button
                          onClick={() => generateClaimMutation.mutate(vendor.id)}
                          disabled={generateClaimMutation.isPending}
                          title="Generate a secure claim link and open WhatsApp"
                          style={{ padding: '0.3rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700, background: 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)', color: 'white', border: 'none', cursor: generateClaimMutation.isPending ? 'wait' : 'pointer', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                          {generateClaimMutation.isPending ? 'Generating…' : 'Send Claim Link'}
                        </button>
                      )
                    ) : reviewed ? (
                      <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Reviewed ✓</span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                        {vendor.totalListings > 0 ? `${vendor.totalListings} listings` : 'No listings'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center' }}>
        Showing {filtered.length} of {vendors.length} vendors
      </p>

      <VendorDetailDrawer
        vendorId={selectedVendorId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <InviteVendorModal
        open={inviteOpen}
        prefill={prefillVendor}
        onClose={() => { setInviteOpen(false); setPrefillVendor(undefined); }}
        onInvited={() => {
          if (prefillVendor) setInvitedMap(prev => new Map(prev).set(prefillVendor.vendorId, new Date().toISOString()));
          queryClient.invalidateQueries({ queryKey: ['vendors'] });
          onRefresh?.();
        }}
      />
    </div>
  );
}
