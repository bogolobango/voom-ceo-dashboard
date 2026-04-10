/**
 * Competitive Intelligence Section — Arctic Glass Design System
 * Jiji pricing comparison, market data metrics, and competitor tracking
 */

import { useMemo } from 'react';
import type { Vendor, DashboardKPIs } from '../../lib/voomApi';

interface CompetitiveIntelProps {
  vendors: Vendor[];
  kpis: DashboardKPIs;
}

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

/* ── Jiji vs VOOM pricing data ── */
const JIJI_TIERS = [
  { jijiTier: 'Free', jijiPrice: 0, adLimit: '1 ad', voomTier: 'Free', voomPrice: 0, advantage: 'Same — both free to start' },
  { jijiTier: 'Basic', jijiPrice: 145, adLimit: '50 ads', voomTier: 'Starter', voomPrice: 100, advantage: '31% cheaper' },
  { jijiTier: 'Premium', jijiPrice: 265, adLimit: '200 ads', voomTier: 'Pro', voomPrice: 200, advantage: '25% cheaper' },
  { jijiTier: 'VIP', jijiPrice: 435, adLimit: '500 ads', voomTier: 'Business', voomPrice: 800, advantage: 'Dedicated support included' },
  { jijiTier: 'VIP Gold', jijiPrice: 570, adLimit: 'Unlimited', voomTier: 'Business', voomPrice: 800, advantage: 'Full-service marketplace' },
  { jijiTier: 'Diamond', jijiPrice: 945, adLimit: 'Unlimited', voomTier: 'Enterprise', voomPrice: 2000, advantage: 'Premium marketplace features' },
  { jijiTier: 'Enterprise', jijiPrice: 1670, adLimit: 'Unlimited', voomTier: 'Enterprise', voomPrice: 2000, advantage: 'Parts-focused ecosystem' },
];

/* ── Competitor notes ── */
const COMPETITORS = [
  { name: 'Jiji.com.gh (Auto Parts)', status: 'Active — dominant classifieds platform', risk: 'high' as const, lastChecked: 'Needs re-check' },
  { name: 'voomgh.com', status: 'Different company — car marketplace / rentals', risk: 'low' as const, lastChecked: 'Needs re-check' },
  { name: 'Finduy', status: 'Monitoring — similar auto parts space', risk: 'medium' as const, lastChecked: 'Needs re-check' },
  { name: 'Tonaton Ghana', status: 'Merged with Jiji — redirects to Jiji', risk: 'low' as const, lastChecked: 'Needs re-check' },
];

const RISK_STYLES = {
  high: { bg: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'rgba(239,68,68,0.15)' },
  medium: { bg: 'rgba(245,158,11,0.1)', color: '#D97706', border: 'rgba(245,158,11,0.15)' },
  low: { bg: 'rgba(5,150,105,0.1)', color: '#059669', border: 'rgba(5,150,105,0.15)' },
};

/** Estimated total vendor count in Abossey Okai market — unsourced estimate, needs primary research */
const ABOSSEY_OKAI_VENDOR_COUNT = 15_000;

