import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from '../../src/AuthGate';

afterEach(() => vi.restoreAllMocks());

const initialPayload = {
  user: { id: 1, name: 'Aom S.', email: 'aom@example.test', role: 'REQUESTER' },
  mustChangePassword: true,
  csrfToken: 'initial-csrf-token'
};

describe('Lab 3 mandatory password change UI', () => {
  it('keeps protected content hidden until matching valid values succeed', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(initialPayload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...initialPayload, mustChangePassword: false, csrfToken: 'replacement-token' }), { status: 200 }));

    render(<AuthGate><p>Requester workspace</p></AuthGate>);
    expect(await screen.findByRole('heading', { name: 'Change initial password' })).toBeInTheDocument();
    expect(screen.queryByText('Requester workspace')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Current password'), 'Lab3Initial!2026');
    await userEvent.type(screen.getByLabelText('New password'), 'PrivatePass!2026');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'DifferentPass!2026');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByRole('alert')).toHaveTextContent('must match');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await userEvent.clear(screen.getByLabelText('Confirm new password'));
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'PrivatePass!2026');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Requester workspace')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/auth/change-password'),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-CSRF-Token': 'initial-csrf-token' }) })
    );
  });
});
