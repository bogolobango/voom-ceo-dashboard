/**
 * InviteVendorModal — Invite a new vendor via WhatsApp
 * Collects business name + phone, creates a pending vendor record,
 * then opens a pre-written WhatsApp invitation message.
 */

import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onInvited?: () => void;
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

export function InviteVendorModal({ open, onClose, onInvited }: Props) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [invitedName, setInvitedName] = useState('');
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({ businessName: '', phone: '', city: '' });

  if (!open) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

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
      // fallback: select the URL
    }
  };

  const handleClose = () => {
    setStep('form');
    setForm({ businessName: '', phone: '', city: '' });
    setError('');
    setWhatsappUrl('');
    setInvitedName('');
    setCopied(false);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
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
        {/* Modal */}
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
                Invite Vendor
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: '0.2rem 0 0' }}>
                {step === 'form' ? 'Create a pending account & send WhatsApp invite' : 'Invitation ready to send'}
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
                  <label style={LABEL_STYLE}>WhatsApp / Phone *</label>
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
                      background: loading ? 'rgba(79,70,229,0.5)' : 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)',
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
                        Creating…
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.29 6.29l1.41-1.42a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        Create & Invite
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center' }}>
                {/* Success icon */}
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'rgba(5,150,105,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: '1rem', color: '#0F172A', margin: 0 }}>
                    Vendor account created!
                  </h3>
                  <p style={{ fontSize: '0.83rem', color: '#64748B', margin: '0.4rem 0 0' }}>
                    <strong style={{ color: '#0F172A' }}>{invitedName}</strong> has been added as a pending vendor. Now send them the WhatsApp invite.
                  </p>
                </div>

                {/* WhatsApp CTA */}
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
                  Send WhatsApp Invite
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
