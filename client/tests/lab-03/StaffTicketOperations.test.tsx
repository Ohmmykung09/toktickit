import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated } from '../authenticated-render';

const staff = { user: { id: 6, name: 'Ploy IT', email: 'ploy.it@example.test', role: 'IT_STAFF' as const }, mustChangePassword: false, csrfToken: 'csrf' };
const item = { ticketNumber: 'TKT-OPS-1', summary: 'Email access issue', description: 'The requester cannot access university email.', requestedPriority: 'HIGH', itPriority: 'MEDIUM', status: 'NEW', createdAt: '2026-09-11T09:00:00.000Z', updatedAt: '2026-09-11T10:00:00.000Z', requesterResolutionIndicatedAt: null, requester: { id: 1, name: 'Aom S.', email: 'aom@example.test' }, owner: null, category: { id: 1, name: 'Account and Access' }, relatedSystem: { id: 1, name: 'Email' }, attachments: [], publicComments: [], internalNotes: [] };
const queue = { items: [item], filters: { categories: [], relatedSystems: [], owners: [{ id: 6, name: 'Ploy IT', role: 'IT_STAFF' }] }, pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } };

afterEach(() => vi.restoreAllMocks());

describe('IT Staff Ticket Detail operations', () => {
  it('opens a ticket and claims it using the authenticated staff identity', async () => {
    const assigned = { ...item, owner: { id: 6, name: 'Ploy IT', role: 'IT_STAFF' }, updatedAt: '2026-09-11T10:01:00.000Z' };
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(queue), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(item), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 6, name: 'Ploy IT', role: 'IT_STAFF' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(assigned), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderAuthenticated(<App />, staff);
    await userEvent.click(await screen.findByRole('button', { name: 'Open TKT-OPS-1' }));
    expect(await screen.findByRole('heading', { name: 'Email access issue' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Claim ticket' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Ticket updated.');
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/assignment'), expect.objectContaining({ method: 'PATCH' }));
  });
});
