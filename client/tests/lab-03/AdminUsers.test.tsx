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
    expect(await screen.findByText('aom@example.test')).toBeInTheDocument();
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
});
