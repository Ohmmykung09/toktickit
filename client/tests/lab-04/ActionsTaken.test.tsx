import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated } from '../authenticated-render';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const staff = { user: { id: 6, name: 'Ploy IT', email: 'ploy.it@example.test', role: 'IT_STAFF' as const }, mustChangePassword: false, csrfToken: 'csrf' };
const ticket = { ticketNumber: 'TKT-ACTION-UI', summary: 'VPN access issue', description: 'The requester cannot connect to the VPN.', requestedPriority: 'HIGH', itPriority: 'MEDIUM', status: 'OPEN', createdAt: '2026-09-11T09:00:00.000Z', updatedAt: '2026-09-11T10:00:00.000Z', requesterResolutionIndicatedAt: null, requester: { id: 1, name: 'Aom S.', email: 'aom@example.test' }, owner: { id: 6, name: 'Ploy IT', role: 'IT_STAFF' }, category: { id: 1, name: 'Account and Access' }, relatedSystem: { id: 1, name: 'VPN' }, attachments: [], publicComments: [], internalNotes: [], actionsTaken: [] };
const queue = { items: [ticket], filters: { categories: [], relatedSystems: [], owners: [{ id: 6, name: 'Ploy IT', role: 'IT_STAFF' }] }, pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } };
const action = { id: 41, actionDateTime: '2026-09-11T11:00:00.000Z', status: 'OPEN', description: 'Reviewed VPN policy.', result: 'Access rule requires an update.', assignee: { id: 6, name: 'Ploy IT', role: 'IT_STAFF' }, createdBy: { id: 6, name: 'Ploy IT', role: 'IT_STAFF' }, performedBy: { id: 6, name: 'Ploy IT', role: 'IT_STAFF' }, followUpRequired: true, followUpNote: 'Confirm access with requester.', attachmentNotes: null, version: 1, completedAt: null, cancelledAt: null };

afterEach(() => vi.restoreAllMocks());

async function openDetail() {
  await userEvent.click(await screen.findByRole('button', { name: 'Open TKT-ACTION-UI' }));
  await screen.findByRole('heading', { name: 'VPN access issue' });
}

describe('Lab 4 Actions Taken UI', () => {
  it('renders the staff list and validates required follow-up note before create', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(queue)).mockResolvedValueOnce(json({ ...ticket, actionsTaken: [action] })).mockResolvedValueOnce(json([{ id: 6, name: 'Ploy IT', role: 'IT_STAFF' }]));
    renderAuthenticated(<App />, staff);
    await openDetail();
    expect(await screen.findByText('Reviewed VPN policy.')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'create action description' }), 'Checked the VPN logs.');
    await userEvent.type(screen.getByRole('textbox', { name: 'create action result' }), 'The rule is ready for approval.');
    await userEvent.click(screen.getByRole('checkbox', { name: /Follow-Up Required/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Add Action Taken' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Follow-up Note is required');
  });

  it('creates an Action Taken and sends the authenticated idempotency header', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(queue)).mockResolvedValueOnce(json(ticket)).mockResolvedValueOnce(json([{ id: 6, name: 'Ploy IT', role: 'IT_STAFF' }])).mockResolvedValueOnce(json(action, 201)).mockResolvedValueOnce(json([action]));
    renderAuthenticated(<App />, staff);
    await openDetail();
    await userEvent.type(screen.getByRole('textbox', { name: 'create action description' }), 'Checked the VPN logs.');
    await userEvent.type(screen.getByRole('textbox', { name: 'create action result' }), 'The rule is ready for approval.');
    await userEvent.click(screen.getByRole('button', { name: 'Add Action Taken' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Action Taken created.'));
    const request = fetch.mock.calls[3];
    expect(request[1]).toMatchObject({ method: 'POST' });
    expect(new Headers((request[1] as RequestInit).headers).get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('disables repeat submission while a create is pending', async () => {
    let resolveCreate!: (response: Response) => void;
    const pendingCreate = new Promise<Response>((resolve) => { resolveCreate = resolve; });
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(queue))
      .mockResolvedValueOnce(json(ticket))
      .mockResolvedValueOnce(json([{ id: 6, name: 'Ploy IT', role: 'IT_STAFF' }]))
      .mockImplementationOnce(() => pendingCreate)
      .mockResolvedValueOnce(json([action]));
    renderAuthenticated(<App />, staff);
    await openDetail();
    await userEvent.type(screen.getByRole('textbox', { name: 'create action description' }), 'Checked the VPN logs.');
    await userEvent.type(screen.getByRole('textbox', { name: 'create action result' }), 'The rule is ready for approval.');

    const submit = screen.getByRole('button', { name: 'Add Action Taken' });
    await userEvent.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    await userEvent.click(submit);
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);

    resolveCreate(json(action, 201));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Action Taken created.'));
  });

  it('cancels an Action Taken from the edit UI and hides all further edit controls', async () => {
    const cancelledAction = { ...action, status: 'CANCELLED', version: 2, cancelledAt: '2026-09-11T12:00:00.000Z' };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(queue))
      .mockResolvedValueOnce(json({ ...ticket, actionsTaken: [action] }))
      .mockResolvedValueOnce(json([{ id: 6, name: 'Ploy IT', role: 'IT_STAFF' }]))
      .mockResolvedValueOnce(json(cancelledAction))
      .mockResolvedValueOnce(json([cancelledAction]));
    renderAuthenticated(<App />, staff);
    await openDetail();
    const actionCard = screen.getByText('Reviewed VPN policy.').closest('article')!;
    await userEvent.click(within(actionCard).getByRole('button', { name: 'Edit' }));
    await userEvent.selectOptions(screen.getByLabelText('Edit action status'), 'CANCELLED');
    await userEvent.click(screen.getByRole('button', { name: 'Save Action' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Action Taken updated.');
    expect(await within(actionCard).findByText('Cancelled')).toBeInTheDocument();
    expect(within(actionCard).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(fetch.mock.calls[3][1]).toMatchObject({ method: 'PATCH' });
  });
});
