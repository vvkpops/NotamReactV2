import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

// Performance monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

// Report web vitals (optional)
function sendToAnalytics(metric) {
  // You can send metrics to your analytics service here
  console.log('Web Vital:', metric);
}

// Initialize performance monitoring
getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);

// Initialize React app
const root = ReactDOM.createRoot(document.getElementById('root'));

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#e2e8f0',
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            padding: '40px',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            maxWidth: '500px'
          }}>
            <h1 style={{ color: '#ef4444', marginBottom: '20px', fontSize: '1.5rem' }}>
              ⚠️ Application Error
            </h1>
            <p style={{ marginBottom: '20px', color: '#94a3b8' }}>
              The NOTAM Dashboard encountered an unexpected error and needs to be reloaded.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#06b6d4',
                color: '#0f172a',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '1rem'
              }}
            >
              🔄 Reload Application
            </button>
            {process.env.NODE_ENV === 'development' && (
              <details style={{ marginTop: '20px', textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', color: '#fbbf24' }}>
                  Error Details (Development)
                </summary>
                <pre style={{
                  background: '#1e293b',
                  padding: '10px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '0.8rem',
                  marginTop: '10px'
                }}>
                  {this.state.error?.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Render the app with error boundary
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Show the app once it's loaded
document.getElementById('root').classList.add('loaded');
