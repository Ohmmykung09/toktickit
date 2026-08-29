import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

afterEach(() => vi.restoreAllMocks());

describe('My Tickets and Ticket Detail', () => {
  it('renders requester-owned API ticket data and opens its detail', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Aom S.' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ ticketNumber: 'TKT-20260828-0001', summary: 'Campus Wi-Fi is unavailable', category: { id: 1, name: 'Network' }, status: 'New', requestedPriority: 'High', updatedAt: '2026-08-28T10:00:00.000Z' }], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ticketNumber: 'TKT-20260828-0001', summary: 'Campus Wi-Fi is unavailable', description: 'The campus Wi-Fi connection fails on my assigned laptop.', category: { id: 1, name: 'Network' }, relatedSystem: { id: 2, name: 'Campus Wi-Fi' }, status: 'New', requestedPriority: 'High', createdAt: '2026-08-28T09:00:00.000Z', updatedAt: '2026-08-28T10:00:00.000Z', attachments: [] }), { status: 200 }));
    render(<App />);

    await userEvent.selectOptions(await screen.findByLabelText(/development requester/i), '1');
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(await screen.findByText('Campus Wi-Fi is unavailable')).toBeInTheDocument();
    expect(screen.getByText('TKT-20260828-0001')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'TKT-20260828-0001' }));

    expect(await screen.findByText(/the campus wi-fi connection fails/i)).toBeInTheDocument();
    expect(screen.getByText('Campus Wi-Fi')).toBeInTheDocument();
  });

  it('shows a useful message when the ticket list cannot be loaded', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Aom S.' }]), { status: 200 }))
      .mockRejectedValueOnce(new Error('offline'));
    render(<App />);

    await userEvent.selectOptions(await screen.findByLabelText(/development requester/i), '1');
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to load your tickets/i);
  });
});
