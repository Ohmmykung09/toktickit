import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated } from '../authenticated-render';

const staff = { user: { id: 6, name: 'Ploy IT', email: 'ploy.it@example.test', role: 'IT_STAFF' as const }, mustChangePassword: false, csrfToken: 'csrf' };
const response = { items: [{ ticketNumber: 'TKT-9003', summary: 'Wi-Fi disconnects', requestedPriority: 'CRITICAL', itPriority: 'HIGH', status: 'IN_PROGRESS', updatedAt: '2026-09-11T10:00:00.000Z', requester: { id: 3, name: 'Mew P.', email: 'mew@example.test' }, owner: { id: 6, name: 'Ploy IT', role: 'IT_STAFF' }, category: { id: 4, name: 'Network' }, relatedSystem: { id: 1, name: 'Campus Wi-Fi' } }], filters: { categories: [{ id: 4, name: 'Network' }], relatedSystems: [{ id: 1, name: 'Campus Wi-Fi' }], owners: [{ id: 6, name: 'Ploy IT', role: 'IT_STAFF' }] }, pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } };

afterEach(() => vi.restoreAllMocks());

describe('IT Staff Ticket Queue', () => {
  it('renders API ticket data and submits filters', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderAuthenticated(<App />, staff);
    expect((await screen.findAllByText('Wi-Fi disconnects')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mew P.').length).toBeGreaterThan(0);
    await userEvent.type(screen.getByLabelText('Search tickets'), 'Wi-Fi');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('search=Wi-Fi'),
      expect.objectContaining({ credentials: 'include' })
    ));
  });

  it('shows a recoverable queue failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    renderAuthenticated(<App />, staff);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach TokTickIT');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
