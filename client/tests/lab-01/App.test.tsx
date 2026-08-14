import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

afterEach(() => {
  vi.restoreAllMocks();
});

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
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
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
  });

  it('displays a useful error message when the backend is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Backend unavailable')
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
  });
});
