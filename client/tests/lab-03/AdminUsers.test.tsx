import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated } from '../authenticated-render';

const administrator = { user: { id: 10, name: 'TokTickIT Admin', email: 'admin@example.test', role: 'ADMINISTRATOR' as const }, mustChangePassword: false, csrfToken: 'csrf' };
const existing = { id: 1, name: 'Aom S.', email: 'aom@example.test', role: 'REQUESTER', isActive: true, mustChangePassword: false, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

afterEach(() => vi.restoreAllMocks());

describe('Administrator user management', () => {
  it('renders allowlisted user data and creates a user', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([existing]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...existing, id: 2, name: 'New Staff', email: 'new.staff@example.test', role: 'IT_STAFF', mustChangePassword: true }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([existing]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderAuthenticated(<App />, administrator);
    expect(await screen.findAllByText('aom@example.test')).toHaveLength(2);
    await userEvent.type(screen.getByLabelText('User name'), 'New Staff');
    await userEvent.type(screen.getByLabelText('User email'), 'new.staff@example.test');
    await userEvent.selectOptions(screen.getByLabelText('User role'), 'IT_STAFF');
    await userEvent.type(screen.getByLabelText('Initial password'), 'InitialPass123!');
    await userEvent.type(screen.getByLabelText('Confirm initial password'), 'InitialPass123!');
    await userEvent.click(screen.getByRole('button', { name: 'Submit create user' }));
    expect(await screen.findByRole('status')).toHaveTextContent('User created.');
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/api/admin/users'), expect.objectContaining({ method: 'POST' }));
  });

  it('shows a safe failure with retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    renderAuthenticated(<App />, administrator);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach TokTickIT');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('edits activation and role, then resets the initial password through explicit controls', async () => {
    const changed = { ...existing, role: 'REQUESTER' as const, isActive: false, mustChangePassword: true };
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([existing]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(changed), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([changed]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([changed]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    renderAuthenticated(<App />, administrator);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Aom S.' }));
    await userEvent.selectOptions(screen.getByLabelText('User role'), 'REQUESTER');
    await userEvent.click(screen.getByLabelText('Active account'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit user changes' }));
    expect(await screen.findByRole('status')).toHaveTextContent('User updated.');
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/api/admin/users/1'), expect.objectContaining({
      method: 'PATCH',
      body: expect.stringContaining('"isActive":false')
    }));

    await userEvent.click(screen.getByRole('button', { name: 'Edit Aom S.' }));
    await userEvent.type(screen.getByLabelText('New initial password'), 'Replacement123!');
    await userEvent.type(screen.getByLabelText('Confirm new initial password'), 'Replacement123!');
    await userEvent.click(screen.getByRole('button', { name: 'Set initial password' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Initial password updated and existing sessions revoked.');
    expect(fetch).toHaveBeenNthCalledWith(4, expect.stringContaining('/api/admin/users/1/initial-password'), expect.objectContaining({ method: 'POST' }));
  });

  it('shows the administrator safety conflict returned by the API', async () => {
    const protectedAdministrator = { ...existing, role: 'ADMINISTRATOR' as const };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([protectedAdministrator]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'ADMIN_SAFETY_RULE', message: 'At least one active Administrator must remain.' } }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
    renderAuthenticated(<App />, administrator);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Aom S.' }));
    await userEvent.selectOptions(screen.getByLabelText('User role'), 'IT_STAFF');
    await userEvent.click(screen.getByRole('button', { name: 'Submit user changes' }));
    expect(await screen.findByRole('status')).toHaveTextContent('At least one active Administrator must remain.');
  });
});
