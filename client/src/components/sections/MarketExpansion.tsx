/**
 * Multi-Market Expansion Tracker — Arctic Glass Design System
 * PawaPay 20-market coverage, readiness checklists, TAM/SAM/SOM
 */

import { useState, useMemo } from 'react';

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

// ─── Market Data ───

interface Market {
  country: string;
  flag: string;
  aftermarketSize: string;
  mmos: string[];
  language: string;
  tier: 'current' | 1 | 2 | 3 | 4;
  status: 'live' | 'planning' | 'research' | 'future';
  checklist: { label: string; done: boolean }[];
}

const MARKETS: Market[] = [
  {
    country: 'Ghana', flag: '🇬🇭', aftermarketSize: '$600-800M', mmos: ['MTN', 'AirtelTigo', 'Telecel'],
    language: 'English', tier: 'current', status: 'live',
    checklist: [
      { label: 'Market research completed', done: true },
      { label: 'PawaPay MMO availability confirmed', done: false },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: true },
      { label: 'First vendor contacts identified', done: true },
      { label: 'Taxonomy adapted for local vehicle mix', done: true },
      { label: 'Localization requirements identified', done: true },
    ],
  },
  {
    country: 'Nigeria', flag: '🇳🇬', aftermarketSize: '$1.4B', mmos: ['MTN', 'Airtel', 'Glo', '9mobile'],
    language: 'English', tier: 1, status: 'planning',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: true },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
  {
    country: 'Kenya', flag: '🇰🇪', aftermarketSize: '$750M+', mmos: ['M-Pesa', 'Airtel'],
    language: 'English', tier: 1, status: 'planning',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: true },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
  {
    country: 'Tanzania', flag: '🇹🇿', aftermarketSize: '$180M', mmos: ['Vodacom M-Pesa', 'Airtel', 'Tigo'],
    language: 'English/Swahili', tier: 2, status: 'research',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: true },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
  {
    country: 'Uganda', flag: '🇺🇬', aftermarketSize: '$150M', mmos: ['MTN', 'Airtel'],
    language: 'English', tier: 2, status: 'research',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: true },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
  {
    country: 'Zambia', flag: '🇿🇲', aftermarketSize: '$120M', mmos: ['MTN', 'Airtel'],
    language: 'English', tier: 2, status: 'research',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: true },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
  {
    country: 'Cameroon', flag: '🇨🇲', aftermarketSize: '$200M', mmos: ['MTN', 'Orange'],
    language: 'French/English', tier: 3, status: 'future',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: true },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
  {
    country: 'Ivory Coast', flag: '🇨🇮', aftermarketSize: '$180M', mmos: ['MTN', 'Orange', 'Wave'],
    language: 'French', tier: 3, status: 'future',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: true },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
  {
    country: 'Senegal', flag: '🇸🇳', aftermarketSize: '$140M', mmos: ['Orange', 'Wave', 'Free'],
    language: 'French', tier: 3, status: 'future',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: true },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
  {
    country: 'DRC', flag: '🇨🇩', aftermarketSize: '$250M', mmos: ['Vodacom M-Pesa', 'Airtel', 'Orange'],
    language: 'French', tier: 3, status: 'future',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: true },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
  {
    country: 'Ethiopia', flag: '🇪🇹', aftermarketSize: '$300M', mmos: ['Telebirr'],
    language: 'Amharic', tier: 4, status: 'future',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: false },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
  {
    country: 'Rwanda', flag: '🇷🇼', aftermarketSize: '$60M', mmos: ['MTN', 'Airtel'],
    language: 'English/French', tier: 4, status: 'future',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: true },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
  {
    country: 'Mozambique', flag: '🇲🇿', aftermarketSize: '$80M', mmos: ['Vodacom M-Pesa'],
    language: 'Portuguese', tier: 4, status: 'future',
    checklist: [
      { label: 'Market research completed', done: false },
      { label: 'PawaPay MMO availability confirmed', done: true },
      { label: 'Local entity requirements researched', done: false },
      { label: 'Competitive landscape mapped', done: false },
      { label: 'First vendor contacts identified', done: false },
      { label: 'Taxonomy adapted for local vehicle mix', done: false },
      { label: 'Localization requirements identified', done: false },
    ],
  },
];

