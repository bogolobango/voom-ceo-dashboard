/**
 * UserAnalyticsDrawer — Side panel with user activity details
 * Arctic Glass Design System — Sheet pattern
 */

import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { fetchUserDetail } from '../lib/voomApi';
import type { AnalyticsUser, UserActivityEvent } from '../lib/voomApi';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function getDisplayName(user: AnalyticsUser) {
  if (user.name) return user.name;
  if (user.email) return user.email.split('@')[0];
  return `User #${user.id}`;
}
function getInitials(user: AnalyticsUser) {
  const src = user.name || user.email || '';
  const parts = src.trim().split(/[\s@]/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return 'U';
}

const EVENT_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  product_view: { label: 'Viewed product', color: '#4F46E5', bg: 'rgba(79,70,229,0.1)', emoji: '👁' },
  search: { label: 'Searched', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', emoji: '🔍' },
  whatsapp_tap: { label: 'Tapped WhatsApp', color: '#059669', bg: 'rgba(5,150,105,0.1)', emoji: '💬' },
  wishlist_add: { label: 'Wishlisted', color: '#D97706', bg: 'rgba(217,119,6,0.1)', emoji: '♥' },
  cart_add: { label: 'Added to cart', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', emoji: '🛒' },
};

function ActivityTimeline({ events }: { events: UserActivityEvent[] }) {
  if (events.length === 0) {
    return <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem', padding: '1.5rem 0' }}>No activity recorded yet</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {events.slice(0, 60).map((evt, i) => {
        const cfg = EVENT_CONFIG[evt.eventType] || { label: evt.eventType, color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', emoji: '•' };
        const meta = evt.metadata as Record<string, unknown> | null;
        let detail = '';
        if (evt.productName) detail = evt.productName;
        else if (meta?.query) detail = `"${String(meta.query)}"`;
        return (
          <div key={evt.id} style={{
            display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
            padding: '0.625rem 0',
            borderBottom: i < Math.min(events.length, 60) - 1 ? '1px solid rgba(79,70,229,0.05)' : 'none',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: cfg.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem',
            }}>
              {cfg.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 500, color: '#0F172A' }}>
                {cfg.label}
                {detail && <span style={{ color: cfg.color, fontWeight: 600 }}> — {detail}</span>}
              </p>
              <p style={{ margin: '0.125rem 0 0', fontSize: '0.72rem', color: '#94A3B8' }}>
                {formatDateTime(evt.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Props { userId: number | null; onClose: () => void; }

export function UserAnalyticsDrawer({ userId, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: () => fetchUserDetail(userId!),
    enabled: userId !== null,
    staleTime: 60000,
  });

  const user = data?.user ?? null;
  const activity = data?.activity ?? [];

  const viewCount = activity.filter(e => e.eventType === 'product_view').length;
  const searchCount = activity.filter(e => e.eventType === 'search').length;
  const waTapCount = activity.filter(e => e.eventType === 'whatsapp_tap').length;

  return (
    <Sheet open={userId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" style={{ width: '100%', maxWidth: 480, padding: 0, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(79,70,229,0.15)', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : user ? (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <SheetHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.125rem', fontWeight: 700, color: '#fff',
                }}>
                  {getInitials(user)}
                </div>
                <div>
                  <SheetTitle style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: '1.125rem', margin: 0 }}>
                    {getDisplayName(user)}
                  </SheetTitle>
                  <p style={{ margin: '0.125rem 0 0', fontSize: '0.8rem', color: '#94A3B8' }}>{user.email || '—'}</p>
                </div>
              </div>
            </SheetHeader>

            {/* Info card */}
            <div style={{ background: 'rgba(79,70,229,0.04)', borderRadius: '1rem', padding: '1rem', border: '1px solid rgba(79,70,229,0.08)' }}>
              {[
                { label: 'Phone', value: user.phone || '—' },
                { label: 'Login method', value: user.loginMethod || '—' },
                { label: 'Verified', value: user.isVerified ? 'Yes' : 'No' },
                { label: 'Last sign-in', value: user.lastSignedIn ? formatDate(user.lastSignedIn) : '—' },
                { label: 'Joined', value: formatDate(user.createdAt) },
                { label: 'User ID', value: `#${user.id}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4375rem 0', borderBottom: '1px solid rgba(79,70,229,0.05)' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748B' }}>{label}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Activity summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
              {[
                { label: 'Product Views', value: viewCount, color: '#4F46E5' },
                { label: 'Searches', value: searchCount, color: '#0EA5E9' },
                { label: 'WA Taps', value: waTapCount, color: '#059669' },
              ].map(item => (
                <div key={item.label} style={{
                  background: `${item.color}08`, borderRadius: '0.875rem',
                  padding: '0.75rem', textAlign: 'center',
                  border: `1px solid ${item.color}15`,
                }}>
                  <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: item.color, fontFamily: 'Space Grotesk' }}>{item.value}</p>
                  <p style={{ margin: '0.125rem 0 0', fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</p>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '1rem', padding: '1rem', border: '1px solid rgba(79,70,229,0.08)' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                Activity Timeline{' '}
                <span style={{ fontWeight: 400, color: '#94A3B8' }}>({activity.length} events)</span>
              </p>
              <ActivityTimeline events={activity} />
            </div>
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
            <p>User not found.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
