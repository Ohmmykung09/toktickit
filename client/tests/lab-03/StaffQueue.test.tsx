import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated, requesterAuth } from '../authenticated-render';

const staff = { user: { id: 6, name: 'Ploy IT', email: 'ploy.it@example.test', role: 'IT_STAFF' as const }, mustChangePassword: false, csrfToken: 'csrf' };
const item = { ticketNumber: 'TKT-9003', summary: 'Wi-Fi disconnects', requestedPriority: 'CRITICAL', itPriority: 'HIGH', status: 'IN_PROGRESS', updatedAt: '2026-09-11T10:00:00.000Z', requester: { id: 3, name: 'Mew P.', email: 'mew@example.test' }, owner: { id: 6, name: 'Ploy IT', role: 'IT_STAFF' }, category: { id: 4, name: 'Network' }, relatedSystem: { id: 1, name: 'Campus Wi-Fi' } };
const queue = (items = [item], page = 1, totalPages = 2) => ({ items, filters: { categories: [{ id: 4, name: 'Network' }], relatedSystems: [{ id: 1, name: 'Campus Wi-Fi' }], owners: [{ id: 6, name: 'Ploy IT', role: 'IT_STAFF' }] }, pagination: { page, pageSize: 20, totalItems: items.length ? 21 : 0, totalPages: items.length ? totalPages : 0 } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.restoreAllMocks());

describe('IT Staff Ticket Queue', () => {
  it('shows loading before rendering API data in table and mobile-card structures', async () => {
    let resolve!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((done) => { resolve = done; }));
    const { container } = renderAuthenticated(<App />, staff);
    expect(screen.getByRole('status')).toHaveTextContent('Loading ticket queue');
    resolve(json(queue()));
    expect((await screen.findAllByText('Wi-Fi disconnects')).length).toBe(2);
    expect(container.querySelector('.queue-table-wrap')).toBeInTheDocument();
    expect(container.querySelector('.queue-cards')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open my tickets/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open create ticket/i })).not.toBeInTheDocument();
  });

  it('distinguishes an empty queue from filtered no-results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(queue([], 1, 0))).mockResolvedValueOnce(json(queue([], 1, 0)));
    renderAuthenticated(<App />, staff);
    expect(await screen.findByRole('heading', { name: 'No tickets yet' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Search tickets'), 'missing');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('heading', { name: 'No matching tickets' })).toBeInTheDocument();
  });

  it('submits filters and uses server pagination', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(queue())).mockResolvedValueOnce(json(queue())).mockResolvedValueOnce(json(queue([item], 2, 2)));
    renderAuthenticated(<App />, staff);
    await screen.findAllByText('Wi-Fi disconnects');
    await userEvent.type(screen.getByLabelText('Search tickets'), 'Wi-Fi');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'IN_PROGRESS');
    await userEvent.selectOptions(screen.getByLabelText('Owner'), 'me');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringMatching(/search=Wi-Fi.*status=IN_PROGRESS.*owner=me/), expect.objectContaining({ credentials: 'include' })));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=2'), expect.any(Object)));
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('renders a specific forbidden state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }, 403));
    renderAuthenticated(<App />, staff);
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission');
  });

  it('retries a recoverable network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json(queue()));
    renderAuthenticated(<App />, staff);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach TokTickIT');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect((await screen.findAllByText('Wi-Fi disconnects')).length).toBe(2);
  });

  it('does not expose requester actions to an Administrator', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(queue()));
    renderAuthenticated(<App />, { ...requesterAuth, user: { id: 10, name: 'Admin', email: 'admin@example.test', role: 'ADMINISTRATOR' } });
    await userEvent.click(screen.getByRole('button', { name: 'Ticket Queue' }));
    expect(await screen.findByRole('heading', { name: 'Ticket Queue' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open my tickets/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open create ticket/i })).not.toBeInTheDocument();
  });
});
