/**
 * WhatsApp Acquisition Module — Arctic Glass Design System
 * 3 sub-tabs: Discovery Radar, Group Manager, Lead Inbox
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWaGroups, fetchWaLeads, fetchWaTemplates, fetchWaMessages,
  scrapeWaGroups, updateWaGroupStatus, sendWaBroadcast, updateWaLeadType,
  type WaGroup, type WaLead, type WaTemplate, type WaMessage,
  type WaGroupStatus, type WaLeadType,
} from '../../lib/voomApi';
import { toast } from 'sonner';

// ─── Shared sub-components ───

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

const SOURCE_COLORS: Record<string, string> = {
  facebook: '#1877F2', google: '#4285F4', instagram: '#E1306C',
  tiktok: '#000000', web_directory: '#64748B', reddit: '#FF4500',
};

const STATUS_COLORS: Record<string, string> = {
  discovered: '#94A3B8', approved: '#D97706', joining: '#0EA5E9',
  joined: '#059669', rejected: '#E11D48', left: '#64748B', failed: '#EF4444',
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ═══════════════════════════════════════════════════════════════
// Discovery Radar
// ═══════════════════════════════════════════════════════════════

function DiscoveryRadar() {
  const queryClient = useQueryClient();
  const [keywords, setKeywords] = useState('Ghana car parts, mechanics, auto spare parts');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook', 'google', 'instagram', 'tiktok']);

  const { data: groups = [] } = useQuery({
    queryKey: ['wa-groups'],
    queryFn: fetchWaGroups,
  });

  const discoveredGroups = useMemo(() => groups.filter(g => g.status === 'discovered'), [groups]);

  const scrapeMutation = useMutation({
    mutationFn: () => scrapeWaGroups(keywords.split(',').map(k => k.trim()).filter(Boolean), selectedPlatforms),
    onSuccess: (data) => {
      toast.success(`Found ${data.linksNew} new groups (${data.linksFound} total scanned)`);
      if (data.demo && data.groups && data.groups.length > 0) {
        queryClient.setQueryData(['wa-groups'], (old: WaGroup[] | undefined) => {
          const existing = (old || []).filter(g => !data.groups.find((ng: WaGroup) => ng.inviteLink === g.inviteLink));
          return [...data.groups, ...existing];
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['wa-groups'] });
      }
    },
    onError: () => toast.error('Scan failed — check console for details'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: WaGroupStatus }) => updateWaGroupStatus(id, status),
    onSuccess: (_, vars) => {
      toast.success(vars.status === 'approved' ? 'Group approved' : 'Group rejected');
      queryClient.invalidateQueries({ queryKey: ['wa-groups'] });
    },
  });

  const platforms = ['facebook', 'google', 'instagram', 'tiktok', 'reddit'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Search Panel */}
      <GlassSection>
        <SectionTitle sub="Enter keywords and select platforms to scan for WhatsApp groups">Discovery Radar</SectionTitle>
        <input
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          placeholder="e.g. Ghana car parts, mechanics, auto spares"
          style={{
            width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
            border: '1px solid rgba(79,70,229,0.12)', background: 'rgba(255,255,255,0.8)',
            fontSize: '0.8125rem', marginBottom: '0.75rem', boxSizing: 'border-box',
            outline: 'none', color: '#0F172A',
          }}
        />
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {platforms.map(p => {
            const active = selectedPlatforms.includes(p);
            return (
              <button
                key={p}
                onClick={() => setSelectedPlatforms(prev =>
                  active ? prev.filter(x => x !== p) : [...prev, p]
                )}
                style={{
                  padding: '0.3rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  background: active ? '#4F46E5' : 'rgba(79,70,229,0.08)',
                  color: active ? 'white' : '#64748B',
                  fontFamily: 'Plus Jakarta Sans',
                  transition: 'all 0.15s ease',
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => scrapeMutation.mutate()}
          disabled={scrapeMutation.isPending || !keywords.trim()}
          style={{
            padding: '0.5rem 1.25rem', borderRadius: '0.625rem', border: 'none',
            background: '#4F46E5', color: 'white', fontSize: '0.8125rem', fontWeight: 700,
            cursor: scrapeMutation.isPending ? 'wait' : 'pointer',
            opacity: scrapeMutation.isPending ? 0.7 : 1,
            fontFamily: 'Plus Jakarta Sans',
          }}
        >
          {scrapeMutation.isPending ? 'Scanning...' : '🔍 Scan Web'}
        </button>
      </GlassSection>

      {/* Discovery Queue */}
      <GlassSection>
        <SectionTitle sub={`${discoveredGroups.length} group${discoveredGroups.length !== 1 ? 's' : ''} awaiting review`}>
          Discovery Queue
        </SectionTitle>

        {discoveredGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94A3B8' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📡</p>
            <p style={{ fontSize: '0.8125rem' }}>No groups discovered yet. Run a scan to find WhatsApp groups.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {discoveredGroups.map(group => (
                <div key={group.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.75rem', borderRadius: '0.75rem',
                  background: 'rgba(248,250,252,0.6)', gap: '0.75rem',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                      {group.name || 'Unnamed Group'}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 600, padding: '0.1rem 0.4rem',
                        borderRadius: 999, color: 'white',
                        background: SOURCE_COLORS[group.source || ''] || '#94A3B8',
                      }}>
                        {group.source || 'unknown'}
                      </span>
                      <a
                        href={group.inviteLink}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '0.68rem', color: '#4F46E5', textDecoration: 'none' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {group.inviteLink.slice(0, 45)}...
                      </a>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                    <button
                      onClick={() => statusMutation.mutate({ id: group.id, status: 'approved' })}
                      disabled={statusMutation.isPending}
                      style={{
                        padding: '0.3rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                        background: 'rgba(5,150,105,0.1)', color: '#059669',
                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'Plus Jakarta Sans',
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => statusMutation.mutate({ id: group.id, status: 'rejected' })}
                      disabled={statusMutation.isPending}
                      style={{
                        padding: '0.3rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                        background: 'rgba(225,29,72,0.08)', color: '#E11D48',
                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'Plus Jakarta Sans',
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassSection>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Group Manager
// ═══════════════════════════════════════════════════════════════

function GroupManager() {
  const queryClient = useQueryClient();
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastName, setBroadcastName] = useState('');

  const { data: allGroups = [] } = useQuery({ queryKey: ['wa-groups'], queryFn: fetchWaGroups });
  const { data: templates = [] } = useQuery({ queryKey: ['wa-templates'], queryFn: fetchWaTemplates });

  const activeGroups = useMemo(() =>
    allGroups.filter(g => ['approved', 'joining', 'joined'].includes(g.status)), [allGroups]);

  const approvedCount = useMemo(() => allGroups.filter(g => g.status === 'approved').length, [allGroups]);
  const joinedCount = useMemo(() => allGroups.filter(g => g.status === 'joined').length, [allGroups]);

  const joinMutation = useMutation({
    mutationFn: (id: number) => updateWaGroupStatus(id, 'joined'),
    onSuccess: () => {
      toast.success('Group joined');
      queryClient.invalidateQueries({ queryKey: ['wa-groups'] });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: () => sendWaBroadcast({
      name: broadcastName || `Broadcast ${new Date().toLocaleDateString()}`,
      messageBody: broadcastMessage,
      targetGroupIds: selectedGroupIds,
    }),
    onSuccess: (data) => {
      toast.success(`Broadcast sent to ${data.sentCount} group${data.sentCount !== 1 ? 's' : ''}`);
      setBroadcastOpen(false);
      setBroadcastMessage('');
      setBroadcastName('');
      setSelectedGroupIds([]);
      queryClient.invalidateQueries({ queryKey: ['wa-groups'] });
    },
    onError: () => toast.error('Broadcast failed'),
  });

  const toggleGroup = (id: number) => {
    setSelectedGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
        {[
          { label: 'Approved', value: approvedCount, color: '#D97706' },
          { label: 'Joined', value: joinedCount, color: '#059669' },
          { label: 'Total Active', value: activeGroups.length, color: '#4F46E5' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '0.75rem', borderRadius: '0.75rem', textAlign: 'center',
            background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(79,70,229,0.06)',
          }}>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color, margin: 0, fontFamily: 'Space Grotesk' }}>{s.value}</p>
            <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: '0.125rem 0 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Groups Table */}
      <GlassSection>
        <SectionTitle sub={`${activeGroups.length} active group${activeGroups.length !== 1 ? 's' : ''}`}>Group Manager</SectionTitle>

        {activeGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: '0.8125rem' }}>
            No approved or joined groups yet. Approve groups from the Discovery Radar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {activeGroups.map(group => (
              <div key={group.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.625rem 0.75rem', borderRadius: '0.625rem',
                background: selectedGroupIds.includes(group.id) ? 'rgba(79,70,229,0.06)' : 'rgba(248,250,252,0.6)',
                border: selectedGroupIds.includes(group.id) ? '1px solid rgba(79,70,229,0.15)' : '1px solid transparent',
                cursor: 'pointer',
              }} onClick={() => toggleGroup(group.id)}>
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(group.id)}
                  onChange={() => toggleGroup(group.id)}
                  style={{ accentColor: '#4F46E5', cursor: 'pointer' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                    {group.name || 'Unnamed Group'}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.125rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 600, padding: '0.1rem 0.4rem',
                      borderRadius: 999, color: 'white',
                      background: STATUS_COLORS[group.status] || '#94A3B8',
                    }}>
                      {group.status}
                    </span>
                    {group.memberCount > 0 && (
                      <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{group.memberCount} members</span>
                    )}
                    {group.lastBroadcastAt && (
                      <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Last broadcast: {formatRelativeTime(group.lastBroadcastAt)}</span>
                    )}
                  </div>
                </div>
                {group.status === 'approved' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); joinMutation.mutate(group.id); }}
                    style={{
                      padding: '0.3rem 0.625rem', borderRadius: '0.5rem', border: 'none',
                      background: '#4F46E5', color: 'white', fontSize: '0.72rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'Plus Jakarta Sans', flexShrink: 0,
                    }}
                  >
                    Join
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Broadcast action bar */}
        {selectedGroupIds.length > 0 && (
          <div style={{
            marginTop: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(124,58,237,0.04) 100%)',
            border: '1px solid rgba(79,70,229,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4F46E5' }}>
              {selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setBroadcastOpen(true)}
              style={{
                padding: '0.4rem 1rem', borderRadius: '0.5rem', border: 'none',
                background: '#4F46E5', color: 'white', fontSize: '0.8125rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Plus Jakarta Sans',
              }}
            >
              📢 Broadcast
            </button>
          </div>
        )}
      </GlassSection>

      {/* Broadcast Modal */}
      {broadcastOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }} onClick={() => setBroadcastOpen(false)}>
          <div style={{
            background: 'white', borderRadius: '1.25rem', width: '100%', maxWidth: 520,
            padding: '1.5rem', boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: '0 0 1rem' }}>
              Send Broadcast Message
            </h3>

            <input
              value={broadcastName}
              onChange={e => setBroadcastName(e.target.value)}
              placeholder="Broadcast name (optional)"
              style={{
                width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                border: '1px solid rgba(79,70,229,0.12)', fontSize: '0.8125rem',
                marginBottom: '0.625rem', boxSizing: 'border-box', outline: 'none',
              }}
            />

            {/* Template selector */}
            <select
              onChange={e => {
                const t = templates.find(t => t.id === parseInt(e.target.value));
                if (t) setBroadcastMessage(t.body);
              }}
              style={{
                width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                border: '1px solid rgba(79,70,229,0.12)', fontSize: '0.8125rem',
                marginBottom: '0.625rem', boxSizing: 'border-box', outline: 'none',
                color: '#475569', background: 'white',
              }}
              defaultValue=""
            >
              <option value="" disabled>Select a template...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <textarea
              value={broadcastMessage}
              onChange={e => setBroadcastMessage(e.target.value)}
              placeholder="Type your message..."
              maxLength={1024}
              rows={6}
              style={{
                width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem',
                border: '1px solid rgba(79,70,229,0.12)', fontSize: '0.8125rem',
                marginBottom: '0.375rem', boxSizing: 'border-box', resize: 'vertical',
                outline: 'none', fontFamily: 'inherit', color: '#0F172A',
              }}
            />
            <p style={{ fontSize: '0.68rem', color: '#94A3B8', textAlign: 'right', margin: '0 0 0.75rem' }}>
              {broadcastMessage.length}/1024
            </p>

            {/* Preview */}
            {broadcastMessage && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</p>
                <div style={{
                  background: '#DCF8C6', borderRadius: '0.75rem', padding: '0.75rem',
                  fontSize: '0.8125rem', color: '#0F172A', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', maxHeight: 150, overflowY: 'auto',
                }}>
                  {broadcastMessage}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setBroadcastOpen(false)}
                style={{
                  padding: '0.4rem 1rem', borderRadius: '0.5rem',
                  border: '1px solid rgba(79,70,229,0.15)', background: 'white',
                  color: '#64748B', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => broadcastMutation.mutate()}
                disabled={!broadcastMessage.trim() || broadcastMutation.isPending}
                style={{
                  padding: '0.4rem 1rem', borderRadius: '0.5rem', border: 'none',
                  background: '#4F46E5', color: 'white', fontSize: '0.8125rem', fontWeight: 700,
                  cursor: broadcastMutation.isPending ? 'wait' : 'pointer',
                  opacity: !broadcastMessage.trim() ? 0.5 : 1,
                  fontFamily: 'Plus Jakarta Sans',
                }}
              >
                {broadcastMutation.isPending ? 'Sending...' : `Send to ${selectedGroupIds.length} group${selectedGroupIds.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Lead Inbox
// ═══════════════════════════════════════════════════════════════

function LeadInbox() {
  const queryClient = useQueryClient();
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<'all' | WaLeadType>('all');

  const { data: leads = [] } = useQuery({
    queryKey: ['wa-leads'],
    queryFn: fetchWaLeads,
    refetchInterval: 30_000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['wa-messages', selectedLeadId],
    queryFn: () => selectedLeadId ? fetchWaMessages(selectedLeadId) : Promise.resolve([]),
    enabled: !!selectedLeadId,
  });

  const filteredLeads = useMemo(() =>
    filterType === 'all' ? leads : leads.filter(l => l.type === filterType), [leads, filterType]);

  const selectedLead = useMemo(() => leads.find(l => l.id === selectedLeadId), [leads, selectedLeadId]);

  const leadTypeMutation = useMutation({
    mutationFn: ({ id, type, status }: { id: number; type: WaLeadType; status?: string }) =>
      updateWaLeadType(id, type, status as any),
    onSuccess: (_, vars) => {
      const label = vars.status === 'dead' ? 'Dead lead' : vars.status === 'converted' ? 'Added to Vendor CRM' : `Marked as ${vars.type}`;
      toast.success(label);
      queryClient.invalidateQueries({ queryKey: ['wa-leads'] });
    },
  });

  const LEAD_TYPE_COLORS: Record<string, string> = {
    vendor: '#059669', customer: '#4F46E5', unknown: '#94A3B8',
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', minHeight: 400 }}>
      {/* Left: Lead List */}
      <div style={{
        width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.6)', borderRadius: '1rem',
        border: '1px solid rgba(79,70,229,0.06)', overflow: 'hidden',
      }}>
        {/* Filters */}
        <div style={{ padding: '0.75rem', borderBottom: '1px solid rgba(79,70,229,0.06)', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {(['all', 'vendor', 'customer', 'unknown'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                padding: '0.2rem 0.5rem', borderRadius: '0.375rem', border: 'none',
                fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer',
                background: filterType === t ? '#4F46E5' : 'rgba(79,70,229,0.06)',
                color: filterType === t ? 'white' : '#64748B',
                fontFamily: 'Plus Jakarta Sans',
              }}
            >
              {t === 'all' ? 'All' : t === 'vendor' ? 'Vendors' : t === 'customer' ? 'Customers' : 'Unknown'}
            </button>
          ))}
        </div>

        {/* Lead cards */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredLeads.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem' }}>
              No leads yet
            </div>
          ) : filteredLeads.map(lead => (
            <div
              key={lead.id}
              onClick={() => setSelectedLeadId(lead.id)}
              style={{
                padding: '0.625rem 0.75rem', cursor: 'pointer',
                borderBottom: '1px solid rgba(79,70,229,0.04)',
                background: selectedLeadId === lead.id ? 'rgba(79,70,229,0.06)' : 'transparent',
                display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: `hsl(${(lead.id * 67) % 360}, 50%, 90%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 800,
                color: `hsl(${(lead.id * 67) % 360}, 40%, 40%)`,
              }}>
                {(lead.name || lead.phone).slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.name || lead.phone}
                  </p>
                  {lead.status === 'new' && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F46E5', flexShrink: 0 }} />
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', marginTop: '0.125rem' }}>
                  <span style={{
                    fontSize: '0.58rem', fontWeight: 600, padding: '0.05rem 0.3rem',
                    borderRadius: 999, color: 'white',
                    background: LEAD_TYPE_COLORS[lead.type] || '#94A3B8',
                  }}>
                    {lead.type}
                  </span>
                  {lead.latestMessage && (
                    <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                      {formatRelativeTime(lead.latestMessage.sentAt)}
                    </span>
                  )}
                </div>
                {lead.latestMessage && (
                  <p style={{
                    fontSize: '0.72rem', color: '#64748B', margin: '0.125rem 0 0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {lead.latestMessage.content.slice(0, 60)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Chat View */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.6)', borderRadius: '1rem',
        border: '1px solid rgba(79,70,229,0.06)', overflow: 'hidden',
      }}>
        {!selectedLead ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '0.8125rem' }}>
            Select a lead to view the conversation
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: '0.75rem 1rem', borderBottom: '1px solid rgba(79,70,229,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
                  {selectedLead.name || selectedLead.phone}
                </p>
                <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.125rem' }}>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{selectedLead.phone}</span>
                  <span style={{
                    fontSize: '0.58rem', fontWeight: 600, padding: '0.05rem 0.3rem',
                    borderRadius: 999, color: 'white',
                    background: LEAD_TYPE_COLORS[selectedLead.type] || '#94A3B8',
                  }}>
                    {selectedLead.type}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{
              padding: '0.5rem 1rem', borderBottom: '1px solid rgba(79,70,229,0.04)',
              display: 'flex', gap: '0.375rem', flexWrap: 'wrap',
            }}>
              <button
                onClick={() => leadTypeMutation.mutate({ id: selectedLead.id, type: 'vendor', status: 'qualified' })}
                style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(5,150,105,0.1)', color: '#059669', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Mark as Vendor
              </button>
              <button
                onClick={() => leadTypeMutation.mutate({ id: selectedLead.id, type: 'customer', status: 'qualified' })}
                style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(79,70,229,0.08)', color: '#4F46E5', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Mark as Customer
              </button>
              <button
                onClick={() => leadTypeMutation.mutate({ id: selectedLead.id, type: selectedLead.type, status: 'dead' })}
                style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', border: 'none', background: 'rgba(225,29,72,0.06)', color: '#E11D48', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Dead Lead
              </button>
              {selectedLead.type === 'vendor' && selectedLead.status !== 'converted' && (
                <button
                  onClick={() => leadTypeMutation.mutate({ id: selectedLead.id, type: 'vendor', status: 'converted' })}
                  style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', border: 'none', background: '#4F46E5', color: 'white', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Add to Vendor CRM
                </button>
              )}
            </div>

            {/* Chat Bubbles */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem', marginTop: '2rem' }}>
                  No messages yet
                </div>
              ) : messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: msg.direction === 'inbound' ? 'flex-start' : 'flex-end',
                    maxWidth: '75%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: msg.direction === 'inbound' ? '0.75rem 0.75rem 0.75rem 0.25rem' : '0.75rem 0.75rem 0.25rem 0.75rem',
                    background: msg.direction === 'inbound' ? 'rgba(241,245,249,0.9)' : 'rgba(79,70,229,0.1)',
                    fontSize: '0.8125rem', color: '#0F172A', lineHeight: 1.4,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', marginTop: '0.25rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.6rem', color: '#94A3B8' }}>
                      {new Date(msg.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.direction === 'outbound' && (
                      <span style={{ fontSize: '0.6rem', color: msg.readAt ? '#4F46E5' : '#94A3B8' }}>
                        {msg.readAt ? '✓✓' : msg.deliveredAt ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

type WaTab = 'discovery' | 'groups' | 'inbox';

export function WhatsAppAcquisition() {
  const [waTab, setWaTab] = useState<WaTab>('discovery');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Sub-tab switcher */}
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
        {([
          { id: 'discovery' as const, label: '📡 Discovery Radar' },
          { id: 'groups' as const, label: '👥 Group Manager' },
          { id: 'inbox' as const, label: '💬 Lead Inbox' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setWaTab(tab.id)}
            style={{
              padding: '0.4rem 0.875rem', borderRadius: '0.5rem', border: 'none',
              cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              background: waTab === tab.id ? 'rgba(79,70,229,0.1)' : 'transparent',
              color: waTab === tab.id ? '#4F46E5' : '#64748B',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {waTab === 'discovery' && <DiscoveryRadar />}
      {waTab === 'groups' && <GroupManager />}
      {waTab === 'inbox' && <LeadInbox />}
    </div>
  );
}
