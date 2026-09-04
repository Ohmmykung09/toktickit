import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

function ticketList() {
  return { items: [{ ticketNumber: 'TKT-20260828-0002', summary: 'Upload evidence', category: { id: 1, name: 'Network' }, status: 'New', requestedPriority: 'Low', updatedAt: '2026-08-28T10:00:00.000Z' }], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } };
}

function ticketDetail(attachments: Array<{ id: number; originalFileName: string; mimeType: string; sizeBytes: number; createdAt: string; removedAt: string | null; removalReason: string | null }> = []) {
  return { ...ticketList().items[0], description: 'A ticket detail that is long enough for the attachment test.', relatedSystem: { id: 2, name: 'Campus Wi-Fi' }, createdAt: '2026-08-28T09:00:00.000Z', attachments };
}

async function openAttachmentSection() {
  await userEvent.selectOptions(await screen.findByLabelText(/development requester/i), '1');
  await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  await userEvent.click(await screen.findByRole('button', { name: 'TKT-20260828-0002' }));
  await screen.findByLabelText(/attachment file/i);
}

afterEach(() => vi.restoreAllMocks());

describe('Attachment section', () => {
  it('uploads a permitted file and displays metadata returned by the API', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Aom S.' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Network' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ticketList()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ticketDetail()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 7, originalFileName: 'evidence.pdf', mimeType: 'application/pdf', sizeBytes: 1200, createdAt: '2026-08-28T11:00:00.000Z', removedAt: null, removalReason: null }), { status: 201 }));
    render(<App />);

    await openAttachmentSection();
    await userEvent.upload(screen.getByLabelText(/attachment file/i), new File(['evidence'], 'evidence.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByText(/attachment uploaded successfully/i)).toBeInTheDocument();
    expect(screen.getAllByText(/evidence.pdf/i).length).toBeGreaterThan(0);
  });

  it('rejects an invalid file before sending it to the API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Aom S.' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Network' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ticketList()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ticketDetail()), { status: 200 }));
    render(<App />);

    await openAttachmentSection();
    await userEvent.upload(screen.getByLabelText(/attachment file/i), new File(['notes'], 'notes.txt', { type: 'text/plain' }), { applyAccept: false });
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(screen.getByText(/choose a jpg/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('retains removed attachment metadata and its reason when the API returns 204 No Content', async () => {
    const attachment = { id: 7, originalFileName: 'evidence.pdf', mimeType: 'application/pdf', sizeBytes: 1200, createdAt: '2026-08-28T11:00:00.000Z', removedAt: null, removalReason: null };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Aom S.' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Network' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ticketList()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ticketDetail([attachment])), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<App />);

    await openAttachmentSection();
    await userEvent.type(screen.getByLabelText(/removal reason for evidence.pdf/i), 'Uploaded the wrong evidence file.');
    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }));

    expect(await screen.findByText(/attachment removed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/evidence.pdf/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/reason: uploaded the wrong evidence file/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^download$/i })).not.toBeInTheDocument();
  });

  it('shows a useful upload error when the server returns a non-JSON 413 response', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Aom S.' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Network' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ticketList()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ticketDetail()), { status: 200 }))
      .mockResolvedValueOnce(new Response('<html>Payload Too Large</html>', { status: 413, headers: { 'Content-Type': 'text/html' } }));
    render(<App />);

    await openAttachmentSection();
    await userEvent.upload(screen.getByLabelText(/attachment file/i), new File(['evidence'], 'evidence.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByText(/attachment is too large/i)).toBeInTheDocument();
  });
});
