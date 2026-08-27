import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

afterEach(() => { vi.restoreAllMocks(); });

describe('Development Requester selection', () => {
  it('loads requesters and enters the requester shell after Continue', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ id: 1, name: 'Aom S.' }, { id: 2, name: 'Beam K.' }]), { status: 200 }));
    render(<App />);
    await userEvent.selectOptions(await screen.findByLabelText(/development requester/i), '2');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText('Beam K.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /change requester/i }));
    expect(await screen.findByLabelText(/development requester/i)).toBeInTheDocument();
  });

  it('shows a loading state while requesters are being fetched', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading development requesters/i);
  });

  it('shows an empty state when there are no active requesters', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/no active development requesters/i);
  });

  it('shows a useful error when requesters cannot be loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to load development requesters/i);
  });
});
