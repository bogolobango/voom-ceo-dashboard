/**
 * InviteVendorModal — Invite a vendor via WhatsApp
 * Two modes:
 *   1. Brand-new vendor: creates a pending vendor record, then sends WA invite
 *   2. Existing unclaimed vendor (prefill): updates profile if changed, then sends outreach invite
 */

import { useState, useEffect } from 'react';

export interface VendorPrefill {
  vendorId: number;
  businessName: string;
  phone: string;
  city?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onInvited?: () => void;
  prefill?: VendorPrefill;
}

function formatGhanaWa(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)+]/g, '');
  if (cleaned.startsWith('233')) return cleaned;
  if (cleaned.startsWith('0') && cleaned.length === 10) return '233' + cleaned.slice(1);
  if (cleaned.length === 9) return '233' + cleaned;
  return cleaned;
}

function buildWhatsAppUrl(waNumber: string, businessName: string): string {
  const msg = encodeURIComponent(
    `Hello! 👋 You've been invited to join VOOM Ghana as a verified auto-parts vendor.\n\n` +
    `Business: *${businessName}*\n\n` +
    `Your account has been created and is pending activation. ` +
    `Our team will contact you within 24 hours to complete your onboarding.\n\n` +
    `Welcome to VOOM Ghana! 🚗`
  );
  return `https://wa.me/${waNumber}?text=${msg}`;
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: '0.75rem',
  border: '1.5px solid rgba(79,70,229,0.15)',
  background: 'rgba(248,250,252,0.9)',
  fontSize: '0.9rem',
  color: '#0F172A',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'Plus Jakarta Sans',
  transition: 'border-color 0.15s',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#64748B',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom: '0.375rem',
  display: 'block',
};

