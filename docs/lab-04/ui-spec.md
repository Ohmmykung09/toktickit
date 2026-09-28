# Lab 4 UI Specification

## 1. Design Direction

Lab 4 extends the existing Zen Green TokTickIT interface. Screens should feel like one operational application rather than separate feature pages. Existing typography, spacing, button, form, table, badge, loading, empty, error, and responsive conventions remain the source of truth.

The UI must never be the only authorization boundary. It may hide unavailable controls, but every write and every protected read is enforced by the backend.

## 2. Application Shell

- Show TokTickIT brand, authenticated user identity, role, Logout, and active navigation.
- Requesters see Dashboard, New Ticket, and My Tickets.
- IT Staff see Dashboard and Ticket Queue.
- Administrators see Dashboard, Ticket Queue, and User Management.
- The active page is visibly indicated without relying on color alone.
- Direct URLs remain safe when opened by a role without permission.

## 3. Requester Dashboard

### Content

- Four concise metric cards: Open Tickets, Waiting for Requester, Recently Updated Count, and Recently Resolved Count.
- An attention section containing at most 20 Tickets waiting for the Requester, ordered newest update first.
- A recent activity section containing at most five Tickets from the inclusive seven-day UTC window, ordered `updatedAt DESC, id DESC`.
- Open, waiting, and recently resolved cards use the exact filters `status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`, `status=WAITING_FOR_REQUESTER`, and `status=RESOLVED,CLOSED&resolvedSince=7d`; recent rows open Ticket Detail.

### States

- Loading: show a semantic status message while dashboard data is loading.
- Ready with data: show metrics and links.
- Ready with no data: show zero values and a useful empty message.
- Forbidden: show a safe permission message and no protected metrics.
- Failure: show a safe error and a Retry action without losing navigation state.

## 4. IT Staff Dashboard

### Content

- Metric cards for Unassigned Tickets, My Tickets, My Actions Taken (seven-day UTC window), and total operational work.
- Compact status summaries for exactly `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`, plus all four IT Priority values.
- At most five Recent or Urgent Tickets, where urgent means `CRITICAL` or updated in the last two UTC days, ordered `CRITICAL first, updatedAt DESC, id DESC`.
- Drill-down actions use the exact Queue filters for unassigned, current owner, current performer, status, and priority.
- Administrator reuses the same operational dashboard unless the approved contract adds a separate account-count card.

### States

Use the same loading, empty, forbidden, safe-failure, and Retry behavior as the Requester Dashboard. Counts must be rendered from API data and never hard-coded.

## 5. Actions Taken on Staff Ticket Detail

### Read mode

- Show an Actions Taken section below the Ticket summary and before lower-priority history where practical.
- Sort oldest-first by action date/time and ID.
- Display action date/time, lifecycle status, resolution cycle, assignee, creator, performer, result, follow-up state, follow-up note, attachment notes, and completion/cancellation timestamp.
- Use a visible distinction between editable Staff content and Requester read-only content.
- Show a clear empty state when a Ticket has no Actions Taken.

### Create and edit mode

- IT Staff and Administrators see a Create Action button, Assign control, and Edit action for permitted records; assignment choices contain only active IT Staff and Administrators.
- Requesters see the list but never see Create or Edit controls.
- New Actions start `OPEN`; the status control exposes only transitions allowed by the Action lifecycle. Complete and Cancel require explicit confirmation, and terminal Actions have no further mutation controls.
- Date/time uses a labeled control and displays the UTC/server value in a readable local format.
- Follow-Up Required is a labeled checkbox or switch. Follow-up Note appears and becomes required when checked.
- Validation appears beside the relevant field and in a summary when needed.
- Save buttons become busy and prevent repeated submission.
- Recoverable failure preserves entered values and offers Retry.
- A stale response reloads authoritative Ticket data and explains that another update was saved.
- Inactive/requester assignees are rejected with an inline explanation; a required assignee is enforced before `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `COMPLETED`.

## 6. Ticket Workflow Controls

- Staff Ticket Detail shows only transitions allowed from the current status.
- The current status is visible as text and a non-color cue.
- Resolved, Closed, Cancelled, and Reopened changes require explicit confirmation.
- Owner-required transitions explain that an active owner must be assigned first.
- Resolving a Ticket explains the qualifying-action requirement when no current-cycle completed Action with a non-empty result exists; the same rule is enforced by the API.
- A Requester resolution indication is displayed as evidence and is labeled as advisory; it is not a formal status control.
- Conflict responses explain that the Ticket changed and refresh the authoritative detail.

## 7. Responsive Behavior

| Viewport | Required behavior |
| --- | --- |
| Desktop 1440 x 1000 | Dashboard cards align in a readable row; tables and detail columns have stable widths. |
| Tablet 820 x 1180 | Cards wrap into a compact grid; detail controls remain reachable without overlap. |
| Mobile 390 x 844 | Cards stack; tables become cards or controlled horizontal regions; no page-level horizontal overflow. |

Dashboard metrics must remain readable at all viewports. Long Ticket numbers, action descriptions, validation messages, and error text must wrap without changing control dimensions unpredictably.

## 8. Accessibility and Visual Checklist

- Every form control has a semantic label.
- Status, priority, and follow-up state are conveyed by text or an icon in addition to color.
- Focus indicators remain visible for keyboard users.
- Keyboard traversal reaches navigation, cards, drill-down actions, forms, dialogs, and Retry controls in a logical order.
- Dialog confirmation has an accessible name and keyboard cancellation.
- Error messages use `role="alert"` or an equivalent live region where appropriate.
- Loading and mutation states use `role="status"` where appropriate.
- Text does not overlap, clip, or escape its parent.
- No page-level horizontal scrollbar appears at the required viewports.
- Public content and Internal Notes remain visually distinct.
- No placeholder, duplicate, obsolete, or unfinished control remains.
