import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated } from '../authenticated-render';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});
const staffAuth = { user: { id: 6, name: 'Ploy IT', email: 'ploy.it@example.test', role: 'IT_STAFF' as const }, mustChangePassword: false, csrfToken: 'csrf' };
const ticket = {
  ticketNumber: 'TKT-COMM-1', summary: 'VPN connection issue', description: 'VPN disconnects repeatedly.',
  requestedPriority: 'High', itPriority: 'HIGH', status: 'OPEN',
  createdAt: '2026-09-11T09:00:00.000Z', updatedAt: '2026-09-11T10:00:00.000Z',
  requesterResolutionIndicatedAt: null,
  requester: { id: 1, name: 'Aom S.', email: 'aom@example.test' }, owner: { id: 6, name: 'Ploy IT', role: 'IT_STAFF' },
  category: { id: 1, name: 'Network' }, relatedSystem: { id: 1, name: 'VPN' }, attachments: [],
  publicComments: [{ id: 1, content: '<script>requester literal</script>\nSecond line', createdAt: '2026-09-11T09:15:00.000Z', author: { id: 1, name: 'Aom S.', role: 'REQUESTER' } }],
  internalNotes: [{ id: 2, content: '<b>private literal</b>', createdAt: '2026-09-11T09:20:00.000Z', author: { id: 6, name: 'Ploy IT', role: 'IT_STAFF' } }]
};

afterEach(() => vi.restoreAllMocks());

describe('Lab 3 comments, notes, and resolution UI', () => {
  it('lets a Requester post a Public Comment and indicate apparent resolution without exposing Internal Notes', async () => {
    const requesterDetail = { ...ticket, internalNotes: undefined };
    const createdComment = { id: 3, content: 'The VPN is stable now.', createdAt: '2026-09-11T10:05:00.000Z', author: { id: 1, name: 'Aom S.', role: 'REQUESTER' } };
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json([{ id: 1, name: 'Network' }]))
      .mockResolvedValueOnce(json({ items: [ticket], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } }))
      .mockResolvedValueOnce(json(requesterDetail))
      .mockResolvedValueOnce(json(createdComment, 201))
      .mockResolvedValueOnce(json({ requesterResolutionIndicatedAt: '2026-09-11T10:06:00.000Z' }));
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    renderAuthenticated(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'TKT-COMM-1' }));
    expect(await screen.findByText(/<script>requester literal<\/script>/)).toBeInTheDocument();
    expect(screen.queryByText(/private literal/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Internal Notes' })).not.toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();

    await userEvent.type(screen.getByLabelText('Add Public Comment'), 'The VPN is stable now.');
    await userEvent.click(screen.getByRole('button', { name: 'Post Public Comment' }));
    expect(await screen.findByText('The VPN is stable now.')).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(4, expect.stringContaining('/public-comments'), expect.objectContaining({ method: 'POST' }));

    await userEvent.click(screen.getByRole('button', { name: 'Problem Appears Resolved' }));
    expect(await screen.findByText(/Problem Appears Resolved recorded/)).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(5, expect.stringContaining('/problem-appears-resolved'), expect.objectContaining({ method: 'POST' }));
  });

  it('keeps Public Comments and Internal Notes visibly distinct for staff and posts both safely', async () => {
    const queue = { items: [ticket], filters: { categories: [], relatedSystems: [], owners: [ticket.owner] }, pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } };
    const publicReply = { id: 3, content: 'Public troubleshooting update', createdAt: '2026-09-11T10:05:00.000Z', author: ticket.owner };
    const privateReply = { id: 4, content: 'Internal escalation context', createdAt: '2026-09-11T10:06:00.000Z', author: ticket.owner };
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(queue))
      .mockResolvedValueOnce(json(ticket))
      .mockResolvedValueOnce(json([ticket.owner]))
      .mockResolvedValueOnce(json(publicReply, 201))
      .mockResolvedValueOnce(json(privateReply, 201));
    renderAuthenticated(<App />, staffAuth);

    await userEvent.click(await screen.findByRole('button', { name: 'Open TKT-COMM-1' }));
    expect(await screen.findByRole('region', { name: 'Public Comments' })).toHaveTextContent('Shared with the Requester');
    expect(screen.getByRole('region', { name: 'Internal Notes' })).toHaveTextContent('Internal - not visible to Requester');
    expect(screen.getByText('<b>private literal</b>')).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Post Public Comment' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Public Comment must contain 1 to 2,000 characters.');
    await userEvent.type(screen.getByLabelText('Add Public Comment'), 'Public troubleshooting update');
    await userEvent.click(screen.getByRole('button', { name: 'Post Public Comment' }));
    expect(await screen.findByText('Public troubleshooting update')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Add Internal Note'), 'Internal escalation context');
    await userEvent.click(screen.getByRole('button', { name: 'Post Internal Note' }));
    expect(await screen.findByText('Internal escalation context')).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(4, expect.stringContaining('/public-comments'), expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(5, expect.stringContaining('/internal-notes'), expect.objectContaining({ method: 'POST' }));
  });
});
