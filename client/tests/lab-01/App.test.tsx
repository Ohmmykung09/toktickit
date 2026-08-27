import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

afterEach(() => {
  vi.restoreAllMocks();
});

const requesterResponse = () => new Response(JSON.stringify([{ id: 1, name: 'Aom S.' }]), { status: 200 });

describe('TokTickIT foundation UI', () => {
  it('renders the TokTickIT heading', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /toktickit it service desk/i })
    ).toBeInTheDocument();
  });

  it('shows a Bootstrap primary button', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /check system/i })).toHaveClass(
      'btn',
      'btn-primary'
    );
  });

  it('displays the backend status after a successful health check', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(requesterResponse())
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

    render(<App />);

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
      .mockResolvedValueOnce(requesterResponse())
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

    render(<App />);

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
      .mockResolvedValueOnce(requesterResponse())
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

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /check system/i }));

    expect(screen.getByRole('status')).toHaveTextContent(
      /loading system status/i
    );
  });

  it('displays a useful error message when the backend is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(requesterResponse())
      .mockRejectedValueOnce(new Error('Backend unavailable'));

    render(<App />);

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
