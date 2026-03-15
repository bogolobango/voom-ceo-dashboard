/**
 * Leads Section — Arctic Glass Design System
 * Tonaton scraper pipeline, WhatsApp broadcast status, and lead table
 */

import { useState, useEffect } from 'react';
import { MetricCard } from '../MetricCard';
import type { DashboardKPIs } from '../../lib/voomApi';

interface Lead {
  name: string;
  phone: string;
  location: string;
  listing: string;
  status: 'not_contacted' | 'sent' | 'responded' | 'converted';
  scraped: string;
}

interface LeadsProps {
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

const LEAD_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  not_contacted: { bg: 'rgba(100,116,139,0.1)', color: '#64748B', label: 'Not Contacted' },
  sent: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', label: 'Message Sent' },
  responded: { bg: 'rgba(14,165,233,0.1)', color: '#0EA5E9', label: 'Responded' },
  converted: { bg: 'rgba(5,150,105,0.1)', color: '#059669', label: 'Converted' },
};

const SAMPLE_LEADS: Lead[] = [
  { name: 'KnK Auto Accessories', phone: '0244123456', location: 'Abossey Okai', listing: 'Toyota Camry Headlights', status: 'converted', scraped: '2026-02-15' },
  { name: 'Mends Auto Parts', phone: '0551234567', location: 'Accra', listing: 'Honda Civic Brake Pads', status: 'responded', scraped: '2026-02-16' },
  { name: 'Roy Auto Parts', phone: '0241234567', location: 'Abossey Okai', listing: 'Nissan Altima Engine Mount', status: 'converted', scraped: '2026-02-14' },
  { name: 'Kafa Auto Parts', phone: '0261234567', location: 'Darkuman', listing: 'Toyota Corolla Radiator', status: 'sent', scraped: '2026-02-20' },
  { name: 'BIG SHOTS AUTOPARTS', phone: '0271234567', location: 'Abossey Okai', listing: 'Mercedes Benz Alternator', status: 'sent', scraped: '2026-02-18' },
  { name: 'Santana Auto Gh', phone: '0231234567', location: 'Accra', listing: 'Hyundai Elantra Shock Absorber', status: 'responded', scraped: '2026-02-19' },
  { name: 'Auto Auctions Ghana', phone: '0501234567', location: 'Tema', listing: 'Ford Focus Transmission', status: 'not_contacted', scraped: '2026-03-01' },
  { name: 'PJ1 BATTERIES', phone: '0281234567', location: 'Kwashieman', listing: 'Car Battery 12V 70Ah', status: 'converted', scraped: '2026-02-17' },
  { name: 'E5 Cooling Global', phone: '0291234567', location: 'Accra', listing: 'AC Compressor Universal', status: 'not_contacted', scraped: '2026-03-05' },
  { name: 'Control Board Guru', phone: '0331234567', location: 'Adenta', listing: 'ECU Control Module', status: 'sent', scraped: '2026-03-08' },
  { name: 'Asare Tank', phone: '0341234567', location: 'Pokuase', listing: 'Fuel Tank Toyota Land Cruiser', status: 'not_contacted', scraped: '2026-03-10' },
  { name: 'Ghana Auto Spares', phone: '0351234567', location: 'Kumasi', listing: 'Spare Parts Wholesale', status: 'not_contacted', scraped: '2026-03-12' },
];

