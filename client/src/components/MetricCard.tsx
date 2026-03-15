/**
 * MetricCard — Arctic Glass Design System
 * Animated KPI card with number count-up, trend badge, and glass morphism
 * Inspired by Etienne MetricCard with VOOM-specific styling
 */

import { useRef, useState, useEffect } from 'react';

type Format = 'currency' | 'number' | 'percent' | 'time' | 'cedis';
type Variant = 'default' | 'indigo' | 'emerald' | 'amber' | 'rose';

interface MetricCardProps {
  label: string;
  value: number;
  format?: Format;
  trend?: number;
  trendLabel?: string;
  delay?: number;
  icon?: React.ReactNode;
  subtitle?: string;
  variant?: Variant;
  onClick?: () => void;
}

function formatValue(value: number, format: Format): string {
  switch (format) {
    case 'cedis':
      return `GH₵ ${new Intl.NumberFormat('en-GH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)}`;
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'time':
      if (value < 60) return `${Math.round(value)}s`;
      if (value < 3600) return `${Math.floor(value / 60)}m`;
      return `${(value / 3600).toFixed(1)}h`;
    default:
      return new Intl.NumberFormat('en-US').format(Math.round(value));
  }
}

const variantStyles: Record<Variant, { accent: string; iconBg: string; iconColor: string }> = {
  default: { accent: 'rgba(79,70,229,0.08)', iconBg: 'rgba(79,70,229,0.1)', iconColor: '#4F46E5' },
  indigo: { accent: 'rgba(79,70,229,0.08)', iconBg: 'rgba(79,70,229,0.1)', iconColor: '#4F46E5' },
  emerald: { accent: 'rgba(5,150,105,0.06)', iconBg: 'rgba(5,150,105,0.1)', iconColor: '#059669' },
  amber: { accent: 'rgba(217,119,6,0.06)', iconBg: 'rgba(217,119,6,0.1)', iconColor: '#D97706' },
  rose: { accent: 'rgba(225,29,72,0.06)', iconBg: 'rgba(225,29,72,0.1)', iconColor: '#E11D48' },
};

export function MetricCard({
  label,
  value,
  format = 'number',
  trend,
  trendLabel = 'vs last month',
  delay = 0,
  icon,
  subtitle,
  variant = 'default',
  onClick,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const styles = variantStyles[variant];

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay * 80);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasAnimated]);

  useEffect(() => {
    if (!hasAnimated) return;
    const duration = 1400;
    const start = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(eased * value);
      if (progress < 1) raf = requestAnimationFrame(animate);
      else setDisplayValue(value);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [hasAnimated, value]);

  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div
      ref={ref}
      onClick={onClick}
      className="glass-card p-5 relative overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.5s ease ${delay * 0.08}s, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${delay * 0.08}s`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* Accent gradient blob */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: styles.accent,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-10">
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <p style={{
            fontSize: 'clamp(0.7rem, 2.5vw, 0.8125rem)',
            fontWeight: 500,
            color: '#64748B',
            letterSpacing: '0.01em',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            lineHeight: 1.3,
          }}>
            {label}
          </p>
          {icon && (
            <div style={{
              width: 30,
              height: 30,
              borderRadius: '0.5rem',
              background: styles.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: styles.iconColor,
              flexShrink: 0,
            }}>
              {icon}
            </div>
          )}
        </div>

        {/* KPI Value */}
        <p className="kpi-value" style={{
          fontSize: format === 'cedis' ? 'clamp(1rem, 3.5vw, 1.75rem)' : 'clamp(1.25rem, 4vw, 2rem)',
          color: '#0F172A',
          marginBottom: '0.375rem',
          wordBreak: 'break-all',
          overflowWrap: 'break-word',
          lineHeight: 1.1,
        }}>
          {formatValue(displayValue, format)}
        </p>

        {/* Subtitle */}
        {subtitle && (
          <p className="metric-subtitle" style={{ fontSize: 'clamp(0.62rem, 2vw, 0.75rem)', color: '#94A3B8', marginBottom: '0.375rem', lineHeight: 1.3 }}>
            {subtitle}
          </p>
        )}

        {/* Trend Badge */}
        {trend !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
            <span className={isPositive ? 'trend-up' : 'trend-down'} style={{ fontSize: 'clamp(0.6rem, 2vw, 0.75rem)' }}>
              {isPositive ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
            </span>
            <span className="metric-trend-label" style={{ fontSize: 'clamp(0.58rem, 1.8vw, 0.72rem)', color: '#94A3B8' }}>{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
