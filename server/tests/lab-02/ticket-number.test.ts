import { describe, expect, it } from 'vitest';
import { ticketNumberPrefix, ticketResponse } from '../../src/ticket-service.js';

describe('Lab 2 ticket number helpers', () => {
  it('formats the UTC date portion of the official ticket number consistently', () => {
    expect(ticketNumberPrefix(new Date('2026-08-29T23:59:59.000Z'))).toBe('TKT-20260829-');
  });

  it('returns only system-managed fields in the create-ticket response', () => {
    const response = ticketResponse({
      ticketNumber: 'TKT-20260829-0001',
      status: 'NEW',
      createdAt: new Date('2026-08-29T10:00:00.000Z')
    });

    expect(response).toEqual({
      ticketNumber: 'TKT-20260829-0001',
      status: 'New',
      createdAt: new Date('2026-08-29T10:00:00.000Z')
    });
  });
});
