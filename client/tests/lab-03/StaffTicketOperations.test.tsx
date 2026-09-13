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

  it('renders active and removed attachments plus literal public/private history safely', async () => {
    const detail = {
      ...item,
      attachments: [
        { id: 1, originalFileName: 'evidence.pdf', mimeType: 'application/pdf', sizeBytes: 2048, createdAt: '2026-09-11T09:00:00.000Z', removedAt: null, removalReason: null },
        { id: 2, originalFileName: 'old.png', mimeType: 'image/png', sizeBytes: 1024, createdAt: '2026-09-11T08:00:00.000Z', removedAt: '2026-09-11T09:30:00.000Z', removalReason: 'Superseded evidence' }
      ],
      publicComments: [{ id: 1, content: '<script>public literal</script>', createdAt: '2026-09-11T09:00:00.000Z', author: { id: 1, name: 'Aom S.', role: 'REQUESTER' } }],
      internalNotes: [{ id: 2, content: '<script>private literal</script>', createdAt: '2026-09-11T09:05:00.000Z', author: { id: 6, name: 'Ploy IT', role: 'IT_STAFF' } }]
    };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(queue), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 6, name: 'Ploy IT', role: 'IT_STAFF' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderAuthenticated(<App />, staff);
    await userEvent.click(await screen.findByRole('button', { name: 'Open TKT-OPS-1' }));
    expect(await screen.findByText('evidence.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByText('Removed: Superseded evidence')).toBeInTheDocument();
    expect(screen.getByText('<script>public literal</script>')).toBeInTheDocument();
    expect(screen.getByText('<script>private literal</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
});
