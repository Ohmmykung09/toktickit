import { TicketStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { canTransition, statusTransitions, transitionRequiresOwner } from '../../src/status-policy.js';

describe('Lab 3 ticket status policy', () => {
  it('defines every allowed transition and rejects all other pairs', () => {
    const expected = {
      NEW: ['OPEN', 'IN_PROGRESS', 'CANCELLED'],
      OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
      IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
      WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
      RESOLVED: ['CLOSED', 'REOPENED'],
      CLOSED: ['REOPENED'],
      REOPENED: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
      CANCELLED: []
    } satisfies Record<TicketStatus, TicketStatus[]>;

    expect(statusTransitions).toEqual(expected);
    for (const from of Object.values(TicketStatus)) {
      for (const to of Object.values(TicketStatus)) {
        expect(canTransition(from, to)).toBe(expected[from].includes(to));
      }
    }
  });

  it('requires an owner only for active operational and completion statuses', () => {
    expect(Object.fromEntries(Object.values(TicketStatus).map((status) => [status, transitionRequiresOwner(status)]))).toEqual({
      NEW: false,
      OPEN: false,
      IN_PROGRESS: true,
      WAITING_FOR_REQUESTER: true,
      RESOLVED: true,
      CLOSED: true,
      REOPENED: true,
      CANCELLED: false
    });
  });
});
