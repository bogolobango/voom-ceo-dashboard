/**
 * Shared navigation configuration — single source of truth for Sidebar + MobileNav
 */

export interface NavItemConfig {
  id: string;
  label: string;
  description: string;
  color: string;
  bg: string;
  /** Which group: 'primary' items show in mobile tab bar, 'more' go in the slide-up sheet */
  mobileGroup: 'primary' | 'more';
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'briefing', label: 'Briefing', description: 'Daily morning briefing', color: '#4F46E5', bg: 'rgba(79,70,229,0.08)', mobileGroup: 'primary' },
  { id: 'overview', label: 'Overview', description: 'Dashboard KPI overview', color: '#4F46E5', bg: 'rgba(79,70,229,0.08)', mobileGroup: 'primary' },
  { id: 'vendors', label: 'Vendors', description: 'Vendor pipeline & approvals', color: '#4F46E5', bg: 'rgba(79,70,229,0.08)', mobileGroup: 'more' },
  { id: 'products', label: 'Products', description: 'Catalog, categories & inventory', color: '#D97706', bg: 'rgba(217,119,6,0.08)', mobileGroup: 'more' },
  { id: 'orders', label: 'Orders', description: 'Order management & status', color: '#059669', bg: 'rgba(5,150,105,0.08)', mobileGroup: 'primary' },
  { id: 'revenue', label: 'Revenue', description: 'GMV trends & financial metrics', color: '#059669', bg: 'rgba(5,150,105,0.08)', mobileGroup: 'more' },
  { id: 'part-requests', label: 'Part Requests', description: 'Buyer part requests', color: '#D97706', bg: 'rgba(217,119,6,0.08)', mobileGroup: 'primary' },
  { id: 'growth', label: 'Growth', description: 'Growth metrics & milestones', color: '#059669', bg: 'rgba(5,150,105,0.08)', mobileGroup: 'primary' },
  { id: 'crm', label: 'Outreach CRM', description: 'Vendor outreach pipeline', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', mobileGroup: 'more' },
  { id: 'security', label: 'Security', description: 'CISO view & compliance', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', mobileGroup: 'more' },
  { id: 'competitive', label: 'Competitive', description: 'Market intelligence', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)', mobileGroup: 'more' },
  { id: 'analytics', label: 'Analytics', description: 'Users, product views & funnels', color: '#4F46E5', bg: 'rgba(79,70,229,0.08)', mobileGroup: 'more' },
  { id: 'verification', label: 'Doc Review', description: 'Verify vendor identity documents', color: '#E11D48', bg: 'rgba(225,29,72,0.08)', mobileGroup: 'more' },
  { id: 'expansion', label: 'Expansion', description: 'Pan-Africa market expansion', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)', mobileGroup: 'more' },
  { id: 'reports', label: 'Reports', description: 'Investor snapshots & exports', color: '#4F46E5', bg: 'rgba(79,70,229,0.08)', mobileGroup: 'more' },
];

// Settings is handled separately in the sidebar footer, not in the main nav list
export const SETTINGS_ITEM: NavItemConfig = {
  id: 'settings', label: 'Settings', description: 'Dashboard configuration', color: '#64748B', bg: 'rgba(100,116,139,0.08)', mobileGroup: 'more',
};
