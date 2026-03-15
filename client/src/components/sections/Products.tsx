/**
 * Products Section — Arctic Glass Design System
 * Product catalog metrics, category breakdown, and inventory health
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MetricCard } from '../MetricCard';
import type { DashboardKPIs } from '../../lib/voomApi';

interface ProductsProps {
  kpis: DashboardKPIs;
}

function GlassSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="glass-card" style={{ padding: '1.25rem', ...style }}>{children}</div>;
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>{children}</h3>
      {sub && <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.125rem' }}>{sub}</p>}
    </div>
  );
}

const categoryData = [
  { category: 'Engine Parts', count: 48, color: '#4F46E5' },
  { category: 'Electrical', count: 36, color: '#7C3AED' },
  { category: 'Body Parts', count: 29, color: '#0EA5E9' },
  { category: 'Brakes', count: 24, color: '#059669' },
  { category: 'Cooling', count: 21, color: '#D97706' },
  { category: 'Suspension', count: 18, color: '#E11D48' },
  { category: 'Batteries', count: 15, color: '#F59E0B' },
  { category: 'Tyres', count: 12, color: '#64748B' },
  { category: 'Filters', count: 11, color: '#10B981' },
  { category: 'Other', count: 33, color: '#94A3B8' },
];

const makeData = [
  { make: 'Toyota', products: 82 },
  { make: 'Honda', products: 54 },
  { make: 'Nissan', products: 38 },
  { make: 'Hyundai', products: 29 },
  { make: 'Mercedes', products: 21 },
  { make: 'Ford', products: 14 },
  { make: 'Kia', products: 9 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(79,70,229,0.15)', borderRadius: '0.75rem',
      padding: '0.625rem 0.875rem', boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.25rem' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: '0.875rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Space Grotesk' }}>
          {p.value} products
        </p>
      ))}
    </div>
  );
};

export function Products({ kpis }: ProductsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Product Catalog
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
          {kpis.totalProducts} active listings across {kpis.totalCategories} categories
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <MetricCard label="Total Products" value={kpis.totalProducts} trend={12.3} variant="indigo" delay={0} />
        <MetricCard label="Categories" value={kpis.totalCategories} variant="indigo" delay={1} />
        <MetricCard label="Avg Views/Product" value={34} variant="amber" delay={2} subtitle="Last 30 days" />
        <MetricCard label="Out of Stock" value={8} variant="rose" delay={3} subtitle="Needs restocking" />
      </div>

      {/* By Make + By Category */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.25rem' }}>
        <GlassSection>
          <SectionTitle sub="Top vehicle makes by listing count">Products by Make</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={makeData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,70,229,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="make" tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Plus Jakarta Sans' }} tickLine={false} axisLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="products" fill="#4F46E5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassSection>

        <GlassSection>
          <SectionTitle sub="By part category">Category Breakdown</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 260, overflowY: 'auto' }}>
            {categoryData.map(cat => {
              const pct = Math.round((cat.count / kpis.totalProducts) * 100);
              return (
                <div key={cat.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>{cat.category}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Space Grotesk' }}>
                      {cat.count}
                    </span>
                  </div>
                  <div className="liquid-bar" style={{ height: 5 }}>
                    <div className="liquid-bar-fill" style={{ width: `${pct}%`, background: cat.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassSection>
      </div>

      {/* Condition breakdown */}
      <GlassSection>
        <SectionTitle sub="Product condition distribution">Inventory Health</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {[
            { label: 'New Parts', count: Math.round(kpis.totalProducts * 0.42), color: '#059669', pct: 42 },
            { label: 'Used Parts', count: Math.round(kpis.totalProducts * 0.45), color: '#D97706', pct: 45 },
            { label: 'Refurbished', count: Math.round(kpis.totalProducts * 0.13), color: '#4F46E5', pct: 13 },
          ].map(item => (
            <div key={item.label} style={{
              padding: '1rem',
              borderRadius: '0.875rem',
              background: `${item.color}08`,
              border: `1px solid ${item.color}20`,
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: item.color, fontFamily: 'Space Grotesk', margin: 0, lineHeight: 1 }}>
                {item.pct}%
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#475569', marginTop: '0.375rem', fontWeight: 500 }}>{item.label}</p>
              <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.125rem' }}>{item.count} listings</p>
            </div>
          ))}
        </div>
      </GlassSection>
    </div>
  );
}
