/**
 * VerificationQueue — Document Review Section
 * Allows CEO to review and approve/reject vendor identity documents
 * Arctic Glass Design System
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchVerificationQueue, reviewVendorDocs } from '../../lib/voomApi';
import type { VerificationQueueItem } from '../../lib/voomApi';
import { VendorDetailDrawer } from '../VendorDetailDrawer';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DocChip({ label, url, isText }: { label: string; url?: string | null; isText?: boolean }) {
  if (!url && !isText) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
      background: 'rgba(79,70,229,0.08)', color: '#4F46E5',
    }}>
      {label}
    </span>
  );
}

function VendorReviewCard({
  item,
  onOpen,
  onApprove,
  onReject,
  processing,
}: {
  item: VerificationQueueItem;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
  processing: boolean;
}) {
  const initials = item.businessName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const docCount = [item.ghanaCardNumber, item.idDocumentUrl, item.businessRegUrl].filter(Boolean).length;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(12px)',
      borderRadius: '1.125rem',
      border: '1px solid rgba(79,70,229,0.1)',
      boxShadow: '0 2px 16px rgba(79,70,229,0.05)',
      overflow: 'hidden',
      transition: 'box-shadow 0.15s ease',
    }}>
      {/* Card header */}
      <div
        onClick={onOpen}
        style={{ padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.875rem' }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: '0.75rem', flexShrink: 0,
          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.875rem', fontWeight: 700, color: '#fff',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: '0.9375rem', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.businessName}
          </p>
          <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#64748B' }}>
            {[item.city, item.region].filter(Boolean).join(', ') || 'Location unknown'} · Joined {formatDate(item.createdAt)}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
          <span style={{
            padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
            background: 'rgba(217,119,6,0.1)', color: '#D97706',
          }}>
            {docCount} doc{docCount !== 1 ? 's' : ''}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      {/* Document chips */}
      <div style={{ padding: '0 1rem 0.875rem', display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
        {item.ghanaCardNumber && <DocChip label="Ghana Card" isText />}
        {item.idDocumentUrl && <DocChip label="ID Document" url={item.idDocumentUrl} />}
        {item.businessRegUrl && <DocChip label="Business Reg" url={item.businessRegUrl} />}
      </div>

      {/* Document preview links */}
      {(item.idDocumentUrl || item.businessRegUrl) && (
        <div style={{ padding: '0 1rem 0.875rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {item.idDocumentUrl && (
            <a href={item.idDocumentUrl} target="_blank" rel="noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.3125rem 0.625rem', borderRadius: '0.5rem',
              background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.15)',
              fontSize: '0.72rem', fontWeight: 600, color: '#4F46E5', textDecoration: 'none',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              View ID Doc
            </a>
          )}
          {item.businessRegUrl && (
            <a href={item.businessRegUrl} target="_blank" rel="noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.3125rem 0.625rem', borderRadius: '0.5rem',
              background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.15)',
              fontSize: '0.72rem', fontWeight: 600, color: '#4F46E5', textDecoration: 'none',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              View Biz Reg
            </a>
          )}
        </div>
      )}

      {/* Ghana Card Number display */}
      {item.ghanaCardNumber && (
        <div style={{ padding: '0 1rem 0.875rem' }}>
          <div style={{
            padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
            background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.08)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Ghana Card</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
              {item.ghanaCardNumber}
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{
        padding: '0.75rem 1rem',
        borderTop: '1px solid rgba(79,70,229,0.07)',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem',
      }}>
        <button
          onClick={onReject}
          disabled={processing}
          style={{
            padding: '0.5625rem', borderRadius: '0.625rem',
            border: '1.5px solid rgba(225,29,72,0.2)',
            background: 'rgba(225,29,72,0.05)', color: '#E11D48',
            fontSize: '0.8125rem', fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.5 : 1, fontFamily: 'Plus Jakarta Sans',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Reject
        </button>
        <button
          onClick={onApprove}
          disabled={processing}
          style={{
            padding: '0.5625rem', borderRadius: '0.625rem', border: 'none',
            background: processing ? 'rgba(5,150,105,0.5)' : 'linear-gradient(135deg, #059669, #10B981)',
            color: '#fff', fontSize: '0.8125rem', fontWeight: 700,
            cursor: processing ? 'not-allowed' : 'pointer',
            fontFamily: 'Plus Jakarta Sans', boxShadow: '0 2px 8px rgba(5,150,105,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
          }}
        >
          {processing ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
          Approve
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center', padding: '3rem 2rem',
      background: 'rgba(5,150,105,0.04)',
      borderRadius: '1.25rem', border: '1px solid rgba(5,150,105,0.1)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(5,150,105,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1rem',
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.75">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <p style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: '1rem', color: '#059669', margin: '0 0 0.375rem' }}>
        All Clear
      </p>
      <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0 }}>
        No documents pending review. You're up to date.
      </p>
    </div>
  );
}

export function VerificationQueue() {
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['verification-queue'],
    queryFn: fetchVerificationQueue,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ vendorId, approved }: { vendorId: number; approved: boolean }) =>
      reviewVendorDocs(vendorId, approved),
    onSuccess: (_ok, { vendorId }) => {
      setReviewed(prev => new Set([...prev, vendorId]));
      setProcessingId(null);
      queryClient.invalidateQueries({ queryKey: ['verification-queue'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendorDetail', vendorId] });
    },
    onError: () => setProcessingId(null),
  });

  const handleDecision = (vendorId: number, approved: boolean) => {
    setProcessingId(vendorId);
    reviewMutation.mutate({ vendorId, approved });
  };

  const visible = queue.filter(v => !reviewed.has(v.id));
  const approvedCount = [...reviewed].filter(id => {
    const item = queue.find(v => v.id === id);
    return item !== undefined;
  }).length;

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: '1.5rem', color: '#0F172A', margin: 0 }}>
            Document Review
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '0.25rem 0 0' }}>
            Review and approve vendor identity documents before activation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {visible.length > 0 && (
            <div style={{
              padding: '0.5rem 1rem', borderRadius: '0.75rem',
              background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.15)',
            }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#D97706' }}>
                ⏳ {visible.length} pending
              </span>
            </div>
          )}
          {approvedCount > 0 && (
            <div style={{
              padding: '0.5rem 1rem', borderRadius: '0.75rem',
              background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.15)',
            }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#059669' }}>
                ✓ {approvedCount} reviewed this session
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(79,70,229,0.15)', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* Queue */}
      {!isLoading && visible.length === 0 && <EmptyState />}

      {!isLoading && visible.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1rem',
        }}>
          {visible.map(item => (
            <VendorReviewCard
              key={item.id}
              item={item}
              onOpen={() => setSelectedVendorId(item.id)}
              onApprove={() => handleDecision(item.id, true)}
              onReject={() => handleDecision(item.id, false)}
              processing={processingId === item.id}
            />
          ))}
        </div>
      )}

      {/* Vendor detail drawer — pre-open on documents tab */}
      <VendorDetailDrawer
        vendorId={selectedVendorId}
        initialTab="documents"
        onClose={() => setSelectedVendorId(null)}
      />
    </div>
  );
}
