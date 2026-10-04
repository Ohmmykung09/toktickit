import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AuthenticatedProvider, type AuthPayload } from '../src/AuthGate';

export const requesterAuth: AuthPayload = {
  user: { id: 1, name: 'Aom S.', email: 'aom@example.test', role: 'REQUESTER' },
  mustChangePassword: false,
  csrfToken: 'test-csrf-token'
};

export function renderAuthenticated(ui: ReactElement, payload: AuthPayload = requesterAuth) {
  return render(<AuthenticatedProvider payload={payload}>{ui}</AuthenticatedProvider>);
}
