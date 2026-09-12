import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated, requesterAuth } from '../authenticated-render';

afterEach(() => vi.restoreAllMocks());

describe('Lab 3 Requester regression', () => {
  it('opens the owned-ticket workspace directly from authenticated identity', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Network' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [],
        pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 }
      }), { status: 200 }));

    renderAuthenticated(<App />);

    expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();
    expect(screen.getByText(/created by aom s\./i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/development requester/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/testing context/i)).not.toBeInTheDocument();
  });

  it('hides Requester navigation from an authenticated Administrator', () => {
    renderAuthenticated(<App />, {
      ...requesterAuth,
      user: { id: 99, name: 'Admin User', email: 'admin@example.test', role: 'ADMINISTRATOR' }
    });

    expect(screen.queryByRole('button', { name: /open my tickets/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open create ticket/i })).not.toBeInTheDocument();
  });
});
