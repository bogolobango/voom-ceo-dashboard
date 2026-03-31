/**
 * VendorDetailDrawer — Side panel with vendor details
 * 4 tabs: Overview, Documents, Orders & Payments, Activity Log
 * Uses Sheet (Radix Dialog) + Arctic Glass inline styles
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from './ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import type {
  VendorDetail, VendorOrder, VendorPayout, VendorNotification,
  VendorSubscriptionEvent,
} from '../lib/voomApi';
import {
  fetchVendorDetail, fetchVendorOrders, fetchVendorPayouts,
  fetchVendorNotifications, fetchVendorSubscriptionEvents,
  updateVendorStatus, updateVendorTier, updateVendorFeatured,
  sendVendorNotification, fetchAnalyticsUsers, verifyUser, updateUserRole, reviewVendorDocs,
  updateVendorProfile,
} from '../lib/voomApi';

// ─── Status / Tier Helpers ───

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  approved: { bg: 'rgba(5,150,105,0.1)', color: '#059669', label: 'Approved' },
  pending: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', label: 'Pending' },
  rejected: { bg: 'rgba(225,29,72,0.1)', color: '#E11D48', label: 'Rejected' },
  suspended: { bg: 'rgba(100,116,139,0.1)', color: '#64748B', label: 'Suspended' },
};

const TIER_COLORS: Record<string, string> = {
  free: '#94A3B8',
  starter: '#4F46E5',
  pro: '#0EA5E9',
  business: '#D97706',
  enterprise: '#059669',
};

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 600,
      background: st.bg, color: st.color,
      padding: '0.2rem 0.6rem', borderRadius: 999,
    }}>{st.label}</span>
  );
}

function formatCedi(amount: string | number) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return 'GH₵ 0.00';
  return `GH₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Small reusable pieces ───

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(79,70,229,0.06)' }}>
      <span style={{ fontSize: '0.8125rem', color: '#64748B' }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.6)',
      backdropFilter: 'blur(12px)',
      borderRadius: '0.875rem',
      border: '1px solid rgba(79,70,229,0.08)',
      padding: '1rem',
      marginBottom: '0.75rem',
    }}>
      <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.75rem 0', fontFamily: 'Plus Jakarta Sans' }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94A3B8', fontSize: '0.8125rem' }}>
      {message}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
      <div style={{
        width: 24, height: 24, border: '2px solid rgba(79,70,229,0.15)',
        borderTopColor: '#4F46E5', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}

// ─── Linked User Account ───

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  vendor: { bg: 'rgba(79,70,229,0.1)', color: '#4F46E5' },
  user:   { bg: 'rgba(14,165,233,0.1)', color: '#0EA5E9' },
  driver: { bg: 'rgba(217,119,6,0.1)',  color: '#D97706' },
  admin:  { bg: 'rgba(5,150,105,0.1)',  color: '#059669' },
};

function LinkedUserAccount({ phone }: { phone: string | undefined }) {
  const queryClient = useQueryClient();
  const [verifyDone, setVerifyDone] = useState(false);
  const [localRole, setLocalRole] = useState<string | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ['analytics-users'],
    queryFn: fetchAnalyticsUsers,
    staleTime: 120000,
  });

  const linkedUser = users.find(u => u.phone && phone && u.phone.replace(/\s/g, '') === phone.replace(/\s/g, ''));

  const verifyMutation = useMutation({
    mutationFn: () => verifyUser(linkedUser!.id),
    onSuccess: () => {
      setVerifyDone(true);
      queryClient.invalidateQueries({ queryKey: ['analytics-users'] });
    },
  });

  const roleMutation = useMutation({
    mutationFn: (role: string) => updateUserRole(linkedUser!.id, role),
    onSuccess: (_ok, role) => {
      setLocalRole(role);
      queryClient.invalidateQueries({ queryKey: ['analytics-users'] });
    },
  });

  if (!linkedUser) return null;

  const currentRole = localRole ?? linkedUser.role ?? 'user';
  const roleStyle = ROLE_COLORS[currentRole] || { bg: 'rgba(100,116,139,0.1)', color: '#64748B' };
  const targetRole = currentRole === 'vendor' ? 'user' : 'vendor';

  const isUnverified = !linkedUser.isVerified && !verifyDone;
  const justVerified = verifyDone || (linkedUser.isVerified && verifyMutation.isSuccess);

  return (
    <SectionCard title="User Login Account">
      <InfoRow label="Name" value={linkedUser.name || '—'} />
      <InfoRow label="Email" value={linkedUser.email || '—'} />
      <InfoRow label="Login method" value={linkedUser.loginMethod || '—'} />
      <InfoRow label="Last sign-in" value={linkedUser.lastSignedIn ? new Date(linkedUser.lastSignedIn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'} />
      <InfoRow
        label="Role"
        value={
          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999, background: roleStyle.bg, color: roleStyle.color, textTransform: 'capitalize' }}>
            {currentRole}
          </span>
        }
      />
      <InfoRow
        label="Account status"
        value={
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 999,
            background: (linkedUser.isVerified || verifyDone) ? 'rgba(5,150,105,0.1)' : 'rgba(225,29,72,0.1)',
            color: (linkedUser.isVerified || verifyDone) ? '#059669' : '#E11D48',
          }}>
            {(linkedUser.isVerified || verifyDone) ? '✓ Verified' : '✗ Not verified'}
          </span>
        }
      />

      {/* Role switcher */}
      <div style={{ marginTop: '0.625rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => roleMutation.mutate(targetRole)}
          disabled={roleMutation.isPending}
          style={{
            flex: 1, padding: '0.4375rem 0.875rem', borderRadius: '0.5rem',
            border: '1.5px solid rgba(79,70,229,0.25)',
            background: 'rgba(79,70,229,0.05)', color: '#4F46E5',
            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
            opacity: roleMutation.isPending ? 0.6 : 1, fontFamily: 'Plus Jakarta Sans',
          }}
        >
          {roleMutation.isPending ? 'Updating…' : `Switch to ${targetRole.charAt(0).toUpperCase() + targetRole.slice(1)}`}
        </button>
        {isUnverified && (
          <button
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            style={{
              flex: 1, padding: '0.4375rem 0.875rem', borderRadius: '0.5rem', border: 'none',
              background: '#E11D48', color: '#fff', fontSize: '0.75rem', fontWeight: 700,
              cursor: 'pointer', opacity: verifyMutation.isPending ? 0.6 : 1,
              fontFamily: 'Plus Jakarta Sans',
            }}
          >
            {verifyMutation.isPending ? 'Verifying…' : 'Verify Account'}
          </button>
        )}
      </div>
      {roleMutation.isSuccess && (
        <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: '#4F46E5', fontWeight: 600 }}>✓ Role updated to {currentRole}.</p>
      )}
      {justVerified && (
        <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>✅ Account verified — user can now log in.</p>
      )}
    </SectionCard>
  );
}

