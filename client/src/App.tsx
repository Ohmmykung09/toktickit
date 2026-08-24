import { useEffect, useState } from 'react';

type Requester = { id: number; name: string };
type Category = { id: number; name: string };
type HealthStatus = 'idle' | 'loading' | 'online' | 'offline';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
export function App() {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [activeId, setActiveId] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle');
  const [categories, setCategories] = useState<Category[]>([]);
  const requester = requesters.find((item) => String(item.id) === activeId);

  useEffect(() => {
    async function load() {
      setLoadState('loading');
      try {
        const response = await fetch(`${apiBaseUrl}/api/development-requesters`);
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as unknown;
        const list = Array.isArray(payload) ? payload as Requester[] : [];
        setRequesters(list);
        setLoadState(list.length ? 'ready' : 'empty');
      } catch { setLoadState('error'); }
    }
    void load();
  }, []);

  function continueAsRequester() {
    setActiveId(selectedId);
  }

  function changeRequester() {
    setActiveId('');
  }

  async function checkSystem() {
    setHealthStatus('loading'); setCategories([]);
    try {
      const health = await fetch(`${apiBaseUrl}/api/health`);
      if (!health.ok) throw new Error();
      const response = await fetch(`${apiBaseUrl}/api/categories`);
      if (!response.ok) throw new Error();
      setCategories((await response.json()) as Category[]);
      setHealthStatus('online');
    } catch { setHealthStatus('offline'); }
  }

  if (requester && loadState === 'ready') {
    return <main className="requester-page min-vh-100"><nav className="navbar border-bottom bg-white"><div className="container"><span className="navbar-brand fw-bold text-success">TokTickIT</span><div className="d-flex gap-3 align-items-center"><span className="small">Requester: <strong>{requester.name}</strong></span><button className="btn btn-outline-success btn-sm" onClick={changeRequester} type="button">Change Requester</button></div></div></nav><section className="container py-5"><h1 className="h3">My Tickets</h1><p className="text-secondary">Tickets for {requester.name} will appear here.</p></section></main>;
  }

  return <main className="container py-5 requester-page"><section className="requester-card mx-auto p-4 p-md-5"><span className="small fw-semibold text-success text-uppercase">TokTickIT</span><h1 className="mt-2">TokTickIT IT Service Desk</h1><p className="text-secondary">Select a Development Requester to test the requester ticket workflow. This is a Lab 2 testing context, not real authentication.</p>
    {loadState === 'loading' && <p role="status">Loading development requesters...</p>}
    {loadState === 'error' && <div className="alert alert-danger" role="alert">Unable to load Development Requesters. Check the backend and try again.</div>}
    {loadState === 'empty' && <div className="alert alert-warning" role="alert">No active Development Requesters are available.</div>}
    {loadState === 'ready' && <><label className="form-label fw-semibold" htmlFor="development-requester">Development Requester</label><select className="form-select" id="development-requester" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Choose a requester</option>{requesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="btn btn-success mt-3" disabled={!selectedId} onClick={continueAsRequester} type="button">Continue</button></>}
    <div className="border-top mt-4 pt-3"><button className="btn btn-primary btn-sm" disabled={healthStatus === 'loading'} onClick={checkSystem} type="button">Check System</button>{healthStatus === 'loading' && <p className="mt-3 mb-0" role="status">Loading system status...</p>}{healthStatus === 'online' && <div className="alert alert-success mt-3 mb-0" role="status"><strong>System Status:</strong> Online<p className="mb-0">TokTickIT API is online.</p>{categories.length > 0 && <><h2 className="h6 mt-3">Supported Request Categories</h2><ol className="mb-0">{categories.map((category) => <li key={category.id}>{category.name}</li>)}</ol></>}</div>}{healthStatus === 'offline' && <div className="alert alert-danger mt-3 mb-0" role="alert"><strong>System Status:</strong> Offline<p className="mb-0">Unable to connect to TokTickIT API.</p></div>}</div>
  </section></main>;
}
