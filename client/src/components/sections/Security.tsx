/**
 * Security Section — CISO View — Arctic Glass Design System
 * Mobile-first responsive: single column on mobile, multi-column on desktop
 */

import { useState, useEffect, useCallback } from 'react';
import { MetricCard } from '../MetricCard';
import type { DashboardKPIs, DataSource } from '../../lib/voomApi';

interface SecurityProps {
  kpis: DashboardKPIs;
  dataSource?: DataSource;
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

interface HealthStatus {
  status: string;
  error?: string;
}

// NOTE: This checklist is manually maintained. Items marked "ok" reflect
// code-level configuration, NOT runtime verification. A proper security
// audit should validate each item independently.
const SECURITY_CHECKLIST = [
  { label: 'Rate limiting configured in code (200 req/15min)', ok: true },
  { label: 'Helmet security headers configured in code', ok: true },
  { label: 'CORS configured in code', ok: true },
  { label: 'PII log redaction configured in code', ok: true },
  { label: 'SSL/TLS on database connection (Supabase default)', ok: true },
  { label: 'API key authentication required in production', ok: true },
  { label: 'No WAF configured', ok: false, warning: 'Web Application Firewall not detected' },
  { label: 'No automated backups verified', ok: false, warning: 'Backup verification not configured' },
] satisfies readonly { label: string; ok: boolean; warning?: string }[];

export function Security({ kpis, dataSource = 'offline' }: SecurityProps) {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealthStatus({ status: data.status || 'ok' });
      } else {
        setHealthStatus({ status: 'error', error: `HTTP ${res.status}` });
      }
    } catch (err) {
      setHealthStatus({ status: 'offline', error: 'Could not reach server' });
    } finally {
      setHealthLoading(false);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const isConnected = dataSource === 'database';

  const passCount = SECURITY_CHECKLIST.filter(i => i.ok).length;
  const warnCount = SECURITY_CHECKLIST.filter(i => !i.ok).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* -- Database Health KPI Grid -- */}
      <div className="kpi-grid">
        <MetricCard
          label="Total Users"
          value={kpis.totalUsers}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          variant="indigo"
          delay={0}
          subtitle="Registered accounts"
        />
        <MetricCard
          label="Total Vendors"
          value={kpis.totalVendors}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          variant="indigo"
          delay={1}
          subtitle={`${kpis.approvedVendors} approved`}
        />
        <MetricCard
          label="Total Products"
          value={kpis.totalProducts}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>}
          variant="emerald"
          delay={2}
          subtitle={`${kpis.totalCategories} categories`}
        />
        <MetricCard
          label="Total Orders"
          value={kpis.totalOrders}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>}
          variant="emerald"
          delay={3}
          subtitle="Tracked transactions"
        />
        <MetricCard
          label="DB Status"
          value={isConnected ? 1 : 0}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>}
          variant={isConnected ? 'emerald' : 'rose'}
          delay={4}
          subtitle={isConnected ? 'Connected' : 'Offline'}
        />
      </div>

      {/* -- Uptime Monitor + Data Privacy -- */}
      <div className="two-col-grid">
        {/* Uptime Monitor */}
        <GlassSection>
          <SectionTitle sub="Real-time API health check">Uptime Monitor</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Status indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.75rem', borderRadius: '0.75rem',
              background: healthStatus?.status === 'ok'
                ? 'rgba(5,150,105,0.06)'
                : healthStatus?.status === 'offline' || healthStatus?.status === 'error'
                  ? 'rgba(239,68,68,0.06)'
                  : 'rgba(245,158,11,0.06)',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: healthLoading
                  ? '#F59E0B'
                  : healthStatus?.status === 'ok'
                    ? '#059669'
                    : '#EF4444',
                boxShadow: healthLoading
                  ? '0 0 8px rgba(245,158,11,0.4)'
                  : healthStatus?.status === 'ok'
                    ? '0 0 8px rgba(5,150,105,0.4)'
                    : '0 0 8px rgba(239,68,68,0.4)',
                animation: healthLoading ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }} />
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', margin: 0, fontFamily: 'Space Grotesk' }}>
                  {healthLoading ? 'Checking...' : healthStatus?.status === 'ok' ? 'All Systems Operational' : 'Service Disruption Detected'}
                </p>
                {healthStatus?.error && (
                  <p style={{ fontSize: '0.7rem', color: '#EF4444', margin: '0.125rem 0 0' }}>{healthStatus.error}</p>
                )}
              </div>
            </div>

            {/* Last checked */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '0.72rem', color: '#94A3B8', margin: 0 }}>
                Last checked: {lastChecked ? lastChecked.toLocaleTimeString() : '--'}
              </p>
              <button
                onClick={checkHealth}
                disabled={healthLoading}
                style={{
                  fontSize: '0.72rem', fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif',
                  color: '#4F46E5', background: 'rgba(79,70,229,0.08)',
                  border: '1px solid rgba(79,70,229,0.15)', borderRadius: '0.5rem',
                  padding: '0.3rem 0.75rem', cursor: healthLoading ? 'not-allowed' : 'pointer',
                  opacity: healthLoading ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {healthLoading ? 'Checking...' : 'Check Now'}
              </button>
            </div>
          </div>
        </GlassSection>

        {/* Data Privacy */}
        <GlassSection>
          <SectionTitle sub="PII & compliance overview">Data Privacy</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {/* PII Warning */}
            <div style={{
              padding: '0.625rem 0.75rem', borderRadius: '0.625rem',
              background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.12)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400E' }}>PII Data Stored</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#B45309', margin: 0, lineHeight: 1.4 }}>
                {kpis.totalVendors} vendor{kpis.totalVendors !== 1 ? 's' : ''} have PII stored (phone numbers on file).
              </p>
            </div>

            {/* Encryption at Rest */}
            <div style={{
              padding: '0.625rem 0.75rem', borderRadius: '0.625rem',
              background: 'rgba(5,150,105,0.04)', border: '1px solid rgba(5,150,105,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#065F46' }}>Encryption at Rest</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#047857', margin: 0, lineHeight: 1.4 }}>
                Ensure database encryption at rest is enabled for all PII fields. Verify with your hosting provider.
              </p>
            </div>

            {/* GDPR / Data Protection */}
            <div style={{
              padding: '0.625rem 0.75rem', borderRadius: '0.625rem',
              background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3730A3' }}>GDPR / Data Protection</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#4338CA', margin: 0, lineHeight: 1.4 }}>
                Vendor phone numbers constitute PII under GDPR. Ensure data processing agreements are in place, retention policies are documented, and right-to-erasure requests can be honored.
              </p>
            </div>
          </div>
        </GlassSection>
      </div>

      {/* -- Security Checklist -- */}
      <GlassSection>
        <SectionTitle sub={`${passCount} configured · ${warnCount} warning${warnCount !== 1 ? 's' : ''} · Based on code review, not runtime verification`}>
          Security Checklist
        </SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {SECURITY_CHECKLIST.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                padding: '0.5rem 0.625rem', borderRadius: '0.625rem',
                background: item.ok ? 'rgba(5,150,105,0.04)' : 'rgba(245,158,11,0.05)',
                border: item.ok ? '1px solid rgba(5,150,105,0.08)' : '1px solid rgba(245,158,11,0.12)',
              }}
            >
              <span style={{
                fontSize: '0.85rem', lineHeight: 1.4, flexShrink: 0,
                marginTop: '0.05rem',
              }}>
                {item.ok ? '\u2705' : '\u26A0\uFE0F'}
              </span>
              <div>
                <p style={{
                  fontSize: '0.78rem', fontWeight: 500, color: '#0F172A', margin: 0,
                  fontFamily: 'Plus Jakarta Sans, sans-serif', lineHeight: 1.4,
                }}>
                  {item.label}
                </p>
                {item.warning && (
                  <p style={{ fontSize: '0.68rem', color: '#B45309', margin: '0.1rem 0 0', lineHeight: 1.3 }}>
                    {item.warning}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassSection>
    </div>
  );
}
