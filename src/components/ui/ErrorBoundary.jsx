import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import Button from './Button.jsx';
import '../../styles/modules/shared.css';

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
        <main className="studio-fatal-page">
          <section className="studio-fatal-panel" role="alert">
            <span className="studio-state-icon is-error" aria-hidden="true">
              <AlertTriangle size={24} />
            </span>
            <h1>Terjadi Kesalahan</h1>
            <p>
              Halaman mengalami error yang tidak terduga. Muat ulang halaman, atau hubungi admin
              jika masalah berlanjut.
            </p>

            {this.state.error ? (
              <details className="studio-fatal-details">
                <summary>Detail teknis</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            ) : null}

            <Button onClick={() => window.location.reload()}>
              <RotateCcw aria-hidden="true" size={16} />
              Muat Ulang Halaman
            </Button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
