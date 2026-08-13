import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';

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
});
