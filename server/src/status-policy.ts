import { TicketStatus } from '@prisma/client';

export const statusTransitions: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: ['OPEN', 'IN_PROGRESS', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  CANCELLED: []
};

export const ownerRequiredStatuses: readonly TicketStatus[] = [
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_FOR_REQUESTER,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.REOPENED
];

export function canTransition(from: TicketStatus, to: TicketStatus) {
  return statusTransitions[from].includes(to);
}

export function transitionRequiresOwner(status: TicketStatus) {
  return ownerRequiredStatuses.includes(status);
}