export function InviteVendorModal({ open, onClose, onInvited, prefill }: Props) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [invitedName, setInvitedName] = useState('');
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({ businessName: '', phone: '', city: '' });

  useEffect(() => {
    if (open) {
      if (prefill) {
        setForm({
          businessName: prefill.businessName,
          phone: prefill.phone,
          city: prefill.city ?? '',
        });
      } else {
        setForm({ businessName: '', phone: '', city: '' });
      }
      setStep('form');
      setError('');
      setWhatsappUrl('');
      setInvitedName('');
      setCopied(false);
    }
  }, [open, prefill]);

  if (!open) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const isExisting = !!prefill?.vendorId;

  const handleSubmit = async () => {
    const name = form.businessName.trim();
    const phone = form.phone.trim();
    if (!name || !phone) {
      setError('Business name and phone number are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isExisting) {
        // Update vendor profile if anything changed
        const patchBody: Record<string, string> = {};
        if (name !== prefill!.businessName) patchBody.businessName = name;
        if (phone !== prefill!.phone) patchBody.whatsapp = phone;
        if (Object.keys(patchBody).length > 0) {
          await fetch(`/api/vendors/${prefill!.vendorId}/profile`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchBody),
          });
        }
        // Get outreach invite WA URL
        const res = await fetch(`/api/vendors/${prefill!.vendorId}/outreach-invite`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get invite link');
        setWhatsappUrl(data.whatsappUrl);
        setInvitedName(name);
        setStep('success');
        onInvited?.();
      } else {
        // Create brand-new vendor record
        const res = await fetch('/api/vendors/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessName: name, phone, city: form.city.trim() || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send invite');
        setWhatsappUrl(data.whatsappUrl);
        setInvitedName(name);
        setStep('success');
        onInvited?.();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'white',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: 440,
            boxShadow: '0 25px 60px rgba(15,23,42,0.2)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(79,70,229,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: '1.0625rem', color: '#0F172A', margin: 0 }}>
                {isExisting ? 'Send WhatsApp Invite' : 'Invite Vendor'}
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: '0.2rem 0 0' }}>
                {step === 'form'
                  ? isExisting
                    ? 'Review details then open WhatsApp to send'
                    : 'Create a pending account & send WhatsApp invite'
                  : 'Invitation ready to send'}
              </p>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              style={{
                width: 32, height: 32, borderRadius: '0.5rem',
                background: 'rgba(100,116,139,0.08)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#64748B', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '1.5rem' }}>
            {step === 'form' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={LABEL_STYLE}>Business Name *</label>
                  <input
                    style={INPUT_STYLE}
                    placeholder="e.g. Accra Auto Spares"
                    value={form.businessName}
                    onChange={set('businessName')}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={LABEL_STYLE}>WhatsApp Number *</label>
                  <input
                    style={INPUT_STYLE}
                    placeholder="e.g. 0244123456 or +233244123456"
                    value={form.phone}
                    onChange={set('phone')}
                    type="tel"
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  />
                  <p style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.3rem' }}>
                    Ghana numbers: start with 0XX or +233XX
                  </p>
                </div>
                {!isExisting && (
                  <div>
                    <label style={LABEL_STYLE}>City <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                    <input
                      style={INPUT_STYLE}
                      placeholder="e.g. Accra, Kumasi, Takoradi"
                      value={form.city}
                      onChange={set('city')}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    />
                  </div>
                )}

                {isExisting && (
                  <div style={{
                    padding: '0.625rem 0.875rem',
                    background: 'rgba(79,70,229,0.04)',
                    border: '1px solid rgba(79,70,229,0.12)',
                    borderRadius: '0.625rem',
                    fontSize: '0.78rem',
                    color: '#64748B',
                  }}>
                    Edit the name or number above if needed, then click <strong style={{ color: '#0F172A' }}>Send Invite</strong>. The message opens in WhatsApp — send it from your phone.
                  </div>
                )}

                {error && (
                  <div style={{
                    padding: '0.625rem 0.875rem',
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '0.625rem',
                    fontSize: '0.8125rem',
                    color: '#DC2626',
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button
                    onClick={handleClose}
                    style={{
                      flex: 1, padding: '0.75rem',
                      borderRadius: '0.75rem', border: '1.5px solid rgba(79,70,229,0.15)',
                      background: 'transparent', color: '#64748B',
                      fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'Plus Jakarta Sans',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                      flex: 2, padding: '0.75rem',
                      borderRadius: '0.75rem', border: 'none',
                      background: loading ? 'rgba(37,211,102,0.5)' : 'linear-gradient(135deg,#25D366 0%,#128C7E 100%)',
                      color: 'white', fontSize: '0.875rem', fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontFamily: 'Plus Jakarta Sans',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    }}
                  >
                    {loading ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        {isExisting ? 'Preparing…' : 'Creating…'}
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                        </svg>
                        {isExisting ? 'Send Invite' : 'Create & Invite'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'rgba(37,211,102,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: '1rem', color: '#0F172A', margin: 0 }}>
                    {isExisting ? 'Ready to send!' : 'Vendor account created!'}
                  </h3>
                  <p style={{ fontSize: '0.83rem', color: '#64748B', margin: '0.4rem 0 0' }}>
                    {isExisting
                      ? <>Tap below to open WhatsApp and send the invite to <strong style={{ color: '#0F172A' }}>{invitedName}</strong>.</>
                      : <><strong style={{ color: '#0F172A' }}>{invitedName}</strong> has been added as a pending vendor. Now send them the WhatsApp invite.</>
                    }
                  </p>
                </div>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    borderRadius: '0.875rem',
                    background: 'linear-gradient(135deg,#25D366 0%,#128C7E 100%)',
                    color: 'white',
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
                    fontFamily: 'Plus Jakarta Sans',
                    boxSizing: 'border-box',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                  </svg>
                  Open WhatsApp
                </a>

                <button
                  onClick={handleCopy}
                  style={{
                    width: '100%', padding: '0.7rem',
                    borderRadius: '0.75rem',
                    border: '1.5px solid rgba(79,70,229,0.15)',
                    background: 'transparent',
                    color: copied ? '#059669' : '#64748B',
                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    fontFamily: 'Plus Jakarta Sans', boxSizing: 'border-box',
                    transition: 'color 0.2s',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  {copied ? 'Link copied!' : 'Copy invite link'}
                </button>

                <button
                  onClick={handleClose}
                  style={{
                    background: 'none', border: 'none',
                    color: '#94A3B8', fontSize: '0.8125rem',
                    cursor: 'pointer', padding: '0.25rem',
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
