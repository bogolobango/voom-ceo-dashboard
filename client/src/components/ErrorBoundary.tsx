import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '2rem',
          background: 'linear-gradient(135deg, #F0F4FF 0%, #E8F4F8 50%, #F0F0FF 100%)',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            maxWidth: '28rem', width: '100%', padding: '2.5rem',
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            borderRadius: '1.25rem',
            border: '1px solid rgba(255,255,255,0.5)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
          }}>
            <AlertTriangle size={40} color="#DC2626" style={{ marginBottom: '1.25rem' }} />

            <h2 style={{
              fontSize: '1.125rem', fontWeight: 700, color: '#0F172A',
              margin: '0 0 0.5rem', textAlign: 'center',
            }}>
              Something went wrong
            </h2>

            <p style={{
              fontSize: '0.8125rem', color: '#64748B', textAlign: 'center',
              margin: '0 0 1.5rem', lineHeight: 1.5,
            }}>
              An unexpected error occurred. Try reloading — if it persists, check the browser console for details.
            </p>

            <button
              onClick={() => window.location.reload()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.625rem 1.25rem',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: '#fff', border: 'none', borderRadius: '0.75rem',
                fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
              }}
            >
              <RotateCcw size={14} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
