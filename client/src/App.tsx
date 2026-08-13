import { useState } from 'react';

type HealthStatus = 'idle' | 'loading' | 'online' | 'offline';

type HealthResponse = {
  status: string;
  service: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export function App() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle');
  const [message, setMessage] = useState<string>('');

  async function checkSystem() {
    setHealthStatus('loading');
    setMessage('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/health`);

      if (!response.ok) {
        throw new Error('Health check failed');
      }

      const health = (await response.json()) as HealthResponse;

      if (health.status !== 'ok' || health.service !== 'TokTickIT API') {
        throw new Error('Unexpected health check response');
      }

      setHealthStatus('online');
      setMessage('TokTickIT API is online.');
    } catch {
      setHealthStatus('offline');
      setMessage('Unable to connect to TokTickIT API.');
    }
  }

  return (
    <main className="container py-5">
      <section className="border rounded p-4 shadow-sm">
        <h1 className="mb-3">TokTickIT IT Service Desk</h1>
        <button
          className="btn btn-primary"
          disabled={healthStatus === 'loading'}
          onClick={checkSystem}
          type="button"
        >
          Check System
        </button>

        {healthStatus === 'loading' && (
          <p className="mt-4 mb-0" role="status">
            Checking system status...
          </p>
        )}

        {healthStatus === 'online' && (
          <div className="alert alert-success mt-4 mb-0" role="status">
            <p className="mb-1">
              <strong>System Status:</strong> Online
            </p>
            <p className="mb-0">{message}</p>
          </div>
        )}

        {healthStatus === 'offline' && (
          <div className="alert alert-danger mt-4 mb-0" role="alert">
            <p className="mb-1">
              <strong>System Status:</strong> Offline
            </p>
            <p className="mb-0">{message}</p>
          </div>
        )}
      </section>
    </main>
  );
}
