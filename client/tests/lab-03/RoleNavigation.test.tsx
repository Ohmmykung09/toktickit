import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { AuthGate } from '../../src/AuthGate';
import { renderAuthenticated } from '../authenticated-render';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Lab 3 role navigation and session boundaries', () => {
  it('shows only destinations permitted for each authenticated role', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ items: [], filters: { categories: [], relatedSystems: [], owners: [] }, pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));
    const base = { mustChangePassword: false, csrfToken: 'csrf' };

    const requester = renderAuthenticated(<App />, { ...base, user: { id: 1, name: 'Requester', email: 'requester@example.test', role: 'REQUESTER' } });
    expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ticket Queue' })).not.toBeInTheDocument();
    requester.unmount();

    const staff = renderAuthenticated(<App />, { ...base, user: { id: 2, name: 'Staff', email: 'staff@example.test', role: 'IT_STAFF' } });
    expect(await screen.findByRole('heading', { name: 'Ticket Queue' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open My Tickets' })).not.toBeInTheDocument();
    staff.unmount();

    renderAuthenticated(<App />, { ...base, user: { id: 3, name: 'Admin', email: 'admin@example.test', role: 'ADMINISTRATOR' } });
    expect(await screen.findByRole('heading', { name: 'User Management' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ticket Queue' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Create Ticket' })).not.toBeInTheDocument();
  });

  it('removes protected content when no current session can be restored', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: { code: 'UNAUTHENTICATED' } }, 401));
    render(<AuthGate><App /></AuthGate>);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Tickets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ticket Queue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'User Management' })).not.toBeInTheDocument();
  });

  it('logs out and clears the authenticated shell', async () => {
    const payload = { user: { id: 1, name: 'Requester', email: 'requester@example.test', role: 'REQUESTER' }, mustChangePassword: false, csrfToken: 'csrf' };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(payload))
      .mockResolvedValueOnce(json({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<AuthGate><App /></AuthGate>);
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Tickets' })).not.toBeInTheDocument();
  });
});
