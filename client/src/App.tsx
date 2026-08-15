import { useState } from 'react';

type HealthStatus = 'idle' | 'loading' | 'online' | 'offline';

type HealthResponse = {
  status: string;
  service: string;
};

type Category = {
  id: number;
  name: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export function App() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);

  async function checkSystem() {
    setHealthStatus('loading');
    setMessage('');
    setCategories([]);

    try {
      const healthResponse = await fetch(`${apiBaseUrl}/api/health`);

      if (!healthResponse.ok) {
        throw new Error('Health check failed');
      }

      const health = (await healthResponse.json()) as HealthResponse;

      if (health.status !== 'ok' || health.service !== 'TokTickIT API') {
        throw new Error('Unexpected health check response');
      }

      const categoriesResponse = await fetch(`${apiBaseUrl}/api/categories`);

      if (!categoriesResponse.ok) {
        throw new Error('Category request failed');
      }

      const categoryList = (await categoriesResponse.json()) as Category[];

      setHealthStatus('online');
      setMessage('TokTickIT API is online.');
      setCategories(categoryList);
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
            Loading system status...
          </p>
        )}

        {healthStatus === 'online' && (
          <div className="alert alert-success mt-4 mb-0" role="status">
            <p className="mb-1">
              <strong>System Status:</strong> Online
            </p>
            <p className="mb-0">{message}</p>
            {categories.length > 0 && (
              <div className="mt-3">
                <h2 className="h5">Supported Request Categories</h2>
                <ol className="mb-0">
                  {categories.map((category) => (
                    <li key={category.id}>{category.name}</li>
                  ))}
                </ol>
              </div>
            )}
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
