/**
 * VOOM Ghana CEO Dashboard — Settings
 * API Keys tab for WhatsApp Business API configuration
 */

import { useState, useEffect } from 'react';

interface WaKeyStatus {
  phoneNumberId: boolean;
  accessToken: boolean;
  webhookToken: boolean;
  businessAccountId: boolean;
}

interface TestResult {
  success: boolean;
  message: string;
}

const STEP_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: '0.875rem',
  alignItems: 'flex-start',
  padding: '0.875rem 1rem',
  background: 'rgba(79,70,229,0.03)',
  borderRadius: '0.75rem',
  border: '1px solid rgba(79,70,229,0.07)',
};

const STEP_NUM: React.CSSProperties = {
  flexShrink: 0,
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
  color: 'white',
  fontSize: '0.7rem',
  fontWeight: 800,
  fontFamily: 'Space Grotesk',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const BADGE = (set: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.2rem 0.625rem',
  borderRadius: 999,
  fontSize: '0.7rem',
  fontWeight: 700,
  fontFamily: 'Plus Jakarta Sans',
  background: set ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.08)',
  color: set ? '#059669' : '#EF4444',
  border: `1px solid ${set ? 'rgba(5,150,105,0.2)' : 'rgba(239,68,68,0.15)'}`,
});

export function Settings() {
  const [tab, setTab] = useState<'whatsapp' | 'general'>('whatsapp');
  const [keys, setKeys] = useState({ phoneNumberId: '', accessToken: '', webhookToken: '', businessAccountId: '' });
  const [status, setStatus] = useState<WaKeyStatus>({ phoneNumberId: false, accessToken: false, webhookToken: false, businessAccountId: false });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/settings/wa-keys')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStatus(d.status ?? {}); })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/wa-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(data.status ?? {});
        setSaved(true);
        setKeys({ phoneNumberId: '', accessToken: '', webhookToken: '', businessAccountId: '' });
        setTimeout(() => setSaved(false), 3500);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/wa-test', { method: 'POST' });
      const data = await res.json();
      setTestResult({ success: res.ok && data.success, message: data.message || (res.ok ? 'Connection successful' : 'Test failed') });
    } catch {
      setTestResult({ success: false, message: 'Network error — could not reach the test endpoint' });
    } finally {
      setTesting(false);
    }
  };

  const allSet = status.phoneNumberId && status.accessToken && status.businessAccountId;

  const fields: { key: keyof typeof keys; label: string; hint: string; statusKey: keyof WaKeyStatus; placeholder: string }[] = [
    {
      key: 'businessAccountId',
      label: 'WhatsApp Business Account ID',
      hint: 'Found in Meta Business Manager → Settings → WhatsApp Accounts',
      statusKey: 'businessAccountId',
      placeholder: '123456789012345',
    },
    {
      key: 'phoneNumberId',
      label: 'Phone Number ID',
      hint: 'Found in Meta Developer Console → WhatsApp → Getting Started',
      statusKey: 'phoneNumberId',
      placeholder: '987654321098765',
    },
    {
      key: 'accessToken',
      label: 'Permanent Access Token',
      hint: 'Generate a System User token in Meta Business Manager with whatsapp_business_messaging permission',
      statusKey: 'accessToken',
      placeholder: 'EAABsbCS…',
    },
    {
      key: 'webhookToken',
      label: 'Webhook Verify Token',
      hint: "Any secret string you choose — you\u2019ll paste this into Meta when setting up your webhook",
      statusKey: 'webhookToken',
      placeholder: 'voom_webhook_secret_2025',
    },
  ];

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: '1.25rem', color: '#0F172A', margin: '0 0 0.25rem' }}>
          Settings
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0 }}>
          Configure integrations and API credentials for the dashboard.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: 'rgba(79,70,229,0.05)', padding: '0.25rem', borderRadius: '0.75rem', width: 'fit-content' }}>
        {[
          { key: 'whatsapp', label: 'WhatsApp API' },
          { key: 'general', label: 'General' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            style={{
              padding: '0.375rem 1rem', borderRadius: '0.5rem', border: 'none',
              fontFamily: 'Plus Jakarta Sans', fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: tab === t.key ? 'white' : 'transparent',
              color: tab === t.key ? '#4F46E5' : '#64748B',
              boxShadow: tab === t.key ? '0 1px 4px rgba(79,70,229,0.12)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'whatsapp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Status bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', padding: '0.875rem 1.125rem', background: 'white', borderRadius: '0.875rem', border: '1px solid rgba(79,70,229,0.1)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk', marginRight: '0.25rem', alignSelf: 'center' }}>Status:</span>
            <span style={BADGE(status.businessAccountId)}>
              {status.businessAccountId ? '✓' : '✕'} Business Account ID
            </span>
            <span style={BADGE(status.phoneNumberId)}>
              {status.phoneNumberId ? '✓' : '✕'} Phone Number ID
            </span>
            <span style={BADGE(status.accessToken)}>
              {status.accessToken ? '✓' : '✕'} Access Token
            </span>
            <span style={BADGE(status.webhookToken)}>
              {status.webhookToken ? '✓' : '✕'} Webhook Token
            </span>
          </div>

          {/* Setup guide */}
          <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid rgba(79,70,229,0.1)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid rgba(79,70,229,0.06)' }}>
              <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: '0.9375rem', color: '#0F172A', margin: '0 0 0.25rem' }}>
                How to get your WhatsApp Business API keys
              </h3>
              <p style={{ fontSize: '0.775rem', color: '#64748B', margin: 0 }}>
                You need a <strong>Meta Business Account</strong> and a verified WhatsApp Business number. This is different from the regular WhatsApp Business app.
              </p>
            </div>
            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>

              <div style={STEP_STYLE}>
                <div style={STEP_NUM}>1</div>
                <div>
                  <p style={{ margin: '0 0 0.2rem', fontWeight: 700, fontSize: '0.8125rem', color: '#0F172A', fontFamily: 'Plus Jakarta Sans' }}>Create a Meta Developer App</p>
                  <p style={{ margin: 0, fontSize: '0.775rem', color: '#64748B', lineHeight: 1.5 }}>
                    Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" style={{ color: '#4F46E5', fontWeight: 600 }}>developers.facebook.com/apps</a> → <strong>Create App</strong> → choose <strong>Business</strong> as the app type → name it (e.g. "VOOM Ghana WA").
                  </p>
                </div>
              </div>

              <div style={STEP_STYLE}>
                <div style={STEP_NUM}>2</div>
                <div>
                  <p style={{ margin: '0 0 0.2rem', fontWeight: 700, fontSize: '0.8125rem', color: '#0F172A', fontFamily: 'Plus Jakarta Sans' }}>Add WhatsApp to your app</p>
                  <p style={{ margin: 0, fontSize: '0.775rem', color: '#64748B', lineHeight: 1.5 }}>
                    Inside your app dashboard → <strong>Add a Product</strong> → find <strong>WhatsApp</strong> → click <strong>Set up</strong>. Connect it to your Meta Business account.
                  </p>
                </div>
              </div>

              <div style={STEP_STYLE}>
                <div style={STEP_NUM}>3</div>
                <div>
                  <p style={{ margin: '0 0 0.2rem', fontWeight: 700, fontSize: '0.8125rem', color: '#0F172A', fontFamily: 'Plus Jakarta Sans' }}>Get your Business Account ID and Phone Number ID</p>
                  <p style={{ margin: 0, fontSize: '0.775rem', color: '#64748B', lineHeight: 1.5 }}>
                    Go to <strong>WhatsApp → Getting Started</strong> in the left sidebar of your app. You'll see a "From" phone number — copy the <strong>Phone Number ID</strong> shown there. The <strong>Business Account ID</strong> is in <a href="https://business.facebook.com/settings/whatsapp-business-accounts" target="_blank" rel="noopener noreferrer" style={{ color: '#4F46E5', fontWeight: 600 }}>Meta Business Settings → WhatsApp Accounts</a>.
                  </p>
                </div>
              </div>

              <div style={STEP_STYLE}>
                <div style={STEP_NUM}>4</div>
                <div>
                  <p style={{ margin: '0 0 0.2rem', fontWeight: 700, fontSize: '0.8125rem', color: '#0F172A', fontFamily: 'Plus Jakarta Sans' }}>Generate a permanent Access Token</p>
                  <p style={{ margin: 0, fontSize: '0.775rem', color: '#64748B', lineHeight: 1.5 }}>
                    The temporary token on Getting Started expires in 24h. For a permanent token: <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" style={{ color: '#4F46E5', fontWeight: 600 }}>Meta Business Settings → System Users</a> → <strong>Add</strong> a System User with Admin role → click <strong>Generate New Token</strong> → select your app → add <code style={{ background: 'rgba(79,70,229,0.08)', padding: '0 0.3rem', borderRadius: 4 }}>whatsapp_business_messaging</code> and <code style={{ background: 'rgba(79,70,229,0.08)', padding: '0 0.3rem', borderRadius: 4 }}>whatsapp_business_management</code> permissions.
                  </p>
                </div>
              </div>

              <div style={STEP_STYLE}>
                <div style={STEP_NUM}>5</div>
                <div>
                  <p style={{ margin: '0 0 0.2rem', fontWeight: 700, fontSize: '0.8125rem', color: '#0F172A', fontFamily: 'Plus Jakarta Sans' }}>Set up your Webhook</p>
                  <p style={{ margin: 0, fontSize: '0.775rem', color: '#64748B', lineHeight: 1.5 }}>
                    Go to <strong>WhatsApp → Configuration</strong> → <strong>Webhook</strong> → <strong>Edit</strong>. Set Callback URL to <code style={{ background: 'rgba(79,70,229,0.08)', padding: '0 0.3rem', borderRadius: 4 }}>https://your-app-domain.replit.app/api/whatsapp/webhook</code>. For "Verify Token", type any secret string of your choice — paste the same string in the field below. Subscribe to <strong>messages</strong>.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Key input form */}
          <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid rgba(79,70,229,0.1)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid rgba(79,70,229,0.06)' }}>
              <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: '0.9375rem', color: '#0F172A', margin: '0 0 0.2rem' }}>
                Paste your API keys
              </h3>
              <p style={{ fontSize: '0.775rem', color: '#64748B', margin: 0 }}>
                Keys are stored securely on the server. Leave a field blank to keep the existing value.
              </p>
            </div>
            <div style={{ padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {fields.map(f => (
                <div key={f.key}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <label style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: '0.8125rem', color: '#0F172A' }}>
                      {f.label}
                    </label>
                    <span style={BADGE(status[f.statusKey])}>
                      {status[f.statusKey] ? '✓ Set' : '✕ Not set'}
                    </span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showValues[f.key] ? 'text' : 'password'}
                      value={keys[f.key]}
                      onChange={e => setKeys(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={status[f.statusKey] ? '••••••••••••  (already set — paste to update)' : f.placeholder}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '0.625rem 2.5rem 0.625rem 0.875rem',
                        borderRadius: '0.625rem', fontFamily: 'Space Grotesk', fontSize: '0.8125rem',
                        border: '1px solid rgba(79,70,229,0.15)',
                        background: 'rgba(248,250,252,0.8)',
                        color: '#0F172A', outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowValues(p => ({ ...p, [f.key]: !p[f.key] }))}
                      style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}
                    >
                      {showValues[f.key]
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#94A3B8', margin: '0.3rem 0 0', lineHeight: 1.4 }}>{f.hint}</p>
                </div>
              ))}

              {/* Action row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleSave}
                  disabled={saving || Object.values(keys).every(v => !v.trim())}
                  style={{
                    padding: '0.625rem 1.375rem', borderRadius: '0.625rem', border: 'none',
                    background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', color: 'white',
                    fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: '0.8125rem',
                    cursor: saving || Object.values(keys).every(v => !v.trim()) ? 'not-allowed' : 'pointer',
                    opacity: saving || Object.values(keys).every(v => !v.trim()) ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                  }}
                >
                  {saving
                    ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Saving…</>
                    : saved
                    ? '✓ Saved!'
                    : '💾 Save Keys'
                  }
                </button>

                {allSet && (
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    style={{
                      padding: '0.625rem 1.125rem', borderRadius: '0.625rem',
                      border: '1px solid rgba(5,150,105,0.3)',
                      background: 'rgba(5,150,105,0.06)', color: '#059669',
                      fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: '0.8125rem',
                      cursor: testing ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                    }}
                  >
                    {testing
                      ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(5,150,105,0.3)', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Testing…</>
                      : '⚡ Test Connection'
                    }
                  </button>
                )}

                {testResult && (
                  <div style={{
                    padding: '0.4rem 0.875rem', borderRadius: '0.625rem', fontSize: '0.775rem', fontWeight: 600,
                    fontFamily: 'Plus Jakarta Sans',
                    background: testResult.success ? 'rgba(5,150,105,0.08)' : 'rgba(239,68,68,0.08)',
                    color: testResult.success ? '#059669' : '#EF4444',
                    border: `1px solid ${testResult.success ? 'rgba(5,150,105,0.2)' : 'rgba(239,68,68,0.15)'}`,
                  }}>
                    {testResult.success ? '✓' : '✕'} {testResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {tab === 'general' && (
        <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid rgba(79,70,229,0.1)', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '0.875rem', color: '#64748B', textAlign: 'center', margin: 0 }}>
            General settings coming soon.
          </p>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
