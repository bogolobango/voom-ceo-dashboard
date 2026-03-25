/**
 * Sidebar — Arctic Glass Design System
 * Fixed left sidebar with glass morphism, VOOM branding, and nav items
 */

import { useState } from 'react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface SidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  liveStatus: 'live' | 'warn' | 'error';
}

function VoomLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '0.75rem',
        background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="rgba(255,255,255,0.9)" />
          <path d="M12 2L4 7l8 5 8-5L12 2z" fill="rgba(255,255,255,0.3)" />
        </svg>
      </div>
      <div>
        <p style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: '1rem', color: '#0F172A', lineHeight: 1 }}>VOOM</p>
        <p style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ghana · CEO</p>
      </div>
    </div>
  );
}

function IconOverview() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function IconVendors() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function IconProducts() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
}
function IconOrders() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
}
function IconRevenue() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function IconPartRequests() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
}
function IconGrowth() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
}
function IconSettings() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}

function IconBriefing() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function IconCRM() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
}
function IconSecurity() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function IconCompetitive() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'briefing', label: 'Briefing', icon: <IconBriefing /> },
  { id: 'overview', label: 'Overview', icon: <IconOverview /> },
  { id: 'vendors', label: 'Vendors', icon: <IconVendors /> },
  { id: 'products', label: 'Products', icon: <IconProducts /> },
  { id: 'orders', label: 'Orders', icon: <IconOrders /> },
  { id: 'revenue', label: 'Revenue', icon: <IconRevenue /> },
  { id: 'part-requests', label: 'Part Requests', icon: <IconPartRequests /> },
  { id: 'growth', label: 'Growth', icon: <IconGrowth /> },
  { id: 'crm', label: 'Outreach CRM', icon: <IconCRM /> },
  { id: 'security', label: 'Security', icon: <IconSecurity /> },
  { id: 'competitive', label: 'Competitive', icon: <IconCompetitive /> },
];

export function Sidebar({ activeSection, onNavigate, liveStatus }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="glass-sidebar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: collapsed ? 72 : 240,
        transition: 'width 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {/* Subtle glow overlay */}
      <div style={{
        position: 'absolute',
        top: -60,
        right: -40,
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -40,
        left: -20,
        width: 160,
        height: 160,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{
        padding: collapsed ? '1.25rem 1rem' : '1.25rem 1.25rem',
        borderBottom: '1px solid rgba(79,70,229,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        minHeight: 72,
        position: 'relative',
      }}>
        {!collapsed && <VoomLogo />}
        {collapsed && (
          <div style={{
            width: 36, height: 36, borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="rgba(255,255,255,0.9)" />
            </svg>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            width: 28, height: 28, borderRadius: '0.5rem',
            background: 'rgba(79,70,229,0.08)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#4F46E5', flexShrink: 0,
            marginLeft: collapsed ? 0 : '0.5rem',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {collapsed
              ? <path d="M9 18l6-6-6-6" />
              : <path d="M15 18l-6-6 6-6" />
            }
          </svg>
        </button>
      </div>

      {/* Live Status */}
      {!collapsed && (
        <div style={{
          margin: '0.75rem 1rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.75rem',
          background: liveStatus === 'live' ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <div className={`status-orb ${liveStatus}`} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: liveStatus === 'live' ? '#059669' : '#D97706' }}>
            {liveStatus === 'live' ? 'Live Data' : 'Demo Mode'}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.5rem 0.75rem', overflowY: 'auto', position: 'relative' }}>
        {!collapsed && (
          <p style={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#CBD5E1',
            padding: '0.5rem 0.25rem',
            marginBottom: '0.25rem',
          }}>
            Command
          </p>
        )}
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
            style={{
              width: '100%',
              justifyContent: collapsed ? 'center' : 'flex-start',
              marginBottom: '0.125rem',
              border: 'none',
              background: activeSection === item.id ? 'rgba(79,70,229,0.1)' : 'transparent',
            }}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon" style={{ flexShrink: 0 }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
            {!collapsed && item.badge && (
              <span style={{
                marginLeft: 'auto', minWidth: 20, height: 20,
                borderRadius: 999, background: '#4F46E5', color: 'white',
                fontSize: '0.65rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 6px',
              }}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '0.75rem',
        borderTop: '1px solid rgba(79,70,229,0.06)',
        position: 'relative',
      }}>
        <button
          onClick={() => onNavigate('settings')}
          className="nav-item"
          style={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            border: 'none',
            background: 'transparent',
          }}
        >
          <IconSettings />
          {!collapsed && <span>Settings</span>}
        </button>
        {!collapsed && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.625rem 0.75rem',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(124,58,237,0.04))',
            border: '1px solid rgba(79,70,229,0.08)',
          }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4F46E5', marginBottom: '0.125rem' }}>
              VOOM Ghana v1.0
            </p>
            <p style={{ fontSize: '0.65rem', color: '#94A3B8' }}>
              Early Stage · Mar 2026
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
