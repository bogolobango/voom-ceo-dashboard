/**
 * Vendor CRM Section — Arctic Glass Design System
 * Pipeline funnel, outreach templates, and vendor contact table
 * Tracks conversion of 97 pre-loaded vendors through the sales pipeline
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import type { Vendor, DashboardKPIs } from '../../lib/voomApi';

interface VendorCRMProps {
  vendors: Vendor[];
  kpis: DashboardKPIs;
}

/* ── Pipeline stage config ── */
const PIPELINE_STAGES = [
  { key: 'not_contacted', label: 'Not Contacted', color: '#94A3B8' },
  { key: 'contacted', label: 'Contacted', color: '#0EA5E9' },
  { key: 'responded', label: 'Responded', color: '#7C3AED' },
  { key: 'claimed', label: 'Claimed', color: '#D97706' },
  { key: 'active', label: 'Active', color: '#059669' },
  { key: 'paid', label: 'Paid', color: '#4F46E5' },
] as const;

/* ── Outreach templates ── */
const OUTREACH_TEMPLATES = [
  {
    title: 'Initial Outreach',
    tag: 'WhatsApp',
    tagColor: '#059669',
    message: `Hi {VENDOR_NAME}! This is Jim from VOOM Parts — Ghana's new online marketplace for auto spare parts. We're helping vendors in Abossey Okai reach buyers across all 16 regions. Your shop has been pre-registered on voomparts.com. Claim your free listing, upload your parts, and start getting buyers from across Ghana. It takes 5 minutes. Interested?`,
  },
  {
    title: 'Follow-up (3 days)',
    tag: 'Day 3',
    tagColor: '#D97706',
    message: `Hi {VENDOR_NAME}, following up from my earlier message about VOOM Parts. We already have 97 vendors onboarded and buyers searching daily. Vendors who list their parts are getting WhatsApp inquiries from buyers across Ghana. Your competitors are listing — don't miss out! Would you like me to help you get started? It's completely free.`,
  },
  {
    title: 'Activation Nudge',
    tag: 'No Products',
    tagColor: '#7C3AED',
    message: `Hi {VENDOR_NAME}! I see you've claimed your VOOM account — great! But your shop has no products yet. Vendors who list within 48hrs get 3x more visibility. Even 5-10 listings will start bringing you buyer inquiries. Send me photos of 5 parts and I'll list them for you — free!`,
  },
  {
    title: 'Renewal Reminder',
    tag: 'Upgrade',
    tagColor: '#E11D48',
    message: `Hi {VENDOR_NAME}, your VOOM free tier gives you 10 listings. You've been getting great traction! Upgrade to Pro for GH₵49/mo — unlimited listings, featured placement, and priority support. Send your payment via Mobile Money and share the reference with me. Interested?`,
  },
];

/* ── Helpers ── */
function derivePipeline(vendors: Vendor[]) {
  const notContacted = vendors.filter(v => v.status === 'pending' && v.totalListings === 0).length;
  const contacted = vendors.filter(v => v.status === 'pending' && v.totalListings > 0).length;
  const responded = vendors.filter(v => v.status === 'rejected' || v.status === 'suspended').length;
  const approvedVendors = vendors.filter(v => v.status === 'approved');
  const claimed = approvedVendors.filter(v => v.totalListings === 0).length;
  const active = approvedVendors.filter(v => v.totalListings > 0 && v.tier === 'free').length;
  const paid = approvedVendors.filter(v => v.tier !== 'free').length;

  return { not_contacted: notContacted, contacted, responded, claimed, active, paid };
}

function formatGhanaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0')) return '233' + digits.slice(1);
  return '233' + digits;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  approved: { bg: 'rgba(5,150,105,0.1)', color: '#059669', label: 'Approved' },
  pending: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', label: 'Pending' },
  rejected: { bg: 'rgba(225,29,72,0.1)', color: '#E11D48', label: 'Rejected' },
  suspended: { bg: 'rgba(100,116,139,0.1)', color: '#64748B', label: 'Suspended' },
};

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
        {children}
      </h2>
      {sub && <p style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.125rem' }}>{sub}</p>}
    </div>
  );
}

function GlassSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="glass-card" style={{ padding: '1.125rem', ...style }}>{children}</div>;
}