// ─── Tab: Overview ───

function OverviewTab({ vendor }: { vendor: VendorDetail }) {
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [tierGranted, setTierGranted] = useState(false);
  const queryClient = useQueryClient();

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editForm, setEditForm] = useState({
    businessName: vendor.businessName,
    phone: vendor.phone,
    whatsapp: vendor.whatsapp ?? '',
    email: vendor.email ?? '',
    address: vendor.address ?? '',
    ghanaCardNumber: vendor.ghanaCardNumber ?? '',
  });

  const setField = (k: keyof typeof editForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm(f => ({ ...f, [k]: e.target.value }));

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError('');
    const ok = await updateVendorProfile(vendor.id, {
      businessName: editForm.businessName || undefined,
      phone: editForm.phone || undefined,
      whatsapp: editForm.whatsapp || undefined,
      email: editForm.email || undefined,
      address: editForm.address || undefined,
      ghanaCardNumber: editForm.ghanaCardNumber || undefined,
    });
    setSaving(false);
    if (ok) {
      setIsEditing(false);
      setSaveError('');
      queryClient.invalidateQueries({ queryKey: ['vendorDetail', vendor.id] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    } else {
      setSaveError('Failed to save. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError('');
    setEditForm({
      businessName: vendor.businessName,
      phone: vendor.phone,
      whatsapp: vendor.whatsapp ?? '',
      email: vendor.email ?? '',
      address: vendor.address ?? '',
      ghanaCardNumber: vendor.ghanaCardNumber ?? '',
    });
  };

  const handleStatusChange = useCallback(async (newStatus: string) => {
    setStatusUpdating(true);
    const ok = await updateVendorStatus(vendor.id, newStatus);
    if (ok) {
      queryClient.invalidateQueries({ queryKey: ['vendorDetail', vendor.id] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    }
    setStatusUpdating(false);
  }, [vendor.id, queryClient]);

  const tierGrantMutation = useMutation({
    mutationFn: () => {
      const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      return updateVendorTier(vendor.id, 'pro', oneYearFromNow);
    },
    onSuccess: () => {
      setTierGranted(true);
      queryClient.invalidateQueries({ queryKey: ['vendorDetail', vendor.id] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });

  const tierColor = TIER_COLORS[vendor.tier] || '#94A3B8';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* ── Pending Review Banner ──────────────────────────────────────── */}
      {vendor.status === 'pending' && (
        <div style={{
          borderRadius: '1rem',
          border: '1.5px solid rgba(217,119,6,0.25)',
          background: 'linear-gradient(135deg, rgba(254,243,199,0.9) 0%, rgba(255,237,213,0.9) 100%)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '0.875rem 1rem 0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1rem' }}>⏳</span>
              <p style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: '0.9375rem', color: '#92400E', margin: 0 }}>
                Pending Approval
              </p>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#B45309', margin: 0 }}>
              Review this vendor before approving them to list on VOOM Ghana.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '0.75rem 1rem 1rem' }}>
            <button
              disabled={statusUpdating}
              onClick={() => handleStatusChange('rejected')}
              style={{
                padding: '0.7rem', borderRadius: '0.625rem',
                border: '1.5px solid rgba(225,29,72,0.25)',
                background: 'rgba(255,255,255,0.8)',
                color: '#E11D48', fontWeight: 700, fontSize: '0.875rem',
                cursor: statusUpdating ? 'not-allowed' : 'pointer',
                fontFamily: 'Plus Jakarta Sans',
                opacity: statusUpdating ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Reject
            </button>
            <button
              disabled={statusUpdating}
              onClick={() => handleStatusChange('approved')}
              style={{
                padding: '0.7rem', borderRadius: '0.625rem', border: 'none',
                background: statusUpdating ? 'rgba(5,150,105,0.5)' : 'linear-gradient(135deg,#059669 0%,#10B981 100%)',
                color: 'white', fontWeight: 700, fontSize: '0.875rem',
                cursor: statusUpdating ? 'not-allowed' : 'pointer',
                fontFamily: 'Plus Jakarta Sans',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
              }}
            >
              {statusUpdating ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              {statusUpdating ? 'Updating…' : 'Approve'}
            </button>
          </div>
        </div>
      )}

      {/* ── Approved / Rejected confirmation banner ───────────────────── */}
      {(vendor.status === 'approved' || vendor.status === 'rejected' || vendor.status === 'suspended') && (
        <div style={{
          padding: '0.625rem 0.875rem',
          borderRadius: '0.75rem',
          border: `1px solid ${STATUS_STYLES[vendor.status]?.color}33`,
          background: STATUS_STYLES[vendor.status]?.bg,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_STYLES[vendor.status]?.color, flexShrink: 0 }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: STATUS_STYLES[vendor.status]?.color }}>
            {STATUS_STYLES[vendor.status]?.label}
            {vendor.status === 'approved' ? ' — Active on VOOM Ghana' : vendor.status === 'rejected' ? ' — Not approved to list' : ' — Account suspended'}
          </span>
        </div>
      )}

      {/* Vendor header card */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        padding: '1rem', borderRadius: '0.875rem',
        background: 'linear-gradient(135deg, rgba(79,70,229,0.06) 0%, rgba(79,70,229,0.02) 100%)',
        border: '1px solid rgba(79,70,229,0.08)',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '0.75rem', flexShrink: 0,
          background: `hsl(${(vendor.id * 47) % 360}, 65%, 92%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.25rem', fontWeight: 800,
          color: `hsl(${(vendor.id * 47) % 360}, 55%, 40%)`,
        }}>
          {vendor.businessName.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
            {vendor.businessName}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.125rem 0 0 0' }}>
            {vendor.city || 'Unknown'}{vendor.region ? `, ${vendor.region}` : ''}
          </p>
        </div>
        <StatusBadge status={vendor.status} />
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
        {[
          { label: 'Revenue', value: formatCedi(vendor.totalRevenue) },
          { label: 'Orders', value: vendor.totalOrders.toString() },
          { label: 'Listings', value: vendor.totalListings.toString() },
        ].map(s => (
          <div key={s.label} style={{
            padding: '0.75rem', borderRadius: '0.75rem', textAlign: 'center',
            background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(79,70,229,0.06)',
          }}>
            <p style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0, fontFamily: 'Space Grotesk' }}>{s.value}</p>
            <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: '0.125rem 0 0 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Contact info — editable */}
      <div style={{
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(12px)',
        borderRadius: '0.875rem',
        border: '1px solid rgba(79,70,229,0.08)',
        padding: '1rem',
        marginBottom: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
            Contact
          </h4>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.3rem 0.625rem', borderRadius: '0.5rem',
                border: '1.5px solid rgba(79,70,229,0.2)',
                background: 'rgba(79,70,229,0.04)',
                color: '#4F46E5', fontSize: '0.72rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Plus Jakarta Sans',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: '0.3rem 0.625rem', borderRadius: '0.5rem',
                  border: '1.5px solid rgba(100,116,139,0.2)',
                  background: 'transparent', color: '#64748B',
                  fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Plus Jakarta Sans',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                style={{
                  padding: '0.3rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                  background: saving ? 'rgba(5,150,105,0.5)' : '#059669',
                  color: 'white', fontSize: '0.72rem', fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'Plus Jakarta Sans',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {saveError && (
          <div style={{ marginBottom: '0.625rem', fontSize: '0.75rem', color: '#E11D48', background: 'rgba(225,29,72,0.05)', padding: '0.375rem 0.625rem', borderRadius: '0.5rem' }}>
            {saveError}
          </div>
        )}

        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {([
              { key: 'businessName', label: 'Business Name', type: 'text' },
              { key: 'phone', label: 'Phone', type: 'tel' },
              { key: 'whatsapp', label: 'WhatsApp', type: 'tel' },
              { key: 'email', label: 'Email', type: 'email' },
              { key: 'address', label: 'Address', type: 'text' },
              { key: 'ghanaCardNumber', label: 'Ghana Card No.', type: 'text' },
            ] as const).map(({ key, label, type }) => (
              <div key={key}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                  {label}
                </label>
                <input
                  type={type}
                  value={editForm[key]}
                  onChange={setField(key)}
                  style={{
                    width: '100%', padding: '0.5rem 0.75rem', boxSizing: 'border-box',
                    borderRadius: '0.5rem', border: '1.5px solid rgba(79,70,229,0.15)',
                    background: 'rgba(248,250,252,0.9)', fontSize: '0.8125rem', color: '#0F172A',
                    outline: 'none', fontFamily: 'Plus Jakarta Sans',
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <>
            <InfoRow label="Phone" value={vendor.phone} />
            {vendor.whatsapp && <InfoRow label="WhatsApp" value={vendor.whatsapp} />}
            {vendor.email && <InfoRow label="Email" value={vendor.email} />}
            {vendor.address && <InfoRow label="Address" value={vendor.address} />}
            {vendor.ghanaCardNumber && <InfoRow label="Ghana Card" value={vendor.ghanaCardNumber} />}
          </>
        )}
      </div>

      {/* Subscription */}
      <SectionCard title="Subscription">
        <InfoRow label="Tier" value={
          <span style={{ color: tierColor, fontWeight: 700, textTransform: 'capitalize' }}>{vendor.tier}</span>
        } />
        {vendor.tierExpiresAt && <InfoRow label="Expires" value={formatDate(vendor.tierExpiresAt)} />}
        <InfoRow label="Trial Used" value={vendor.tierTrialUsed ? 'Yes' : 'No'} />
        <InfoRow label="Featured" value={vendor.isFeatured ? 'Yes' : 'No'} />
        {vendor.featuredUntil && <InfoRow label="Featured Until" value={formatDate(vendor.featuredUntil)} />}
      </SectionCard>

      {/* Metadata */}
      <SectionCard title="Account">
        <InfoRow label="Vendor ID" value={`#${vendor.id}`} />
        <InfoRow label="Rating" value={vendor.rating ? `★ ${vendor.rating}` : '—'} />
        <InfoRow label="Verified" value={vendor.verified ? '✓ Verified' : 'Not verified'} />
        <InfoRow label="Joined" value={formatDate(vendor.createdAt)} />
        <InfoRow label="Last Updated" value={formatDate(vendor.updatedAt)} />
      </SectionCard>

      {/* Admin Actions */}
      <SectionCard title="Admin Actions">
        <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0 0 0.5rem 0' }}>Change vendor status:</p>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {(['approved', 'pending', 'rejected', 'suspended'] as const).map(s => (
            <button
              key={s}
              disabled={vendor.status === s || statusUpdating}
              onClick={() => handleStatusChange(s)}
              style={{
                padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                fontSize: '0.75rem', fontWeight: 600, cursor: vendor.status === s ? 'default' : 'pointer',
                background: vendor.status === s ? STATUS_STYLES[s].bg : 'rgba(241,245,249,0.8)',
                color: vendor.status === s ? STATUS_STYLES[s].color : '#64748B',
                opacity: statusUpdating ? 0.5 : 1,
                fontFamily: 'Plus Jakarta Sans',
              }}
            >
              {STATUS_STYLES[s].label}
            </button>
          ))}
        </div>

        {/* Tier quick action */}
        <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid rgba(79,70,229,0.07)' }}>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0 0 0.5rem 0' }}>Subscription quick actions:</p>
          {tierGranted ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(14,165,233,0.08)', borderRadius: '0.5rem', border: '1px solid rgba(14,165,233,0.2)' }}>
              <span style={{ fontSize: '0.9rem' }}>🎉</span>
              <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: '#0EA5E9' }}>Pro tier granted — free for 1 year. Expires {new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.</p>
            </div>
          ) : (
            <button
              onClick={() => tierGrantMutation.mutate()}
              disabled={tierGrantMutation.isPending || vendor.tier === 'pro'}
              style={{
                width: '100%', padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
                border: '1.5px solid rgba(14,165,233,0.3)',
                background: vendor.tier === 'pro' ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.08)',
                color: '#0EA5E9', fontSize: '0.75rem', fontWeight: 700,
                cursor: (tierGrantMutation.isPending || vendor.tier === 'pro') ? 'default' : 'pointer',
                opacity: tierGrantMutation.isPending ? 0.6 : 1,
                fontFamily: 'Plus Jakarta Sans', textAlign: 'left',
              }}
            >
              {vendor.tier === 'pro' && !tierGranted ? '✓ Already on Pro tier' : tierGrantMutation.isPending ? 'Granting…' : '🎁 Grant 1-Year Pro (Free)'}
            </button>
          )}
        </div>
      </SectionCard>

      {/* Linked user login account */}
      <LinkedUserAccount phone={vendor.phone} />
    </div>
  );
}

