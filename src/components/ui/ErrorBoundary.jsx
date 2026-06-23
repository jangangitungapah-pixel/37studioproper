import { Component } from 'react';

/**
 * React Error Boundary — menangkap runtime errors dari child components
 * agar tidak crash seluruh aplikasi menjadi white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#050506',
          color: '#f7f3ec',
          fontFamily: 'Montserrat, sans-serif',
          padding: '32px',
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: '440px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #ff8a2a, #ff5f15)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 24px',
              fontSize: '28px',
            }}>
              ⚠
            </div>
            <h1 style={{ fontSize: '1.5rem', margin: '0 0 12px', letterSpacing: '-0.04em' }}>
              Terjadi Kesalahan
            </h1>
            <p style={{ margin: '0 0 24px', color: 'rgba(247,243,236,0.6)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              Halaman ini mengalami error yang tidak terduga. Coba muat ulang halaman, atau hubungi admin jika masalah berlanjut.
            </p>
            {this.state.error && (
              <pre style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '0.75rem',
                textAlign: 'left',
                color: '#ff6b6b',
                overflowX: 'auto',
                marginBottom: '24px',
              }}>
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #ff8a2a, #ff5f15)',
                border: 'none',
                borderRadius: '14px',
                color: '#fff',
                fontWeight: '800',
                fontSize: '0.9rem',
                padding: '12px 24px',
                cursor: 'pointer',
              }}
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