export function VendorCRM({ vendors, kpis }: VendorCRMProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'businessName' | 'city' | 'status' | 'tier' | 'totalListings'>('businessName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const pipeline = useMemo(() => derivePipeline(vendors), [vendors]);
  const totalInPipeline = useMemo(() => Object.values(pipeline).reduce((s, v) => s + v, 0), [pipeline]);

  const sortedVendors = useMemo(() => {
    let list = [...vendors];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        v.businessName.toLowerCase().includes(q) ||
        (v.city || '').toLowerCase().includes(q) ||
        v.phone.includes(q)
      );
    }
    list.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortField) {
        case 'businessName': aVal = a.businessName.toLowerCase(); bVal = b.businessName.toLowerCase(); break;
        case 'city': aVal = (a.city || '').toLowerCase(); bVal = (b.city || '').toLowerCase(); break;
        case 'status': aVal = a.status; bVal = b.status; break;
        case 'tier': aVal = a.tier; bVal = b.tier; break;
        case 'totalListings': aVal = a.totalListings; bVal = b.totalListings; break;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [vendors, search, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const handleCopy = (idx: number) => {
    navigator.clipboard.writeText(OUTREACH_TEMPLATES[idx].message).then(() => {
      setCopiedIdx(idx);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Outreach CRM
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
            Vendor acquisition pipeline · {kpis.totalVendors} vendors loaded · 97 pre-loaded from Abossey Okai
          </p>
        </div>
      </div>

      {/* ── Pipeline Funnel ── */}
      <GlassSection>
        <SectionTitle sub="Derived from vendor status &amp; tier data · Not Contacted → Paid">Conversion Funnel</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {PIPELINE_STAGES.map((stage, i) => {
            const count = pipeline[stage.key as keyof typeof pipeline];
            const pct = totalInPipeline > 0 ? Math.round((count / totalInPipeline) * 100) : 0;
            const barWidth = totalInPipeline > 0 ? Math.max((count / totalInPipeline) * 100, 2) : 2;
            const conversionFromPrev = i === 0 ? 100 : (() => {
              const prevKey = PIPELINE_STAGES[i - 1].key as keyof typeof pipeline;
              const prevCount = pipeline[prevKey];
              return prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
            })();

            return (
              <div key={stage.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', background: stage.color, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '0.8125rem', color: '#0F172A', fontWeight: 600, fontFamily: 'Plus Jakarta Sans' }}>
                      {stage.label}
                    </span>
                    {i > 0 && (
                      <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>
                        ({conversionFromPrev}% conversion)
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: stage.color, fontFamily: 'Space Grotesk' }}>
                      {count}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 400 }}>
                      ({pct}%)
                    </span>
                  </div>
                </div>
                <div className="liquid-bar" style={{ height: 8 }}>
                  <div className="liquid-bar-fill" style={{ width: `${barWidth}%`, background: stage.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </GlassSection>

      {/* ── Outreach Templates ── */}
      <GlassSection>
        <SectionTitle sub="Tap to copy — paste into WhatsApp">Message Templates</SectionTitle>
        <div className="two-col-grid">
          {OUTREACH_TEMPLATES.map((tpl, idx) => (
            <div key={idx} className="glass-card" style={{
              padding: '0.875rem',
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans' }}>
                    {tpl.title}
                  </span>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 600, color: tpl.tagColor,
                    background: `${tpl.tagColor}18`, padding: '0.1rem 0.35rem', borderRadius: 999,
                  }}>
                    {tpl.tag}
                  </span>
                </div>
              </div>
              <p style={{
                fontSize: '0.75rem', color: '#64748B', lineHeight: 1.5, margin: 0,
                flex: 1,
              }}>
                {tpl.message}
              </p>
              <button
                onClick={() => handleCopy(idx)}
                style={{
                  alignSelf: 'flex-end',
                  padding: '0.375rem 0.875rem',
                  borderRadius: '0.625rem',
                  border: 'none',
                  background: copiedIdx === idx ? 'rgba(5,150,105,0.15)' : 'rgba(79,70,229,0.1)',
                  color: copiedIdx === idx ? '#059669' : '#4F46E5',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'Plus Jakarta Sans',
                }}
              >
                {copiedIdx === idx ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      </GlassSection>

      {/* ── Vendor Pipeline Table ── */}
      <GlassSection style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.125rem 1.125rem 0.75rem' }}>
          <SectionTitle sub={`${sortedVendors.length} of ${vendors.length} vendors`}>Vendor Pipeline</SectionTitle>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendors by name, phone, or city..."
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
        </div>

        {/* Desktop Table Header */}
        <div className="vendor-table-header" style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr 0.6fr 0.6fr',
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid rgba(79,70,229,0.06)',
          background: 'rgba(248,250,252,0.8)',
          gap: '0.25rem',
        }}>
          {[
            { label: 'Name', field: 'businessName' as const },
            { label: 'Phone', field: null },
            { label: 'City', field: 'city' as const },
            { label: 'Status', field: 'status' as const },
            { label: 'Tier', field: 'tier' as const },
            { label: 'Products', field: 'totalListings' as const },
            { label: 'Chat', field: null },
          ].map((h, i) => (
            <p
              key={i}
              onClick={() => h.field && handleSort(h.field)}
              style={{
                fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8',
                letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0,
                cursor: h.field ? 'pointer' : 'default',
                userSelect: 'none',
              }}
            >
              {h.label}
              {h.field && sortField === h.field && (
                <span style={{ marginLeft: '0.2rem' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
              )}
            </p>
          ))}
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {sortedVendors.map((vendor, i) => {
            const st = STATUS_STYLES[vendor.status] || STATUS_STYLES.pending;
            const waLink = `https://wa.me/${formatGhanaPhone(vendor.phone)}`;
            return (
              <div key={vendor.id} style={{
                borderBottom: i < sortedVendors.length - 1 ? '1px solid rgba(79,70,229,0.04)' : 'none',
              }}>
                {/* Mobile card layout */}
                <div className="vendor-mobile-card" style={{ padding: '0.75rem 1rem' }}>
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
                  <div style={{ display: 'flex', gap: '1rem', paddingLeft: '2.875rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{vendor.city || '—'}</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      Tier: <strong style={{ color: '#0F172A', fontFamily: 'Space Grotesk' }}>{vendor.tier}</strong>
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      Products: <strong style={{ color: '#0F172A', fontFamily: 'Space Grotesk' }}>{vendor.totalListings}</strong>
                    </span>
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.68rem', fontWeight: 600, color: 'white',
                        background: '#25D366', padding: '0.2rem 0.5rem',
                        borderRadius: 999, textDecoration: 'none',
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      }}
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>

                {/* Desktop table layout */}
                <div className="vendor-desktop-row" style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr 0.6fr 0.6fr',
                  alignItems: 'center',
                  padding: '0.75rem 1.25rem',
                  gap: '0.25rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '0.5rem', flexShrink: 0,
                      background: `hsl(${(vendor.id * 47) % 360}, 65%, 92%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 800,
                      color: `hsl(${(vendor.id * 47) % 360}, 55%, 40%)`,
                    }}>{vendor.businessName.charAt(0)}</div>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {vendor.businessName}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: '#475569', fontFamily: 'Space Grotesk' }}>{vendor.phone}</span>
                  <span style={{ fontSize: '0.8125rem', color: '#475569' }}>{vendor.city || '—'}</span>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 600, background: st.bg, color: st.color,
                    padding: '0.2rem 0.6rem', borderRadius: 999, textAlign: 'center',
                    justifySelf: 'start',
                  }}>{st.label}</span>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 600,
                    color: vendor.tier !== 'free' ? '#7C3AED' : '#64748B',
                    background: vendor.tier !== 'free' ? 'rgba(124,58,237,0.1)' : 'rgba(100,116,139,0.08)',
                    padding: '0.2rem 0.6rem', borderRadius: 999, textAlign: 'center',
                    justifySelf: 'start',
                  }}>{vendor.tier}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                    {vendor.totalListings}
                  </span>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: '0.5rem',
                      background: '#25D366', textDecoration: 'none',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </GlassSection>

      <p style={{ fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center' }}>
        Showing {sortedVendors.length} of {vendors.length} vendors · CRM pipeline derived from vendor status data
      </p>
    </div>
  );
}