export function Leads({ kpis }: LeadsProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);

  const filtered = SAMPLE_LEADS.filter(l =>
    statusFilter === 'all' || l.status === statusFilter
  );

  const handleCopyAll = () => {
    const phones = SAMPLE_LEADS.map(l => l.phone).join('\n');
    navigator.clipboard.writeText(phones);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBroadcast = () => {
    const msg = encodeURIComponent(
      `Hello! 👋 I'm reaching out from VOOM Ghana — the digital marketplace for car parts in Abossey Okai.\n\n` +
      `We're launching a platform where vendors like you can list your parts online and receive orders via MoMo.\n\n` +
      `✅ Free to list\n✅ MoMo payments\n✅ Make/Model/Year search\n✅ WhatsApp orders\n\n` +
      `Interested? Reply YES and I'll set you up today! 🚗`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
    setBroadcastSent(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Lead Pipeline
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
            Tonaton scraper · {kpis.totalLeads} leads from car parts listings (last 30 days)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleCopyAll}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1px solid rgba(79,70,229,0.2)',
              background: 'rgba(79,70,229,0.06)', color: '#4F46E5', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy All Phones'}
          </button>
          <button
            onClick={handleBroadcast}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.75rem', border: 'none',
              background: broadcastSent ? '#059669' : '#25D366', color: 'white',
              fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.375rem',
            }}
          >
            {broadcastSent ? '✓ Sent!' : '📱 WhatsApp Broadcast'}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <MetricCard label="Total Leads" value={kpis.totalLeads} variant="indigo" delay={0} subtitle="From Tonaton scraper" />
        <MetricCard label="Contacted" value={kpis.leadsContacted} variant="amber" delay={1} subtitle={`${Math.round((kpis.leadsContacted / kpis.totalLeads) * 100)}% of leads`} />
        <MetricCard label="Responded" value={Math.floor(kpis.leadsContacted * 0.42)} variant="indigo" delay={2} subtitle="42% response rate" />
        <MetricCard label="Converted" value={Math.floor(kpis.leadsContacted * 0.18)} variant="emerald" delay={3} subtitle={`${kpis.leadConversionRate}% CVR`} />
      </div>

      {/* Scraper Status */}
      <GlassSection>
        <SectionTitle sub="Tonaton car parts scraper · Last run: Today 06:42 AM">Scraper Status</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {[
            { label: 'Pages Scraped', value: '20 / 499', color: '#4F46E5' },
            { label: 'Unique Leads', value: '95', color: '#059669' },
            { label: 'Duplicates Removed', value: '23', color: '#D97706' },
            { label: 'Session Status', value: 'Cloudflare OK', color: '#059669' },
          ].map(item => (
            <div key={item.label} style={{
              padding: '0.875rem',
              borderRadius: '0.875rem',
              background: 'rgba(248,250,252,0.8)',
              border: '1px solid rgba(79,70,229,0.06)',
            }}>
              <p style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.label}
              </p>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: item.color, fontFamily: 'Space Grotesk', margin: 0 }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#475569' }}>Scrape progress (20 of 499 pages)</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4F46E5', fontFamily: 'Space Grotesk' }}>4%</span>
          </div>
          <div className="liquid-bar" style={{ height: 8 }}>
            <div className="liquid-bar-fill" style={{ width: '4%', background: 'linear-gradient(90deg, #4F46E5, #7C3AED)' }} />
          </div>
          <p style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.375rem' }}>
            Run locally to scrape all 499 pages · ~1,500 unique vendor leads available
          </p>
        </div>
      </GlassSection>

      {/* Status Filter */}
      <div className="glass-card" style={{ padding: '0.375rem', display: 'flex', gap: '0.25rem' }}>
        {['all', 'not_contacted', 'sent', 'responded', 'converted'].map(s => {
          const count = s === 'all' ? SAMPLE_LEADS.length : SAMPLE_LEADS.filter(l => l.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                flex: 1, padding: '0.5rem', borderRadius: '0.625rem', border: 'none',
                background: statusFilter === s ? '#4F46E5' : 'transparent',
                color: statusFilter === s ? 'white' : '#64748B',
                fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
                transition: 'all 0.15s ease', fontFamily: 'Plus Jakarta Sans',
              }}
            >
              {s === 'all' ? 'All' : LEAD_STATUS_STYLES[s].label} ({count})
            </button>
          );
        })}
      </div>

      {/* Lead Table */}
      <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 1fr 1fr',
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid rgba(79,70,229,0.06)',
          background: 'rgba(248,250,252,0.8)',
        }}>
          {['Vendor', 'Phone', 'Location', 'Listing', 'Scraped', 'Status'].map(h => (
            <p key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
              {h}
            </p>
          ))}
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {filtered.map((lead, i) => {
            const st = LEAD_STATUS_STYLES[lead.status];
            const waMsg = encodeURIComponent(
              `Hello ${lead.name.split(' ')[0]}! 👋 I'm from VOOM Ghana — a digital marketplace for car parts. We'd love to help you list your parts online and receive MoMo payments. Free to join! Interested?`
            );
            return (
              <div
                key={i}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 1fr 1fr',
                  padding: '0.875rem 1.25rem',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(79,70,229,0.04)' : 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(79,70,229,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center' }}>{lead.name}</span>
                <a
                  href={`https://wa.me/233${lead.phone.slice(1)}?text=${waMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.8rem', color: '#25D366', fontFamily: 'Space Grotesk', fontWeight: 600, display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                >
                  {lead.phone}
                </a>
                <span style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center' }}>{lead.location}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', paddingRight: '0.5rem' }}>{lead.listing}</span>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'flex', alignItems: 'center' }}>
                  {new Date(lead.scraped).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, background: st.bg, color: st.color, padding: '0.2rem 0.5rem', borderRadius: 999 }}>
                    {st.label}
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
