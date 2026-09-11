import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from '../../src/AuthGate';

afterEach(() => vi.restoreAllMocks());

const authenticatedPayload = {
  user: { id: 1, name: 'Aom S.', email: 'aom@example.test', role: 'REQUESTER' },
  mustChangePassword: false,
  csrfToken: 'csrf-token'
};

describe('Lab 3 login UI', () => {
  it('shows a safe failure then opens the authenticated shell after valid login', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(authenticatedPayload), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<AuthGate><p>Protected requester content</p></AuthGate>);
    await userEvent.type(await screen.findByLabelText('Email'), 'aom@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPassword!2026');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');

    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'Lab3Initial!2026');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Protected requester content')).toBeInTheDocument();
    expect(screen.getByText('Aom S.')).toBeInTheDocument();
    expect(screen.getByText('Requester')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/api/auth/login'), expect.objectContaining({ credentials: 'include' }));

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({ headers: { 'X-CSRF-Token': 'csrf-token' } })
    );
  });

  it('renders loading and backend-unavailable states', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockRejectedValueOnce(new Error('offline'));
    render(<AuthGate><p>Protected</p></AuthGate>);
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
    await userEvent.type(await screen.findByLabelText('Email'), 'aom@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'Lab3Initial!2026');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach TokTickIT');
  });
});
