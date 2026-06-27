import React from 'react';

export default function NetworkErrorScreen({ onRetry }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', padding: '20px', textAlign: 'center',
      background: 'var(--paper)'
    }}>
      <div className="empty-state">
        <div className="icon">📡</div>
        <h3>Network Error</h3>
        <p style={{ maxWidth: '300px', margin: '0 auto 20px', color: '#6b6557' }}>
          Unable to connect to the server. Please check your internet connection or try again later.
        </p>
        <button className="btn btn-primary" onClick={onRetry}>
          Try Again
        </button>
      </div>
    </div>
  );
}
