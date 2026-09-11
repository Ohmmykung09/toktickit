import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated, requesterAuth } from '../authenticated-render';

afterEach(() => { vi.restoreAllMocks(); });

describe('Authenticated Requester identity', () => {
  it('uses the signed-in requester without a development selector', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Network' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } }), { status: 200 }));
    renderAuthenticated(<App />);

    expect(await screen.findByText(/support requests created by aom s\./i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/development requester/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change requester/i })).not.toBeInTheDocument();
  });

  it('does not show requester actions to a staff account', () => {
    renderAuthenticated(<App />, {
      ...requesterAuth,
      user: { id: 8, name: 'Narin S.', email: 'narin@example.test', role: 'IT_STAFF' }
    });

    expect(screen.getByText(/no requester workspace/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open my tickets/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open create ticket/i })).not.toBeInTheDocument();
  });
});
