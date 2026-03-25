/**
 * WidgetErrorBoundary — Per-widget error boundary
 * Catches render errors in individual dashboard sections
 * without crashing the entire app.
 */

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="glass-card"
          style={{
            padding: "2rem",
            textAlign: "center",
            background: "rgba(239,68,68,0.04)",
            border: "1px solid rgba(239,68,68,0.15)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(239,68,68,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 0.75rem",
              color: "#EF4444",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <p
            style={{
              fontFamily: "Plus Jakarta Sans",
              fontWeight: 600,
              color: "#0F172A",
              fontSize: "0.875rem",
              marginBottom: "0.25rem",
            }}
          >
            {this.props.fallbackTitle || "Widget failed to load"}
          </p>
          <p style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: "0.75rem",
              padding: "0.4rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(79,70,229,0.2)",
              background: "rgba(79,70,229,0.06)",
              color: "#4F46E5",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