// ─── Tab: Documents ───

function DocumentsTab({ vendor }: { vendor: VendorDetail }) {
  const queryClient = useQueryClient();
  const [localVerified, setLocalVerified] = useState<boolean | null>(null);

  const reviewMutation = useMutation({
    mutationFn: (approved: boolean) => reviewVendorDocs(vendor.id, approved),
    onSuccess: (_ok, approved) => {
      setLocalVerified(approved);
      queryClient.invalidateQueries({ queryKey: ['vendorDetail', vendor.id] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['verification-queue'] });
    },
  });

  const isVerified = localVerified !== null ? localVerified : vendor.verified;

  const docs = [
    { label: 'Ghana Card Number', value: vendor.ghanaCardNumber, type: 'text' as const },
    { label: 'ID Document', value: vendor.idDocumentUrl, type: 'url' as const },
    { label: 'Business Registration', value: vendor.businessRegUrl, type: 'url' as const },
    { label: 'Logo', value: vendor.logoUrl, type: 'url' as const },
    { label: 'Cover Image', value: vendor.coverUrl, type: 'url' as const },
  ];

  const hasAny = docs.some(d => d.value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <SectionCard title="Verification Documents">
        {!hasAny ? (
          <EmptyState message="No documents uploaded yet" />
        ) : (
          docs.map(d => (
            d.value ? (
              <InfoRow
                key={d.label}
                label={d.label}
                value={
                  d.type === 'url' ? (
                    <a href={d.value} target="_blank" rel="noreferrer" style={{ color: '#4F46E5', textDecoration: 'none', fontSize: '0.8125rem' }}>
                      View ↗
                    </a>
                  ) : d.value
                }
              />
            ) : null
          ))
        )}
      </SectionCard>

      <SectionCard title="Verification Status">
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem', borderRadius: '0.625rem',
          background: isVerified ? 'rgba(5,150,105,0.08)' : (localVerified === false ? 'rgba(225,29,72,0.08)' : 'rgba(217,119,6,0.08)'),
        }}>
          <span style={{ fontSize: '1.25rem' }}>
            {isVerified ? '✓' : localVerified === false ? '✗' : '⏳'}
          </span>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: isVerified ? '#059669' : (localVerified === false ? '#E11D48' : '#D97706'), margin: 0 }}>
              {isVerified ? 'Identity Verified' : localVerified === false ? 'Documents Rejected' : 'Pending Verification'}
            </p>
            <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0.125rem 0 0 0' }}>
              {isVerified ? 'Documents have been reviewed and approved' : localVerified === false ? 'Vendor has been notified. Account status set to rejected.' : 'Documents are awaiting your review'}
            </p>
          </div>
        </div>

        {/* Review actions — only show when there are docs and not yet verified */}
        {hasAny && !isVerified && localVerified !== false && (
          <div style={{ marginTop: '0.875rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              onClick={() => reviewMutation.mutate(false)}
              disabled={reviewMutation.isPending}
              style={{
                padding: '0.625rem', borderRadius: '0.625rem',
                border: '1.5px solid rgba(225,29,72,0.25)',
                background: 'rgba(225,29,72,0.05)', color: '#E11D48',
                fontSize: '0.8125rem', fontWeight: 700,
                cursor: reviewMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: reviewMutation.isPending ? 0.5 : 1,
                fontFamily: 'Plus Jakarta Sans',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Reject Docs
            </button>
            <button
              onClick={() => reviewMutation.mutate(true)}
              disabled={reviewMutation.isPending}
              style={{
                padding: '0.625rem', borderRadius: '0.625rem', border: 'none',
                background: reviewMutation.isPending ? 'rgba(5,150,105,0.5)' : 'linear-gradient(135deg, #059669, #10B981)',
                color: '#fff', fontSize: '0.8125rem', fontWeight: 700,
                cursor: reviewMutation.isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'Plus Jakarta Sans', boxShadow: '0 2px 8px rgba(5,150,105,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
              }}
            >
              {reviewMutation.isPending ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              Approve Docs
            </button>
          </div>
        )}

        {/* Re-review option if already verified */}
        {isVerified && (
          <button
            onClick={() => reviewMutation.mutate(false)}
            disabled={reviewMutation.isPending}
            style={{
              marginTop: '0.75rem', width: '100%', padding: '0.5rem',
              borderRadius: '0.5rem', border: '1.5px solid rgba(225,29,72,0.2)',
              background: 'transparent', color: '#94A3B8', fontSize: '0.72rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Plus Jakarta Sans',
            }}
          >
            Revoke Verification
          </button>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Tab: Orders & Payments ───

function OrdersPaymentsTab({ vendorId }: { vendorId: number }) {
  const ordersQ = useQuery({ queryKey: ['vendorOrders', vendorId], queryFn: () => fetchVendorOrders(vendorId) });
  const payoutsQ = useQuery({ queryKey: ['vendorPayouts', vendorId], queryFn: () => fetchVendorPayouts(vendorId) });

  const orders = ordersQ.data ?? [];
  const payouts = payoutsQ.data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <SectionCard title={`Orders (${orders.length})`}>
        {ordersQ.isLoading ? <Spinner /> : orders.length === 0 ? (
          <EmptyState message="No orders found" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {orders.slice(0, 20).map(o => (
              <div key={o.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
                background: 'rgba(248,250,252,0.6)',
              }}>
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                    #{o.orderNumber}
                  </p>
                  <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: '0.125rem 0 0 0' }}>
                    {formatDate(o.createdAt)} · {o.buyerName || 'Unknown buyer'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', margin: 0, fontFamily: 'Space Grotesk' }}>
                    {formatCedi(o.totalAmount)}
                  </p>
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase',
                    color: o.status === 'completed' ? '#059669' : o.status === 'cancelled' ? '#E11D48' : '#D97706',
                  }}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
            {orders.length > 20 && (
              <p style={{ fontSize: '0.72rem', color: '#94A3B8', textAlign: 'center', margin: '0.5rem 0 0 0' }}>
                Showing 20 of {orders.length} orders
              </p>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Payouts (${payouts.length})`}>
        {payoutsQ.isLoading ? <Spinner /> : payouts.length === 0 ? (
          <EmptyState message="No payouts recorded" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {payouts.slice(0, 20).map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
                background: 'rgba(248,250,252,0.6)',
              }}>
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                    {p.type === 'payout' ? 'Payout' : p.type}
                  </p>
                  <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: '0.125rem 0 0 0' }}>
                    {formatDate(p.createdAt)}{p.flutterwaveRef ? ` · Ref: ${p.flutterwaveRef}` : ''}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', margin: 0, fontFamily: 'Space Grotesk' }}>
                    {formatCedi(p.amount)}
                  </p>
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase',
                    color: p.status === 'completed' ? '#059669' : p.status === 'failed' ? '#E11D48' : '#D97706',
                  }}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Tab: Activity Log ───

function ActivityTab({ vendorId }: { vendorId: number }) {
  const notifQ = useQuery({ queryKey: ['vendorNotifications', vendorId], queryFn: () => fetchVendorNotifications(vendorId) });
  const eventsQ = useQuery({ queryKey: ['vendorSubEvents', vendorId], queryFn: () => fetchVendorSubscriptionEvents(vendorId) });
  const queryClient = useQueryClient();

  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');

  const sendMutation = useMutation({
    mutationFn: () => sendVendorNotification(vendorId, notifTitle, notifMsg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorNotifications', vendorId] });
      setNotifTitle('');
      setNotifMsg('');
    },
  });

  const notifications = notifQ.data ?? [];
  const events = eventsQ.data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Send notification form */}
      <SectionCard title="Send Notification">
        <input
          value={notifTitle}
          onChange={e => setNotifTitle(e.target.value)}
          placeholder="Title..."
          style={{
            width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
            border: '1px solid rgba(79,70,229,0.12)', background: 'rgba(255,255,255,0.8)',
            fontSize: '0.8125rem', marginBottom: '0.375rem', boxSizing: 'border-box',
            outline: 'none', color: '#0F172A',
          }}
        />
        <textarea
          value={notifMsg}
          onChange={e => setNotifMsg(e.target.value)}
          placeholder="Message..."
          rows={2}
          style={{
            width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
            border: '1px solid rgba(79,70,229,0.12)', background: 'rgba(255,255,255,0.8)',
            fontSize: '0.8125rem', marginBottom: '0.5rem', boxSizing: 'border-box',
            resize: 'vertical', outline: 'none', color: '#0F172A', fontFamily: 'inherit',
          }}
        />
        <button
          disabled={!notifTitle.trim() || !notifMsg.trim() || sendMutation.isPending}
          onClick={() => sendMutation.mutate()}
          style={{
            padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
            background: '#4F46E5', color: 'white', fontSize: '0.8125rem', fontWeight: 600,
            cursor: !notifTitle.trim() || !notifMsg.trim() ? 'not-allowed' : 'pointer',
            opacity: !notifTitle.trim() || !notifMsg.trim() ? 0.5 : 1,
            fontFamily: 'Plus Jakarta Sans',
          }}
        >
          {sendMutation.isPending ? 'Sending...' : 'Send'}
        </button>
      </SectionCard>

      {/* Notifications */}
      <SectionCard title={`Notifications (${notifications.length})`}>
        {notifQ.isLoading ? <Spinner /> : notifications.length === 0 ? (
          <EmptyState message="No notifications sent" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {notifications.slice(0, 15).map(n => (
              <div key={n.id} style={{
                padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
                background: n.read ? 'rgba(248,250,252,0.6)' : 'rgba(79,70,229,0.04)',
                borderLeft: n.read ? 'none' : '3px solid #4F46E5',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>{n.title}</p>
                  <span style={{ fontSize: '0.62rem', color: '#94A3B8', flexShrink: 0, marginLeft: '0.5rem' }}>{formatDate(n.createdAt)}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>{n.message}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Subscription events */}
      <SectionCard title={`Subscription Events (${events.length})`}>
        {eventsQ.isLoading ? <Spinner /> : events.length === 0 ? (
          <EmptyState message="No subscription events" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {events.slice(0, 15).map(ev => (
              <div key={ev.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
                background: 'rgba(248,250,252,0.6)',
              }}>
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', margin: 0, textTransform: 'capitalize' }}>
                    {ev.event.replace(/_/g, ' ')}
                  </p>
                  <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: '0.125rem 0 0 0' }}>
                    {ev.fromTier && ev.toTier ? `${ev.fromTier} → ${ev.toTier}` : formatDate(ev.createdAt)}
                  </p>
                </div>
                {ev.amount && (
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                    {formatCedi(ev.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Main Drawer ───

interface VendorDetailDrawerProps {
  vendorId: number | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  initialTab?: string;
}

export function VendorDetailDrawer({ vendorId, open: openProp, onOpenChange, onClose, initialTab }: VendorDetailDrawerProps) {
  const isOpen = openProp !== undefined ? openProp : vendorId !== null;
  const handleOpenChange = (o: boolean) => {
    if (onOpenChange) onOpenChange(o);
    if (!o && onClose) onClose();
  };

  const detailQ = useQuery({
    queryKey: ['vendorDetail', vendorId],
    queryFn: () => fetchVendorDetail(vendorId!),
    enabled: isOpen && vendorId !== null,
    retry: 2,
    retryDelay: 1200,
  });

  const vendor = detailQ.data;

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="!w-[90vw] sm:!max-w-[520px] !p-0 !gap-0"
        style={{ display: 'flex', flexDirection: 'column', background: 'rgba(248,250,252,0.95)', backdropFilter: 'blur(16px)' }}
      >
        <SheetHeader className="!p-4 !pb-0">
          <SheetTitle style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.125rem', fontWeight: 800 }}>
            {vendor ? vendor.businessName : 'Vendor Details'}
          </SheetTitle>
          <SheetDescription>
            {vendor ? `ID #${vendor.id} · Joined ${formatDate(vendor.createdAt)}` : 'Loading...'}
          </SheetDescription>
        </SheetHeader>

        {detailQ.isLoading || detailQ.isFetching && !vendor ? (
          <Spinner />
        ) : detailQ.isError || !vendor ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '2rem 1.5rem', textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>Could not load vendor details</p>
            <p style={{ fontSize: '0.775rem', color: '#94A3B8', margin: 0 }}>
              {detailQ.error instanceof Error ? detailQ.error.message : 'Database connection issue — please retry'}
            </p>
            <button
              onClick={() => detailQ.refetch()}
              style={{ marginTop: '0.25rem', padding: '0.5rem 1.25rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', color: 'white', fontSize: '0.8125rem', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans' }}
            >
              Retry
            </button>
          </div>
        ) : (
          <Tabs defaultValue={initialTab || "overview"} className="flex-1 !gap-0" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TabsList className="!w-full !rounded-none !h-10" style={{ flexShrink: 0, padding: '0 0.5rem', overflowX: 'auto' }}>
              <TabsTrigger value="overview" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>Overview</TabsTrigger>
              <TabsTrigger value="documents" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>Documents</TabsTrigger>
              <TabsTrigger value="orders" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>Orders</TabsTrigger>
              <TabsTrigger value="activity" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>Activity</TabsTrigger>
            </TabsList>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              <TabsContent value="overview">
                <OverviewTab vendor={vendor} />
              </TabsContent>
              <TabsContent value="documents">
                <DocumentsTab vendor={vendor} />
              </TabsContent>
              <TabsContent value="orders">
                <OrdersPaymentsTab vendorId={vendor.id} />
              </TabsContent>
              <TabsContent value="activity">
                <ActivityTab vendorId={vendor.id} />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