const TIER_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  current: { label: 'Live', color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  '1': { label: 'Tier 1', color: '#4F46E5', bg: 'rgba(79,70,229,0.1)' },
  '2': { label: 'Tier 2', color: '#D97706', bg: 'rgba(217,119,6,0.1)' },
  '3': { label: 'Tier 3', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  '4': { label: 'Tier 4', color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
};

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  live: { color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  planning: { color: '#4F46E5', bg: 'rgba(79,70,229,0.1)' },
  research: { color: '#D97706', bg: 'rgba(217,119,6,0.1)' },
  future: { color: '#64748B', bg: 'rgba(100,116,139,0.08)' },
};

// ─── TAM / SAM / SOM ───

const TAM_AFRICA = 23.2; // $B, 2024
const TAM_2032 = 37.6;   // $B projected
const PAWAPAY_SAM_RATIO = 0.68; // ~68% of Africa covered by PawaPay markets
const SOM_LOW = 0.001;   // 0.1%
const SOM_HIGH = 0.005;  // 0.5%

// ─── Investor Readiness ───

interface ReadinessItem {
  label: string;
  done: boolean;
  unlocks: string;
}

const READINESS_ITEMS: ReadinessItem[] = [
  { label: 'First vendor signed (Ghana Card submitted)', done: true, unlocks: 'Proof of vendor demand' },
  { label: 'Real products listed by vendors on voomparts.com', done: true, unlocks: 'Marketplace has supply' },
  { label: 'Real buyer traffic (1.2K users, GA4 confirmed)', done: true, unlocks: 'Proof of buyer demand' },
  { label: 'Pitch deck ready, investor conversations started', done: true, unlocks: 'Fundraise pipeline' },
  { label: '30-50 vendors contacted, ~20% response rate', done: true, unlocks: 'Outreach playbook validated' },
  { label: 'First paid subscriber (revenue > $0)', done: false, unlocks: 'Revenue model validation' },
  { label: 'Ghana PMF proof (50 vendors, 15 txns, GH₵1K MRR)', done: false, unlocks: 'Seed raise' },
  { label: 'PawaPay integration live', done: false, unlocks: 'Multi-market pitch' },
  { label: '1,000 SKUs listed', done: false, unlocks: 'Marketplace liquidity proof' },
  { label: 'Nigeria research complete', done: false, unlocks: '"West Africa" narrative' },
];

export function MarketExpansion() {
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const tierGroups = useMemo(() => {
    const groups: Record<string, Market[]> = {};
    MARKETS.forEach(m => {
      const key = String(m.tier);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return groups;
  }, []);

  const totalSAM = TAM_AFRICA * PAWAPAY_SAM_RATIO;
  const somLow = totalSAM * SOM_LOW;
  const somHigh = totalSAM * SOM_HIGH;

  const readinessDone = READINESS_ITEMS.filter(r => r.done).length;
  const readinessScore = Math.round((readinessDone / READINESS_ITEMS.length) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Multi-Market Expansion
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
          PawaPay covers 20 African markets / 42 MMOs / 85% of Africa's mobile wallets
        </p>
      </div>

      {/* TAM / SAM / SOM */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
        {[
          { label: 'Africa Auto TAM', value: `$${TAM_AFRICA}B`, sub: '2024 estimate', color: '#0F172A' },
          { label: 'TAM 2032', value: `$${TAM_2032}B`, sub: `${((TAM_2032 / TAM_AFRICA - 1) * 100).toFixed(0)}% growth`, color: '#7C3AED' },
          { label: 'PawaPay SAM', value: `$${totalSAM.toFixed(1)}B`, sub: `${MARKETS.length} markets accessible`, color: '#4F46E5' },
          { label: 'SOM (0.1%)', value: `$${(somLow * 1000).toFixed(0)}M`, sub: 'Conservative Y5', color: '#D97706' },
          { label: 'SOM (0.5%)', value: `$${(somHigh * 1000).toFixed(0)}M`, sub: 'Aggressive Y5', color: '#059669' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '0.875rem', borderRadius: '0.875rem', textAlign: 'center',
            background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(79,70,229,0.06)',
          }}>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color, margin: 0, fontFamily: 'Space Grotesk' }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0F172A', margin: '0.25rem 0 0' }}>{s.label}</p>
            <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: '0.125rem 0 0' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Investor Readiness Score */}
      <GlassSection>
        <SectionTitle sub={`${readinessDone} of ${READINESS_ITEMS.length} milestones completed`}>
          Investor Readiness Score: {readinessScore}%
        </SectionTitle>
        <div style={{
          height: 10, borderRadius: 999, background: 'rgba(79,70,229,0.08)', marginBottom: '0.75rem', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${readinessScore}%`, borderRadius: 999,
            background: readinessScore >= 60 ? '#059669' : readinessScore >= 30 ? '#D97706' : '#E11D48',
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {READINESS_ITEMS.map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.625rem', borderRadius: '0.5rem',
              background: item.done ? 'rgba(5,150,105,0.04)' : 'rgba(248,250,252,0.6)',
            }}>
              <span style={{ fontSize: '0.875rem' }}>{item.done ? '\u2705' : '\u2B1C'}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 500, color: '#0F172A', margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: '0.65rem', color: '#94A3B8', margin: 0 }}>Unlocks: {item.unlocks}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassSection>

      {/* Market Tiers */}
      {(['current', '1', '2', '3', '4'] as const).map(tierKey => {
        const markets = tierGroups[tierKey];
        if (!markets) return null;
        const tierStyle = TIER_LABELS[tierKey];
        return (
          <GlassSection key={tierKey}>
            <SectionTitle sub={
              tierKey === 'current' ? 'Currently operating' :
              tierKey === '1' ? 'Next expansion targets — English-speaking, large TAM' :
              tierKey === '2' ? 'East/Southern Africa — English-speaking, medium TAM' :
              tierKey === '3' ? 'Francophone West & Central Africa' :
              'Diverse languages, emerging mobile money'
            }>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                  borderRadius: 999, color: tierStyle.color, background: tierStyle.bg,
                }}>{tierStyle.label}</span>
                {tierKey === 'current' ? 'Ghana' : `${markets.length} Market${markets.length > 1 ? 's' : ''}`}
              </span>
            </SectionTitle>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {markets.map(market => {
                const isExpanded = expandedCountry === market.country;
                const st = STATUS_COLORS[market.status];
                const checklistDone = market.checklist.filter(c => c.done).length;
                const checklistPct = Math.round((checklistDone / market.checklist.length) * 100);

                return (
                  <div key={market.country}>
                    <div
                      onClick={() => setExpandedCountry(isExpanded ? null : market.country)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.75rem', borderRadius: '0.75rem',
                        background: isExpanded ? 'rgba(79,70,229,0.04)' : 'rgba(248,250,252,0.6)',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{market.flag}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
                            {market.country}
                          </p>
                          <span style={{
                            fontSize: '0.58rem', fontWeight: 600, padding: '0.1rem 0.4rem',
                            borderRadius: 999, color: st.color, background: st.bg,
                          }}>
                            {market.status}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0.125rem 0 0' }}>
                          {market.aftermarketSize} TAM · {market.mmos.join(', ')} · {market.language}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#4F46E5', margin: 0, fontFamily: 'Space Grotesk' }}>
                          {checklistPct}%
                        </p>
                        <p style={{ fontSize: '0.62rem', color: '#94A3B8', margin: 0 }}>readiness</p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease', flexShrink: 0,
                      }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>

                    {/* Expanded checklist */}
                    {isExpanded && (
                      <div style={{
                        padding: '0.75rem 0.75rem 0.75rem 3.5rem',
                        display: 'flex', flexDirection: 'column', gap: '0.25rem',
                      }}>
                        {market.checklist.map(item => (
                          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.75rem' }}>{item.done ? '\u2705' : '\u2B1C'}</span>
                            <span style={{
                              fontSize: '0.78rem', color: item.done ? '#059669' : '#475569',
                              textDecoration: item.done ? 'line-through' : 'none',
                            }}>
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassSection>
        );
      })}

      {/* PawaPay Integration Status */}
      <GlassSection>
        <SectionTitle sub="Payment infrastructure for multi-market expansion">PawaPay Integration</SectionTitle>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem',
          borderRadius: '0.75rem', background: 'rgba(217,119,6,0.06)',
          borderLeft: '3px solid #D97706',
        }}>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>Account Status: Not Started</p>
            <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0.25rem 0 0' }}>
              PawaPay covers 20 markets / 42 MMOs / 85% of Africa's mobile wallets.
              One API integration unlocks Nigeria, Kenya, and 17+ more markets.
            </p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
          {[
            { label: 'Account Status', value: 'Not Started', color: '#D97706' },
            { label: 'Test Transactions', value: '0', color: '#64748B' },
            { label: 'Markets Accessible', value: '20', color: '#4F46E5' },
            { label: 'First Live Txn', value: 'Pending', color: '#94A3B8' },
          ].map(item => (
            <div key={item.label} style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(248,250,252,0.6)' }}>
              <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: item.color, margin: '0.125rem 0 0', fontFamily: 'Space Grotesk' }}>{item.value}</p>
            </div>
          ))}
        </div>
      </GlassSection>
    </div>
  );
}
