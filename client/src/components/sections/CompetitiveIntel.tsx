/**
 * Competitive Intelligence — Market data & competitor tracking
 */

import type { Vendor, DashboardKPIs } from '../../lib/voomApi';

interface CompetitiveIntelProps {
  vendors: Vendor[];
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

const JIJI_TIERS = [
  { tier: 'Free', price: 0, adLimit: '1 ad', autoRenew: 'None', voomTier: 'Free', voomPrice: 0, advantage: 'Same — both free' },
  { tier: 'Basic', price: 145, adLimit: '50 ads', autoRenew: '48hrs', voomTier: 'Starter', voomPrice: 100, advantage: '31% cheaper' },
  { tier: 'Premium', price: 265, adLimit: '200 ads', autoRenew: '24hrs', voomTier: 'Pro', voomPrice: 200, advantage: '25% cheaper' },
  { tier: 'VIP', price: 435, adLimit: '500 ads', autoRenew: '12hrs', voomTier: 'Business', voomPrice: 800, advantage: 'Higher price, dedicated support' },
  { tier: 'VIP Gold', price: 570, adLimit: 'Unlimited', autoRenew: '6hrs', voomTier: 'Business', voomPrice: 800, advantage: 'Full-service marketplace' },
  { tier: 'Diamond', price: 945, adLimit: 'Unlimited', autoRenew: '3hrs', voomTier: 'Enterprise', voomPrice: 2000, advantage: 'Premium marketplace features' },
  { tier: 'Enterprise', price: 1670, adLimit: 'Unlimited', autoRenew: '3hrs', voomTier: 'Enterprise', voomPrice: 2000, advantage: 'Parts-focused marketplace' },
];

export function CompetitiveIntel({ vendors, kpis }: CompetitiveIntelProps) {
  const activeVendors = vendors.filter(v => v.status === 'approved').length;
  const marketPenetration = ((activeVendors / 15000) * 100).toFixed(3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Competitive Intelligence
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
          Market data, competitor pricing, and VOOM positioning
        </p>
      </div>

      {/* Market Data */}
      <div className="four-col-grid">
        {[
          { label: 'Ghana Vehicles', value: '2.1M', sub: 'Registered', color: '#4F46E5' },
          { label: 'Abossey Okai', value: '15,000+', sub: 'Vendors', color: '#7C3AED' },
          { label: 'VOOM Vendors', value: String(activeVendors), sub: 'Active', color: '#059669' },
          { label: 'Penetration', value: `${marketPenetration}%`, sub: 'Of Abossey Okai', color: '#D97706' },
        ].map(item => (
          <div key={item.label} className="glass-card" style={{ padding: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: item.color, fontFamily: 'Space Grotesk', margin: 0 }}>
              {item.value}
            </p>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', marginTop: '0.25rem' }}>{item.label}</p>
            <p style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Jiji Pricing Comparison */}
      <GlassSection>
        <SectionTitle sub="Jiji/Tonaton Ghana vs VOOM pricing">Competitor Pricing</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(79,70,229,0.1)' }}>
                {['Jiji Tier', 'Price/mo', 'Ad Limit', 'VOOM Tier', 'VOOM Price', 'Advantage'].map(h => (
                  <th key={h} style={{ padding: '0.625rem 0.5rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {JIJI_TIERS.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(79,70,229,0.04)' }}>
                  <td style={{ padding: '0.625rem 0.5rem', fontWeight: 600, color: '#0F172A' }}>{row.tier}</td>
                  <td style={{ padding: '0.625rem 0.5rem', fontFamily: 'Space Grotesk', color: '#EF4444', fontWeight: 600 }}>
                    GH₵{row.price}
                  </td>
                  <td style={{ padding: '0.625rem 0.5rem', color: '#64748B' }}>{row.adLimit}</td>
                  <td style={{ padding: '0.625rem 0.5rem', fontWeight: 600, color: '#4F46E5' }}>{row.voomTier}</td>
                  <td style={{ padding: '0.625rem 0.5rem', fontFamily: 'Space Grotesk', color: '#059669', fontWeight: 600 }}>
                    GH₵{row.voomPrice}
                  </td>
                  <td style={{ padding: '0.625rem 0.5rem', color: '#059669', fontSize: '0.75rem', fontWeight: 500 }}>
                    {row.advantage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassSection>

      {/* Competitor Tracker */}
      <GlassSection>
        <SectionTitle sub="Manual tracking of competitive landscape">Competitor Watch</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { name: 'Jiji.com.gh (Auto Parts)', status: 'Active — dominant classifieds', risk: 'high', lastChecked: 'Mar 2026' },
            { name: 'Tonaton Ghana', status: 'Active — merged with Jiji', risk: 'high', lastChecked: 'Mar 2026' },
            { name: 'voomgh.com', status: 'Different company — car marketplace', risk: 'low', lastChecked: 'Mar 2026' },
            { name: 'Finduy (Julius)', status: 'Monitoring — similar space', risk: 'medium', lastChecked: 'Mar 2026' },
          ].map(comp => (
            <div key={comp.name} style={{
              padding: '0.75rem', borderRadius: '0.75rem',
              background: 'rgba(248,250,252,0.8)',
              border: `1px solid ${comp.risk === 'high' ? 'rgba(239,68,68,0.15)' : comp.risk === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(5,150,105,0.15)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <div>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>{comp.name}</span>
                <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0.125rem 0 0' }}>{comp.status}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 999,
                  background: comp.risk === 'high' ? 'rgba(239,68,68,0.1)' : comp.risk === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(5,150,105,0.1)',
                  color: comp.risk === 'high' ? '#EF4444' : comp.risk === 'medium' ? '#D97706' : '#059669',
                }}>
                  {comp.risk} risk
                </span>
                <p style={{ fontSize: '0.65rem', color: '#94A3B8', margin: '0.25rem 0 0' }}>Checked: {comp.lastChecked}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassSection>

      {/* VOOM Value Proposition */}
      <GlassSection>
        <SectionTitle sub="Why vendors should choose VOOM over Jiji">VOOM Differentiation</SectionTitle>
        <div className="two-col-grid">
          {[
            { title: 'Auto Parts Only', desc: 'Focused marketplace vs. general classifieds. Buyers come specifically for parts.', icon: '🎯' },
            { title: 'Lower Pricing', desc: 'Starter at GH₵100/mo vs Jiji Basic at GH₵145/mo. 31% savings.', icon: '💰' },
            { title: 'WhatsApp Integration', desc: 'Direct buyer-to-vendor WhatsApp connection. No anonymous messaging.', icon: '📱' },
            { title: 'Part Request Board', desc: 'Buyers post what they need. Vendors see demand before stocking.', icon: '📋' },
          ].map(item => (
            <div key={item.title} style={{
              padding: '1rem', borderRadius: '0.875rem',
              background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.1)',
            }}>
              <p style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>{item.icon}</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.25rem' }}>{item.title}</p>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </GlassSection>
    </div>
  );
}
