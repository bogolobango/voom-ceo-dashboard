/**
 * MobileNav — Arctic Glass Design System
 * Fixed bottom tab bar for mobile navigation
 * Primary tabs: Overview · Orders · Leads · Growth · More
 * "More" opens a slide-up glass sheet with: Vendors · Revenue · Products
 */

import { useState } from 'react';

interface MobileNavProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

const PRIMARY_TABS = [
  {
    id: 'briefing',
    label: 'Briefing',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    id: 'part-requests',
    label: 'Parts',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    id: 'growth',
    label: 'Growth',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
];

const MORE_ITEMS = [
  {
    id: 'vendors',
    label: 'Vendors',
    description: 'Vendor pipeline & approvals',
    color: '#4F46E5',
    bg: 'rgba(79,70,229,0.08)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: 'revenue',
    label: 'Revenue',
    description: 'GMV trends & financial metrics',
    color: '#059669',
    bg: 'rgba(5,150,105,0.08)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    id: 'products',
    label: 'Products',
    description: 'Catalog, categories & inventory',
    color: '#D97706',
    bg: 'rgba(217,119,6,0.08)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'crm',
    label: 'Outreach CRM',
    description: 'Vendor outreach pipeline',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.08)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/>
      </svg>
    ),
  },
  {
    id: 'security',
    label: 'Security',
    description: 'CISO view & compliance',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.08)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    id: 'competitive',
    label: 'Competitive',
    description: 'Market intelligence',
    color: '#0EA5E9',
    bg: 'rgba(14,165,233,0.08)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Users, product views & funnels',
    color: '#4F46E5',
    bg: 'rgba(79,70,229,0.08)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
];

export function MobileNav({ activeSection, onNavigate }: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = ['vendors', 'revenue', 'products', 'crm', 'security', 'competitive', 'analytics'].includes(activeSection);

  const handleMoreItemClick = (id: string) => {
    onNavigate(id);
    setMoreOpen(false);
  };

  return (
    <>
      {/* Backdrop overlay when More sheet is open */}
      <div
        onClick={() => setMoreOpen(false)}
        onTouchEnd={(e) => { e.preventDefault(); setMoreOpen(false); }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 58,
          background: 'rgba(15,23,42,0.25)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: moreOpen ? 1 : 0,
          pointerEvents: moreOpen ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* More slide-up sheet */}
      <div
        role="dialog"
        aria-modal={moreOpen}
        aria-label="More sections"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 68,
          zIndex: 59,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          borderTop: '1px solid rgba(79,70,229,0.1)',
          borderRadius: '1.5rem 1.5rem 0 0',
          boxShadow: '0 -8px 40px rgba(79,70,229,0.1)',
          padding: '1rem 1.25rem 1.25rem',
          transform: moreOpen ? 'translateY(0)' : 'translateY(120%)',
          pointerEvents: moreOpen ? 'auto' : 'none',
          transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)',
          willChange: 'transform',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36,
          height: 4,
          borderRadius: 999,
          background: 'rgba(79,70,229,0.15)',
          margin: '0 auto 1rem',
        }} />

        <p style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#94A3B8',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          marginBottom: '0.75rem',
        }}>
          More Sections
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxHeight: '55vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '0.5rem',
        }}>
          {MORE_ITEMS.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleMoreItemClick(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.875rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '1rem',
                  border: isActive ? `1.5px solid ${item.color}30` : '1.5px solid transparent',
                  background: isActive ? item.bg : 'rgba(248,250,252,0.8)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
              >
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: '0.75rem',
                  background: item.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: item.color,
                  flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    color: isActive ? item.color : '#0F172A',
                    margin: 0,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                  }}>
                    {item.label}
                  </p>
                  <p style={{
                    fontSize: '0.72rem',
                    color: '#94A3B8',
                    margin: 0,
                    marginTop: '0.125rem',
                  }}>
                    {item.description}
                  </p>
                </div>
                {isActive && (
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: item.color,
                    flexShrink: 0,
                  }} />
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isActive ? item.color : '#CBD5E1'} strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid rgba(79,70,229,0.08)',
        boxShadow: '0 -4px 24px rgba(79,70,229,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        paddingTop: '6px',
        height: 68,
      }}>
        {PRIMARY_TABS.map(tab => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setMoreOpen(false); onNavigate(tab.id); }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                padding: '6px 10px',
                borderRadius: '0.75rem',
                border: 'none',
                background: isActive ? 'rgba(79,70,229,0.1)' : 'transparent',
                color: isActive ? '#4F46E5' : '#94A3B8',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                minWidth: 52,
                position: 'relative',
              }}
            >
              {tab.icon}
              <span style={{
                fontSize: '0.6rem',
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                letterSpacing: '0.01em',
                lineHeight: 1,
              }}>
                {tab.label}
              </span>
              {isActive && (
                <div style={{
                  position: 'absolute',
                  bottom: 4,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: '#4F46E5',
                }} />
              )}
            </button>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(prev => !prev)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            padding: '6px 10px',
            borderRadius: '0.75rem',
            border: 'none',
            background: (isMoreActive || moreOpen) ? 'rgba(79,70,229,0.1)' : 'transparent',
            color: (isMoreActive || moreOpen) ? '#4F46E5' : '#94A3B8',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            minWidth: 52,
            position: 'relative',
          }}
        >
          {/* More icon — 3 dots grid */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
          <span style={{
            fontSize: '0.6rem',
            fontWeight: (isMoreActive || moreOpen) ? 700 : 500,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            letterSpacing: '0.01em',
            lineHeight: 1,
          }}>
            More
          </span>
          {isMoreActive && !moreOpen && (
            <div style={{
              position: 'absolute',
              bottom: 4,
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: '#4F46E5',
            }} />
          )}
        </button>
      </nav>
    </>
  );
}
