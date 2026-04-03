/**
 * Morning Briefing Section — CEO's 6am Daily Briefing
 * Arctic Glass Design System
 * Mobile-first responsive: single column on mobile, multi-column on desktop
 */

import { useMemo } from 'react';
import type { DashboardKPIs, Vendor, BriefingData } from '../../lib/voomApi';

// ─── Tier pricing (GH₵/month) ───
const TIER_PRICES: Record<string, number> = {
  free: 0,
  starter: 100,
  pro: 200,
  business: 800,
  enterprise: 2000,
};

const USD_RATE = 14.5;

const TIER_COLORS: Record<string, string> = {
  free: '#94A3B8',
  starter: '#0EA5E9',
  pro: '#7C3AED',
  business: '#4F46E5',
  enterprise: '#059669',
};

interface MorningBriefingProps {
  briefingData: BriefingData;
  vendors: Vendor[];
  kpis: DashboardKPIs;
}

// ─── Shared sub-components ───

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

function TrendArrow({ current, previous }: { current: number; previous: number }) {
  if (current === previous) {
    return <span style={{ fontSize: '0.7rem', color: '#64748B', marginLeft: '0.25rem' }}>—</span>;
  }
  const up = current > previous;
  const pct = previous > 0 ? Math.abs(Math.round(((current - previous) / previous) * 100)) : current > 0 ? 100 : 0;
  return (
    <span style={{
      fontSize: '0.68rem',
      fontWeight: 600,
      color: up ? '#059669' : '#E11D48',
      marginLeft: '0.25rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.1rem',
    }}>
      {up ? '▲' : '▼'} {pct}%
    </span>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Main Component ───

export function MorningBriefing({ briefingData, vendors, kpis }: MorningBriefingProps) {
  const {
    todaySearches = 0, yesterdaySearches = 0,
    todayWhatsappTaps = 0, yesterdayWhatsappTaps = 0,
    todayProductViews = 0, yesterdayProductViews = 0,
    todayNewVendors = 0, yesterdayNewVendors = 0,
    todayPartRequests = 0, yesterdayPartRequests = 0,
    todayNewUsers = 0, yesterdayNewUsers = 0, totalUsers = 0,
    topSearches = [], zeroResultSearches = [], expiringVendors = [],
    activePaidVendors = 0, mrr = 0, topCategories = [],
  } = briefingData ?? {};

  const mrrUsd = useMemo(() => mrr / USD_RATE, [mrr]);

  // Compute tier distribution from vendors
  const tierDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    vendors.forEach(v => {
      const t = v.tier || 'free';
      dist[t] = (dist[t] || 0) + 1;
    });
    return Object.entries(dist)
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => (TIER_PRICES[b.tier] || 0) - (TIER_PRICES[a.tier] || 0));
  }, [vendors]);

  const totalVendorsForBar = useMemo(
    () => tierDistribution.reduce((s, t) => s + t.count, 0) || 1,
    [tierDistribution],
  );

  // Expiring vendors sorted by urgency
  const sortedExpiring = useMemo(
    () => [...expiringVendors]
      .map(v => ({ ...v, daysLeft: daysUntil(v.tierExpiresAt) }))
      .filter(v => v.daysLeft >= 0 && v.daysLeft <= 7)
      .sort((a, b) => a.daysLeft - b.daysLeft),
    [expiringVendors],
  );

  // Revenue at risk from expiring vendors
  const revenueAtRisk = useMemo(
    () => sortedExpiring.reduce((sum, v) => sum + (TIER_PRICES[v.tier] || 0), 0),
    [sortedExpiring],
  );

  // Build alerts list
  const alerts = useMemo(() => {
    const items: { type: 'urgent' | 'warning'; label: string; detail: string }[] = [];

    sortedExpiring.forEach(v => {
      const isTrial = (v as any).tierTrialUsed === true;
      items.push({
        type: v.daysLeft <= 2 ? 'urgent' : 'warning',
        label: `${v.businessName} (${v.tier}${isTrial ? ' trial' : ''}) expires in ${v.daysLeft}d`,
        detail: isTrial
          ? `Trial ends — upgrade to retain GH₵ ${TIER_PRICES[v.tier] || 0}/mo`
          : `GH₵ ${TIER_PRICES[v.tier] || 0}/mo at risk`,
      });
    });

    zeroResultSearches.forEach(s => {
      items.push({
        type: 'warning',
        label: `"${s.query}" — zero results`,
        detail: `Searched ${s.count} time${s.count > 1 ? 's' : ''} today (supply gap)`,
      });
    });

    // Sort: urgent first
    items.sort((a, b) => (a.type === 'urgent' ? 0 : 1) - (b.type === 'urgent' ? 0 : 1));
    return items;
  }, [sortedExpiring, zeroResultSearches]);

  // Comparison rows
  const comparisonRows = useMemo(() => [
    { label: 'Searches', today: todaySearches, yesterday: yesterdaySearches },
    { label: 'Product Views', today: todayProductViews, yesterday: yesterdayProductViews },
    { label: 'WhatsApp Taps', today: todayWhatsappTaps, yesterday: yesterdayWhatsappTaps },
    { label: 'New Users', today: todayNewUsers, yesterday: yesterdayNewUsers },
    { label: 'New Vendors', today: todayNewVendors, yesterday: yesterdayNewVendors },
    { label: 'Part Requests', today: todayPartRequests, yesterday: yesterdayPartRequests },
  ], [todaySearches, yesterdaySearches, todayProductViews, yesterdayProductViews, todayWhatsappTaps, yesterdayWhatsappTaps, todayNewUsers, yesterdayNewUsers, todayNewVendors, yesterdayNewVendors, todayPartRequests, yesterdayPartRequests]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ═══════════════════════════════════════════════════════
          1. PULSE BAR — sticky top within the section
         ═══════════════════════════════════════════════════════ */}
      <div style={{ position: 'sticky', top: 56, zIndex: 20 }}>
        <div className="glass-card" style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          justifyContent: 'space-between',
        }}>
          {[
            { label: "Today's Searches", value: todaySearches, prev: yesterdaySearches },
            { label: "Product Views", value: todayProductViews, prev: yesterdayProductViews },
            { label: "WhatsApp Taps", value: todayWhatsappTaps, prev: yesterdayWhatsappTaps },
            { label: "New Users", value: todayNewUsers, prev: yesterdayNewUsers },
            { label: "MRR", value: mrr, prev: undefined, prefix: mrr > 0 ? 'GH₵ ' : '', customDisplay: mrr > 0 ? undefined : 'Pre-rev' },
          ].map((item, i) => (
            <div key={i} style={{
              flex: '1 1 80px',
              minWidth: '60px',
              textAlign: 'center',
              padding: '0.375rem 0.375rem',
            }}>
              <p style={{
                fontSize: '0.65rem', fontWeight: 500, color: '#94A3B8',
                margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {item.label}
              </p>
              <p style={{
                fontSize: '1.125rem', fontWeight: 700,
                color: (item as any).customDisplay ? '#94A3B8' : '#0F172A',
                fontFamily: 'Space Grotesk, monospace', margin: '0.125rem 0 0',
                lineHeight: 1,
              }}>
                {(item as any).customDisplay || `${item.prefix || ''}${formatNumber(Math.round(item.value))}`}
                {item.prev !== undefined && <TrendArrow current={item.value} previous={item.prev} />}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          2. ALERTS & ACTIONS
         ═══════════════════════════════════════════════════════ */}
      {alerts.length > 0 && (
        <GlassSection>
          <SectionTitle sub={`${alerts.length} actionable item${alerts.length > 1 ? 's' : ''}`}>
            Alerts & Actions
          </SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {alerts.map((alert, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.625rem 0.75rem',
                borderRadius: '0.75rem',
                background: alert.type === 'urgent' ? 'rgba(225,29,72,0.04)' : 'rgba(217,119,6,0.04)',
                borderLeft: `3px solid ${alert.type === 'urgent' ? '#E11D48' : '#D97706'}`,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: '0.3rem',
                  background: alert.type === 'urgent' ? '#E11D48' : '#D97706',
                }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', margin: 0,
                  }}>
                    {alert.label}
                  </p>
                  <p style={{
                    fontSize: '0.7rem', color: '#64748B', margin: '0.125rem 0 0',
                  }}>
                    {alert.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GlassSection>
      )}

      {/* ═══════════════════════════════════════════════════════
          3. YESTERDAY vs TODAY COMPARISON
         ═══════════════════════════════════════════════════════ */}
      <GlassSection>
        <SectionTitle sub="Key metrics side by side">Yesterday vs Today</SectionTitle>
        {/* Header row — visible on tablet+ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 0.5fr',
          gap: '0.5rem',
          padding: '0.375rem 0.625rem',
          marginBottom: '0.25rem',
        }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Metric</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Yesterday</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Today</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Trend</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {comparisonRows.map((row, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 0.5fr',
              gap: '0.5rem',
              padding: '0.5rem 0.625rem',
              borderRadius: '0.625rem',
              background: i % 2 === 0 ? 'rgba(248,250,252,0.8)' : 'transparent',
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#0F172A' }}>{row.label}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', fontFamily: 'Space Grotesk', textAlign: 'right' }}>
                {formatNumber(row.yesterday)}
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk', textAlign: 'right' }}>
                {formatNumber(row.today)}
              </span>
              <span style={{ textAlign: 'right' }}>
                <TrendArrow current={row.today} previous={row.yesterday} />
              </span>
            </div>
          ))}
        </div>
      </GlassSection>

      {/* ═══════════════════════════════════════════════════════
          4. TOP SEARCHES TODAY + 5. REVENUE SNAPSHOT (side by side on desktop)
         ═══════════════════════════════════════════════════════ */}
      <div className="two-col-grid">

        {/* ── Top Searches Today ── */}
        <GlassSection>
          <SectionTitle sub="Search queries ranked by volume">Top Searches Today</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {topSearches.length === 0 && (
              <p style={{ fontSize: '0.78rem', color: '#94A3B8' }}>No search data yet today.</p>
            )}
            {topSearches.map((s, i) => {
              const isZero = s.results === 0;
              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.625rem',
                  borderRadius: '0.625rem',
                  background: isZero ? 'rgba(225,29,72,0.05)' : 'rgba(248,250,252,0.8)',
                  borderLeft: isZero ? '3px solid #E11D48' : '3px solid transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 800, color: isZero ? '#E11D48' : '#94A3B8',
                      width: '1rem', textAlign: 'center', flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{
                      fontSize: '0.8rem', fontWeight: 500,
                      color: isZero ? '#E11D48' : '#0F172A',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.query}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 600, color: '#475569',
                      fontFamily: 'Space Grotesk',
                    }}>
                      {s.count}x
                    </span>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 600,
                      color: isZero ? '#E11D48' : '#059669',
                      background: isZero ? 'rgba(225,29,72,0.1)' : 'rgba(5,150,105,0.1)',
                      padding: '0.1rem 0.35rem', borderRadius: 999,
                    }}>
                      {s.results} result{s.results !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassSection>

        {/* ── Revenue Snapshot ── */}
        <GlassSection>
          <SectionTitle sub="Subscription revenue overview">Revenue Snapshot</SectionTitle>

          {/* MRR display */}
          <div style={{
            display: 'flex', gap: '1rem', marginBottom: '1rem',
            flexWrap: 'wrap',
          }}>
            <div>
              <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>MRR (GH₵)</p>
              <p style={{
                fontSize: '1.375rem', fontWeight: 700, color: mrr > 0 ? '#059669' : '#94A3B8',
                fontFamily: 'Space Grotesk, monospace', margin: '0.125rem 0 0', lineHeight: 1,
              }}>
                {mrr > 0 ? `GH₵ ${mrr.toLocaleString()}` : 'Pre-revenue'}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>MRR (USD)</p>
              <p style={{
                fontSize: '1.375rem', fontWeight: 700, color: mrr > 0 ? '#4F46E5' : '#94A3B8',
                fontFamily: 'Space Grotesk, monospace', margin: '0.125rem 0 0', lineHeight: 1,
              }}>
                {mrr > 0 ? `$ ${Math.round(mrrUsd).toLocaleString()}` : '$0'}
              </p>
            </div>
          </div>

          {/* Tier stacked bar */}
          <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.375rem' }}>
            Vendors by Tier
          </p>
          <div style={{
            display: 'flex',
            borderRadius: 999,
            overflow: 'hidden',
            height: 18,
            marginBottom: '0.5rem',
            background: 'rgba(79,70,229,0.06)',
          }}>
            {tierDistribution.map(({ tier, count }) => {
              const pct = (count / totalVendorsForBar) * 100;
              if (pct < 0.5) return null;
              return (
                <div key={tier} title={`${tier}: ${count}`} style={{
                  width: `${pct}%`,
                  background: TIER_COLORS[tier] || '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'width 0.8s ease',
                }}>
                  {pct > 8 && (
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                      {tier}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tier legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {tierDistribution.map(({ tier, count }) => (
              <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: TIER_COLORS[tier] || '#94A3B8', flexShrink: 0,
                }} />
                <span style={{ fontSize: '0.7rem', color: '#475569' }}>
                  {tier} <span style={{ fontWeight: 700, fontFamily: 'Space Grotesk', color: '#0F172A' }}>{count}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Expiring vendors / revenue at risk */}
          <div style={{
            padding: '0.625rem 0.75rem',
            borderRadius: '0.75rem',
            background: sortedExpiring.length > 0 ? 'rgba(225,29,72,0.04)' : 'rgba(5,150,105,0.04)',
            borderLeft: `3px solid ${sortedExpiring.length > 0 ? '#E11D48' : '#059669'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                  Expiring ≤ 7 days
                </p>
                <p style={{ fontSize: '0.68rem', color: '#64748B', margin: '0.125rem 0 0' }}>
                  {sortedExpiring.length} vendor{sortedExpiring.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Revenue at risk
                </p>
                <p style={{
                  fontSize: '1rem', fontWeight: 700, fontFamily: 'Space Grotesk',
                  color: sortedExpiring.length > 0 ? '#E11D48' : '#059669',
                  margin: '0.125rem 0 0', lineHeight: 1,
                }}>
                  GH₵ {revenueAtRisk.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </GlassSection>
      </div>

      {/* ═══════════════════════════════════════════════════════
          5. TOP PRODUCT CATEGORIES + USER GROWTH (side by side)
         ═══════════════════════════════════════════════════════ */}
      <div className="two-col-grid">

        {/* ── Top Product Categories (30-day views) ── */}
        <GlassSection>
          <SectionTitle sub="Most viewed categories last 30 days">Category Traffic</SectionTitle>
          {topCategories.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: '#94A3B8' }}>No category view data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(() => {
                const maxViews = Math.max(...topCategories.map(c => c.views), 1);
                return topCategories.map((cat, i) => {
                  const pct = Math.round((cat.views / maxViews) * 100);
                  const catColors = ['#4F46E5','#7C3AED','#0EA5E9','#059669','#D97706','#E11D48'];
                  const color = catColors[i % catColors.length];
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                          {cat.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color, fontFamily: 'Space Grotesk', flexShrink: 0, marginLeft: '0.5rem' }}>
                          {cat.views} view{cat.views !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: 'rgba(79,70,229,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: color, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </GlassSection>

        {/* ── User Growth ── */}
        <GlassSection>
          <SectionTitle sub="Registered users on voomparts.com">User Growth</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{
              padding: '0.875rem', borderRadius: '0.875rem',
              background: 'linear-gradient(135deg, rgba(79,70,229,0.06) 0%, rgba(124,58,237,0.04) 100%)',
              border: '1px solid rgba(79,70,229,0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Users</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', fontFamily: 'Space Grotesk', margin: '0.125rem 0 0', lineHeight: 1 }}>
                  {formatNumber(totalUsers)}
                </p>
              </div>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(79,70,229,0.3)" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            {[
              { label: 'New today', value: todayNewUsers, prev: yesterdayNewUsers, color: '#4F46E5' },
              { label: 'New yesterday', value: yesterdayNewUsers, prev: undefined, color: '#94A3B8' },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.5rem 0.625rem', borderRadius: '0.625rem',
                background: i === 0 ? 'rgba(248,250,252,0.8)' : 'transparent',
              }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>{row.label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: row.color, fontFamily: 'Space Grotesk' }}>
                  +{row.value}
                  {row.prev !== undefined && <TrendArrow current={row.value} previous={row.prev} />}
                </span>
              </div>
            ))}
          </div>
        </GlassSection>
      </div>
    </div>
  );
}
