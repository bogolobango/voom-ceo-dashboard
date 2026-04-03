/**
 * Reports Section — Vendor Value Reports + Investor Snapshot
 * Arctic Glass Design System
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchVendors, fetchStats, fetchOrders, fetchVendorAnalytics, fetchBriefing, type Vendor, type AdminStats, type Order, type VendorAnalytics } from '../../lib/voomApi';
import { toast } from 'sonner';

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

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
}

// ─── Vendor Value Report ───

function VendorValueReport({ vendors }: { vendors: Vendor[] }) {
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const activeVendors = useMemo(() => vendors.filter(v => v.status === 'approved' && v.totalListings > 0), [vendors]);

  const selectedVendor = useMemo(() => vendors.find(v => v.id === selectedVendorId), [vendors, selectedVendorId]);

  // Fetch real analytics for selected vendor
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['vendor-analytics', selectedVendorId],
    queryFn: () => selectedVendorId ? fetchVendorAnalytics(selectedVendorId) : Promise.resolve(null),
    enabled: !!selectedVendorId,
  });

  const generateReport = (vendor: Vendor, data: VendorAnalytics | null): string => {
    const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const views = data?.views ?? 0;
    const waTaps = data?.whatsappTaps ?? 0;
    const topProduct = data?.topProduct;
    const topSearches = data?.topSearches ?? [];
    const restockTip = data?.restockTip;

    const hasActivity = views > 0 || waTaps > 0;

    let report = `📊 VOOM Monthly Report for ${vendor.businessName}\nPeriod: ${month}\n\n`;

    if (hasActivity) {
      report += `Your shop was viewed ${views} time${views !== 1 ? 's' : ''}\n`;
      report += `Buyers tapped WhatsApp ${waTaps} time${waTaps !== 1 ? 's' : ''}\n`;
      if (topProduct) {
        report += `Your top product: ${topProduct.name} (${topProduct.views} views)\n`;
      }
    } else {
      report += `Your report is warming up! We need 7+ days of buyer data to show detailed analytics.\n`;
      report += `Make sure your products are listed at voomparts.com/vendor\n`;
    }

    if (topSearches.length > 0) {
      report += `\nTop searches in your categories:\n`;
      topSearches.forEach((s, i) => {
        report += `${i + 1}. ${s.query} — ${s.count} searches\n`;
      });
    }

    if (restockTip) {
      report += `\n💡 Restock tip: "${restockTip.query}" was searched ${restockTip.count} time${restockTip.count !== 1 ? 's' : ''} with no results. Stock this to capture demand.\n`;
    }

    report += `\n${vendor.tier !== 'free' ? `Your ${vendor.tier} subscription is active.` : 'Upgrade to Pro for full analytics + priority search → voomparts.com/vendor/upgrade'}`;
    report += `\n\n— VOOM Parts | voomparts.com`;

    return report;
  };

  const report = selectedVendor ? generateReport(selectedVendor, analytics ?? null) : '';
  const waLink = selectedVendor
    ? `https://wa.me/${selectedVendor.whatsapp || selectedVendor.phone}?text=${encodeURIComponent(report)}`
    : '';

  return (
    <GlassSection>
      <SectionTitle sub="Generate WhatsApp-shareable performance reports for vendors">
        Vendor Value Report
      </SectionTitle>

      <select
        value={selectedVendorId ?? ''}
        onChange={e => setSelectedVendorId(e.target.value ? parseInt(e.target.value) : null)}
        style={{
          width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
          border: '1px solid rgba(79,70,229,0.12)', fontSize: '0.8125rem',
          marginBottom: '0.75rem', boxSizing: 'border-box', outline: 'none',
          color: '#475569', background: 'white',
        }}
      >
        <option value="">Select a vendor...</option>
        {activeVendors.map(v => (
          <option key={v.id} value={v.id}>{v.businessName} — {v.city || 'Ghana'}</option>
        ))}
        {activeVendors.length === 0 && vendors.length > 0 && vendors.slice(0, 20).map(v => (
          <option key={v.id} value={v.id}>{v.businessName} — {v.city || 'Ghana'}</option>
        ))}
      </select>

      {selectedVendor && analyticsLoading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: '0.8125rem' }}>
          Loading analytics for {selectedVendor.businessName}...
        </div>
      )}

      {selectedVendor && !analyticsLoading && (
        <>
          <div style={{
            background: '#DCF8C6', borderRadius: '0.75rem', padding: '1rem',
            fontSize: '0.8125rem', color: '#0F172A', lineHeight: 1.5,
            whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto',
            marginBottom: '0.75rem', fontFamily: 'inherit',
          }}>
            {report}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => copyToClipboard(report)}
              style={{
                padding: '0.4rem 1rem', borderRadius: '0.5rem', border: 'none',
                background: '#4F46E5', color: 'white', fontSize: '0.8125rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Plus Jakarta Sans',
              }}
            >
              Copy to Clipboard
            </button>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '0.4rem 1rem', borderRadius: '0.5rem', border: 'none',
                background: '#25D366', color: 'white', fontSize: '0.8125rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Plus Jakarta Sans', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              Send via WhatsApp
            </a>
          </div>
        </>
      )}

      {!selectedVendor && (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94A3B8', fontSize: '0.8125rem' }}>
          Select a vendor to generate their monthly value report.
          Reports work best after 7+ days of buyer activity data.
        </div>
      )}
    </GlassSection>
  );
}

// ─── Investor Snapshot ───

function InvestorSnapshot({ stats, vendors, orders }: { stats: AdminStats | null; vendors: Vendor[]; orders: Order[] }) {
  const [highlights, setHighlights] = useState('');
  const [nextThirtyDays, setNextThirtyDays] = useState('');
  const [cashUsd, setCashUsd] = useState('');
  const [burnRate, setBurnRate] = useState('');

  const { data: briefingData } = useQuery({ queryKey: ['briefing'], queryFn: fetchBriefing });

  const vendorsWithProducts = useMemo(() => vendors.filter(v => v.totalListings > 0).length, [vendors]);
  const totalGMV = useMemo(() => orders.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'delivered').length, [orders]);
  const mrr = briefingData?.mrr ?? 0;
  const runway = cashUsd && burnRate ? Math.round(parseFloat(cashUsd) / parseFloat(burnRate)) : null;

  const now = new Date();
  const month = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const topSearches = briefingData?.topSearches ?? [];
  const zeroResultSearches = briefingData?.zeroResultSearches ?? [];

  const generateSnapshot = (): string => {
    return `VOOM Ghana — Investor Update ${month}

KEY METRICS
Vendors registered: ${stats?.totalVendors ?? 0}
Vendors with products: ${vendorsWithProducts}
Total SKUs: ${stats?.totalProducts ?? 0}
Buyer searches (today): ${briefingData?.todaySearches ?? 'tracking pending'}
WhatsApp inquiries (today): ${briefingData?.todayWhatsappTaps ?? 'tracking pending'}
Note: Full traffic data available in Google Analytics (GA4 property)
Completed transactions: ${completedOrders}
GMV: GH₵ ${totalGMV.toLocaleString('en-GH', { minimumFractionDigits: 2 })}
MRR: GH₵ ${mrr.toLocaleString()}${mrr === 0 ? ' (pre-revenue)' : ''}
Cash: $${cashUsd || '[ENTER ABOVE]'} USD | Runway: ${runway ? `${runway} months` : '[ENTER ABOVE]'}

TOP DEMAND (what buyers search for)
${topSearches.length > 0 ? topSearches.slice(0, 3).map((s, i) => `${i + 1}. ${s.query} — ${s.count} searches`).join('\n') : '(Tracking pending — need marketplace tracker integration)'}

SUPPLY GAPS (zero-result searches)
${zeroResultSearches.length > 0 ? zeroResultSearches.slice(0, 3).map((s, i) => `${i + 1}. "${s.query}" — ${s.count} searches, 0 vendors`).join('\n') : '(No zero-result searches detected yet)'}

HIGHLIGHTS
${highlights || '[Add highlights before exporting]'}

NEXT 30 DAYS
${nextThirtyDays || '[Add plans before exporting]'}

EXPANSION
PawaPay status: Not started
Markets accessible: 20 countries, $23.2B TAM
Africa auto aftermarket growing 7.1% CAGR to $37.6B by 2032

---
Generated from VOOM CEO Dashboard · ${now.toLocaleDateString('en-GB')}`;
  };

  const snapshot = generateSnapshot();

  return (
    <GlassSection>
      <SectionTitle sub="One-click export for monthly investor emails">
        Investor Snapshot
      </SectionTitle>

      {/* Cash & Runway inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.25rem' }}>
            Cash in bank (USD)
          </label>
          <input
            value={cashUsd}
            onChange={e => setCashUsd(e.target.value)}
            placeholder="e.g. 25000"
            type="number"
            style={{
              width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
              border: '1px solid rgba(79,70,229,0.12)', fontSize: '0.8125rem',
              boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.25rem' }}>
            Monthly burn rate (USD)
          </label>
          <input
            value={burnRate}
            onChange={e => setBurnRate(e.target.value)}
            placeholder="e.g. 3000"
            type="number"
            style={{
              width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
              border: '1px solid rgba(79,70,229,0.12)', fontSize: '0.8125rem',
              boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>
      </div>
      {runway !== null && (
        <div style={{
          marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
          background: runway > 6 ? 'rgba(5,150,105,0.06)' : runway > 3 ? 'rgba(217,119,6,0.06)' : 'rgba(225,29,72,0.06)',
          border: `1px solid ${runway > 6 ? 'rgba(5,150,105,0.12)' : runway > 3 ? 'rgba(217,119,6,0.12)' : 'rgba(225,29,72,0.12)'}`,
        }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: runway > 6 ? '#059669' : runway > 3 ? '#D97706' : '#E11D48' }}>
            Runway: {runway} months
          </span>
          <span style={{ fontSize: '0.72rem', color: '#64748B', marginLeft: '0.5rem' }}>
            (${cashUsd} / ${burnRate} per month)
          </span>
        </div>
      )}

      {/* Editable fields */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.25rem' }}>
          HIGHLIGHTS (what happened this month)
        </label>
        <textarea
          value={highlights}
          onChange={e => setHighlights(e.target.value)}
          placeholder="e.g., Signed first vendor, launched WhatsApp bot, completed 242-vendor pipeline..."
          rows={3}
          style={{
            width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
            border: '1px solid rgba(79,70,229,0.12)', fontSize: '0.8125rem',
            boxSizing: 'border-box', resize: 'vertical', outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.25rem' }}>
          NEXT 30 DAYS (plans)
        </label>
        <textarea
          value={nextThirtyDays}
          onChange={e => setNextThirtyDays(e.target.value)}
          placeholder="e.g., Activate 10 vendors, launch PawaPay sandbox, hit 500 SKUs..."
          rows={2}
          style={{
            width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
            border: '1px solid rgba(79,70,229,0.12)', fontSize: '0.8125rem',
            boxSizing: 'border-box', resize: 'vertical', outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Preview */}
      <div style={{
        background: 'rgba(248,250,252,0.8)', borderRadius: '0.75rem', padding: '1rem',
        fontSize: '0.78rem', color: '#0F172A', lineHeight: 1.6,
        whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto',
        marginBottom: '0.75rem', fontFamily: 'Space Grotesk, monospace',
        border: '1px solid rgba(79,70,229,0.06)',
      }}>
        {snapshot}
      </div>

      <button
        onClick={() => copyToClipboard(snapshot)}
        style={{
          padding: '0.5rem 1.25rem', borderRadius: '0.625rem', border: 'none',
          background: '#4F46E5', color: 'white', fontSize: '0.8125rem', fontWeight: 700,
          cursor: 'pointer', fontFamily: 'Plus Jakarta Sans',
        }}
      >
        Copy Investor Update
      </button>
    </GlassSection>
  );
}

// ─── Main Reports Section ───

export function Reports() {
  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: fetchVendors });
  const { data: stats = null } = useQuery({ queryKey: ['stats'], queryFn: fetchStats });
  const { data: orders = [] } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders });

  const [reportTab, setReportTab] = useState<'vendor' | 'investor'>('vendor');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Reports
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
          Generate vendor value reports and investor snapshots
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: '0.5rem',
        background: 'rgba(79,70,229,0.06)', borderRadius: '0.875rem',
        padding: '0.25rem', width: 'fit-content',
      }}>
        {([
          { id: 'vendor' as const, label: 'Vendor Value Report' },
          { id: 'investor' as const, label: 'Investor Snapshot' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setReportTab(tab.id)}
            style={{
              padding: '0.4rem 1rem', borderRadius: '0.625rem', border: 'none',
              cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              background: reportTab === tab.id ? '#4F46E5' : 'transparent',
              color: reportTab === tab.id ? 'white' : '#64748B',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {reportTab === 'vendor' && <VendorValueReport vendors={vendors} />}
      {reportTab === 'investor' && <InvestorSnapshot stats={stats} vendors={vendors} orders={orders} />}
    </div>
  );
}
