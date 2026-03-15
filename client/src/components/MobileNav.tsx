/**
 * MobileNav — Arctic Glass Design System
 * Fixed bottom tab bar for mobile navigation
 * Shows 5 primary sections as icon tabs
 */

interface MobileNavProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

const TABS = [
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
    id: 'vendors',
    label: 'Vendors',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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
    id: 'leads',
    label: 'Leads',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z"/>
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

export function MobileNav({ activeSection, onNavigate }: MobileNavProps) {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 60,
      background: 'rgba(255,255,255,0.92)',
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
      {TABS.map(tab => {
        const isActive = activeSection === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '6px 12px',
              borderRadius: '0.75rem',
              border: 'none',
              background: isActive ? 'rgba(79,70,229,0.1)' : 'transparent',
              color: isActive ? '#4F46E5' : '#94A3B8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              minWidth: 56,
            }}
          >
            {tab.icon}
            <span style={{
              fontSize: '0.625rem',
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
                bottom: 6,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: '#4F46E5',
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
