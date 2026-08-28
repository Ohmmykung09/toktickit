import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const requesterResponse = () => new Response(JSON.stringify([{ id: 1, name: 'Aom S.' }]), { status: 200 });
const ticketListResponse = () => new Response(JSON.stringify({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } }), { status: 200 });
const categoryResponse = () => new Response(JSON.stringify([{ id: 10, name: 'Network' }]), { status: 200 });
const systemResponse = () => new Response(JSON.stringify([{ id: 20, name: 'Campus Wi-Fi' }]), { status: 200 });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openCreateTicket() {
  await userEvent.selectOptions(await screen.findByLabelText(/development requester/i), '1');
  await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  await userEvent.click(screen.getByRole('button', { name: /open create ticket/i }));
  await screen.findByLabelText(/^category/i);
}

async function completeTicketForm() {
  await userEvent.selectOptions(screen.getByLabelText(/^category/i), '10');
  await userEvent.selectOptions(screen.getByLabelText(/related system/i), '20');
  await userEvent.type(screen.getByLabelText(/ticket summary/i), 'Campus Wi-Fi connection fails');
  await userEvent.type(screen.getByLabelText(/^description/i), 'My campus Wi-Fi connection fails on the assigned laptop.');
}

describe('Create Ticket', () => {
  it('submits API lookup values for the selected requester and displays the new ticket number', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'a5a095f9-8eaf-48b9-bd62-bfc7b7d65610' });
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(requesterResponse())
      .mockResolvedValueOnce(ticketListResponse())
      .mockResolvedValueOnce(categoryResponse())
      .mockResolvedValueOnce(systemResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ ticketNumber: 'TKT-20260824-0001', status: 'New', createdAt: '2026-08-24T12:00:00.000Z' }), { status: 201 }));
    render(<App />);

    await openCreateTicket();
    await completeTicketForm();
    await userEvent.click(screen.getByRole('button', { name: /^create ticket$/i }));

    expect(await screen.findByText(/ticket created successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/TKT-20260824-0001/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:3000/api/tickets', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-Development-Requester-Id': '1', 'Idempotency-Key': 'a5a095f9-8eaf-48b9-bd62-bfc7b7d65610' }), body: expect.stringContaining('Campus Wi-Fi connection fails') }));
  });

  it('shows adjacent validation feedback before submitting an incomplete form', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(requesterResponse()).mockResolvedValueOnce(ticketListResponse()).mockResolvedValueOnce(categoryResponse()).mockResolvedValueOnce(systemResponse());
    render(<App />);

    await openCreateTicket();
    await userEvent.click(screen.getByRole('button', { name: /^create ticket$/i }));

    expect(screen.getByText('Choose a category.')).toBeInTheDocument();
    expect(screen.getByText('Choose a related system.')).toBeInTheDocument();
    expect(screen.getByText(/summary must contain 5 to 120/i)).toBeInTheDocument();
    expect(screen.getByText(/description must contain 10 to 2,000/i)).toBeInTheDocument();
  });

  it('retains entered values and shows a useful error after a create request fails', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'a5a095f9-8eaf-48b9-bd62-bfc7b7d65610' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(requesterResponse()).mockResolvedValueOnce(ticketListResponse()).mockResolvedValueOnce(categoryResponse()).mockResolvedValueOnce(systemResponse()).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Ticket service is unavailable.' }), { status: 500 }));
    render(<App />);

    await openCreateTicket();
    await completeTicketForm();
    await userEvent.click(screen.getByRole('button', { name: /^create ticket$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ticket service is unavailable/i);
    expect(screen.getByLabelText(/ticket summary/i)).toHaveValue('Campus Wi-Fi connection fails');
  });
});