export function CompetitiveIntel({ vendors, kpis }: CompetitiveIntelProps) {
  const activeVendors = useMemo(() => vendors.filter(v => v.status === 'approved').length, [vendors]);
  const marketPenetration = useMemo(() => ((activeVendors / ABOSSEY_OKAI_VENDOR_COUNT) * 100).toFixed(3), [activeVendors]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Header ── */}
      <div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Competitive Intelligence
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
          Market data, competitor pricing, and VOOM positioning
        </p>
      </div>

      {/* ── Market Data Metrics ── */}
      <div className="four-col-grid">
        {[
          { label: 'Ghana Vehicles', value: '~2.1M', sub: 'Estimate — needs verification', color: '#4F46E5' },
          { label: 'Abossey Okai', value: `~${ABOSSEY_OKAI_VENDOR_COUNT.toLocaleString()}`, sub: 'Estimate — needs field research', color: '#7C3AED' },
          { label: 'VOOM Active', value: String(activeVendors), sub: 'Approved vendors', color: '#059669' },
          { label: 'Penetration', value: `${marketPenetration}%`, sub: 'Estimate (denominator unverified)', color: '#D97706' },
        ].map(item => (
          <div key={item.label} className="glass-card" style={{ padding: '1rem', textAlign: 'center' }}>
            <p style={{
              fontSize: 'clamp(1.125rem, 4vw, 1.5rem)', fontWeight: 800, color: item.color,
              fontFamily: 'Space Grotesk', margin: 0, lineHeight: 1.1,
            }}>
              {item.value}
            </p>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', marginTop: '0.375rem', margin: '0.375rem 0 0' }}>
              {item.label}
            </p>
            <p style={{ fontSize: '0.72rem', color: '#94A3B8', margin: '0.125rem 0 0' }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Jiji Pricing Comparison ── */}
      <GlassSection>
        <SectionTitle sub="Jiji/Tonaton Ghana tiers vs VOOM tiers · GH₵/month · Last verified: needs update">Competitor Pricing</SectionTitle>

        {/* Mobile: card layout */}
        <div className="competitor-mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {JIJI_TIERS.map((row, i) => (
            <div key={i} className="glass-card" style={{
              padding: '0.875rem',
              background: row.voomPrice <= row.jijiPrice && row.jijiPrice > 0
                ? 'rgba(5,150,105,0.04)' : 'rgba(248,250,252,0.6)',
              border: row.voomPrice <= row.jijiPrice && row.jijiPrice > 0
                ? '1px solid rgba(5,150,105,0.12)' : '1px solid rgba(79,70,229,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>Jiji {row.jijiTier}</span>
                  <span style={{
                    fontSize: '0.875rem', fontWeight: 700, color: '#EF4444',
                    fontFamily: 'Space Grotesk', marginLeft: '0.5rem',
                  }}>
                    GH₵{row.jijiPrice}
                  </span>
                </div>
                <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>{row.adLimit}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#4F46E5' }}>VOOM {row.voomTier}</span>
                  <span style={{
                    fontSize: '0.875rem', fontWeight: 700, color: '#059669',
                    fontFamily: 'Space Grotesk', marginLeft: '0.5rem',
                  }}>
                    GH₵{row.voomPrice}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 600, color: '#059669',
                  background: 'rgba(5,150,105,0.1)', padding: '0.15rem 0.5rem', borderRadius: 999,
                }}>
                  {row.advantage}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table layout */}
        <div className="competitor-desktop-table" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(79,70,229,0.1)' }}>
                {['Jiji Tier', 'Price/mo', 'Ad Limit', 'VOOM Comparable', 'VOOM Price', 'Value Advantage'].map(h => (
                  <th key={h} style={{
                    padding: '0.625rem 0.5rem', textAlign: 'left',
                    fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {JIJI_TIERS.map((row, i) => (
                <tr key={i} style={{
                  borderBottom: '1px solid rgba(79,70,229,0.04)',
                  background: row.voomPrice <= row.jijiPrice && row.jijiPrice > 0
                    ? 'rgba(5,150,105,0.03)' : 'transparent',
                }}>
                  <td style={{ padding: '0.625rem 0.5rem', fontWeight: 600, color: '#0F172A' }}>{row.jijiTier}</td>
                  <td style={{ padding: '0.625rem 0.5rem', fontFamily: 'Space Grotesk', color: '#EF4444', fontWeight: 600 }}>
                    GH₵{row.jijiPrice}
                  </td>
                  <td style={{ padding: '0.625rem 0.5rem', color: '#64748B' }}>{row.adLimit}</td>
                  <td style={{ padding: '0.625rem 0.5rem', fontWeight: 600, color: '#4F46E5' }}>{row.voomTier}</td>
                  <td style={{ padding: '0.625rem 0.5rem', fontFamily: 'Space Grotesk', color: '#059669', fontWeight: 600 }}>
                    GH₵{row.voomPrice}
                  </td>
                  <td style={{ padding: '0.625rem 0.5rem' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 600, color: '#059669',
                      background: 'rgba(5,150,105,0.1)', padding: '0.15rem 0.5rem', borderRadius: 999,
                    }}>
                      {row.advantage}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassSection>

      {/* ── Competitor Notes ── */}
      <GlassSection>
        <SectionTitle sub="Manual tracking of competitive landscape">Competitor Watch</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {COMPETITORS.map(comp => {
            const riskStyle = RISK_STYLES[comp.risk];
            return (
              <div key={comp.name} className="glass-card" style={{
                padding: '0.875rem',
                border: `1px solid ${riskStyle.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: '0.5rem',
              }}>
                <div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>{comp.name}</span>
                  <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0.125rem 0 0' }}>{comp.status}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 999,
                    background: riskStyle.bg, color: riskStyle.color,
                  }}>
                    {comp.risk} risk
                  </span>
                  <p style={{ fontSize: '0.65rem', color: '#94A3B8', margin: '0.25rem 0 0' }}>
                    Checked: {comp.lastChecked}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </GlassSection>

      {/* ── VOOM Value Proposition ── */}
      <GlassSection>
        <SectionTitle sub="Why vendors should choose VOOM over Jiji">VOOM Differentiation</SectionTitle>
        <div className="two-col-grid">
          {[
            { title: 'Auto Parts Only', desc: 'Focused marketplace vs. general classifieds. Buyers come specifically for parts.', color: '#4F46E5' },
            { title: 'Lower Pricing', desc: 'Starter at GH₵100/mo vs Jiji Basic at GH₵145/mo. 31% savings.', color: '#059669' },
            { title: 'WhatsApp Integration', desc: 'Direct buyer-to-vendor WhatsApp connection. No anonymous messaging.', color: '#7C3AED' },
            { title: 'Part Request Board', desc: 'Buyers post what they need. Vendors see demand before stocking.', color: '#D97706' },
          ].map(item => (
            <div key={item.title} className="glass-card" style={{
              padding: '1rem',
              border: `1px solid ${item.color}20`,
              background: `${item.color}06`,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '0.5rem',
                background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '0.625rem',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
              </div>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.25rem' }}>
                {item.title}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </GlassSection>
    </div>
  );
}
