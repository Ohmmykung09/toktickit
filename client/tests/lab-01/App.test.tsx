import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated } from '../authenticated-render';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TokTickIT foundation UI', () => {
  it('renders the TokTickIT heading', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    renderAuthenticated(<App />);

    expect(
      screen.getByRole('heading', { name: /my tickets/i })
    ).toBeInTheDocument();
  });

  it('shows a Bootstrap primary button', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    renderAuthenticated(<App />);

    expect(screen.getByRole('button', { name: /check system/i })).toHaveClass(
      'btn',
      'btn-primary'
    );
  });

  it('displays the backend status after a successful health check', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ok',
            service: 'TokTickIT API'
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 101, name: 'Custom Access' },
            { id: 102, name: 'Loaner Devices' },
            { id: 103, name: 'Cloud Apps' },
            { id: 104, name: 'Campus Network' }
          ]),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        )
      );

    renderAuthenticated(<App />);

    await userEvent.click(screen.getByRole('button', { name: /check system/i }));

    expect(
      await screen.findByText(/system status:/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/system status:/i).parentElement).toHaveTextContent(
      'System Status: Online'
    );
    expect(screen.getByText(/toktickit api is online/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /supported request categories/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Custom Access')).toBeInTheDocument();
    expect(screen.getByText('Loaner Devices')).toBeInTheDocument();
    expect(screen.getByText('Cloud Apps')).toBeInTheDocument();
    expect(screen.getByText('Campus Network')).toBeInTheDocument();
    expect(screen.queryByText('Account and Access')).not.toBeInTheDocument();
  });

  it('displays a useful error message when the category request fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ok',
            service: 'TokTickIT API'
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Database unavailable' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );

    renderAuthenticated(<App />);

    await userEvent.click(screen.getByRole('button', { name: /check system/i }));

    expect(
      await screen.findByText(/system status:/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/system status:/i).parentElement).toHaveTextContent(
      'System Status: Offline'
    );
    expect(
      screen.getByText(/unable to connect to toktickit api/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /supported request categories/i })
    ).not.toBeInTheDocument();
  });

  it('shows a loading state while the system check is in progress', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } }), { status: 200 }))
      .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(
                JSON.stringify({
                  status: 'ok',
                  service: 'TokTickIT API'
                })
              )
            );
          }, 100);
        })
    );

    renderAuthenticated(<App />);

    await userEvent.click(screen.getByRole('button', { name: /check system/i }));

    expect(screen.getByRole('status')).toHaveTextContent(
      /loading system status/i
    );
  });

  it('displays a useful error message when the backend is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } }), { status: 200 }))
      .mockRejectedValueOnce(new Error('Backend unavailable'));

    renderAuthenticated(<App />);

    await userEvent.click(screen.getByRole('button', { name: /check system/i }));

    expect(
      await screen.findByText(/system status:/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/system status:/i).parentElement).toHaveTextContent(
      'System Status: Offline'
    );
    expect(
      screen.getByText(/unable to connect to toktickit api/i)
    ).toBeInTheDocument();
  });
});
