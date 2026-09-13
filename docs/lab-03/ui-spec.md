# Lab 3 UI Specification: Zen Green Role-Based Experience

## 1. Design Continuity

Lab 3 reuses the Lab 2 Zen Green tokens, Bootstrap conventions, maximum 8 px card radius, visible labels, adjacent validation, restrained shadows, and responsive spacing. New screens must look like one application rather than a separate administration theme.

Status, Requested Priority, IT Priority, role, active/inactive state, and removed attachments use text badges with consistent color and readable labels. Color is never the only carrier of meaning.

## 2. Authenticated Application Shell

- Public shell: TokTickIT identity with Login or mandatory Change Password content only.
- Authenticated shell: user name, role badge, role-permitted navigation, Change Password, and Logout.
- Requester navigation: My Tickets and Create Ticket.
- IT Staff navigation: Ticket Queue.
- Administrator navigation: Ticket Queue and User Management, as explicitly permitted by the authorization matrix.
- Unauthorized destinations are absent from navigation, while direct access still receives a forbidden screen from backend authorization.
- Mobile navigation is compact, keyboard reachable, and does not hide current identity or Logout.

## 3. Login Screen

- Literal page heading `Sign in to TokTickIT`.
- Labelled email and password fields with autocomplete attributes.
- Password visibility control uses a familiar icon and accessible name.
- Primary Sign In button has stable dimensions and shows a busy label/state without layout shift.
- Client validation covers required fields and email shape; server failures use an account-neutral message.
- Inactive, unknown, locked, and wrong-password outcomes do not reveal account existence.
- API-unavailable feedback is distinct from invalid credentials and supports Retry by resubmission.

## 4. Mandatory Change Password

- Displays current user identity and explains that the initial password must be replaced.
- Includes Current Password, New Password, and Confirm New Password fields.
- Shows password rules before submission and adjacent validation after interaction.
- Normal application navigation is unavailable; Logout remains available.
- Success continues into the authenticated application with a replacement session.
- Validation or API failure preserves safe editable values except passwords may be cleared after submission.

## 5. Requester Regression Screens

- Remove Development Requester selection, Change Requester, and all testing-context wording.
- Create Ticket, My Tickets, Ticket Detail, and Attachments preserve Lab 2 layout and behaviour.
- The shell and Ticket Detail use the authenticated Requester's name.
- Ticket Detail adds a Public Comments timeline and composer.
- A `Problem Appears Resolved` action requires confirmation and displays recorded time after success; it does not present a Resolved status control.
- Requesters never see Internal Notes, assignment, IT Priority editing, or status transition controls.

## 6. IT Staff Ticket Queue

### Desktop

- A dense, scannable table shows Ticket Number, Summary, Requester, Category, Requested Priority, IT Priority, Status, Owner, Last Updated, and an Open action.
- Search and filters are arranged in an unframed toolbar above the results.
- Filters include Category, Related System, status, both priorities, and owner (`All`, `Unassigned`, `Mine`, or one permitted owner).
- Sort field and direction are separate labelled controls. Pagination includes page size, previous/next, and result count.

### Tablet and mobile

- Ticket rows become unframed stacked items with Ticket Number/Summary first and labelled metadata below.
- Filters use a collapsible control region without nesting cards.
- Primary Open action remains visible; no page-level horizontal scrolling is allowed.

### States

- Skeleton or status text for loading without changing toolbar dimensions.
- Distinct no-ticket and no-results messages.
- Forbidden state does not render queue data.
- Safe failure includes Retry using the same current query and stale-response protection.

## 7. IT Staff Ticket Detail

- Header shows Ticket Number, status, Requested Priority, IT Priority, owner, and last update.
- Read-only Requester and request information are grouped separately from operational controls.
- Assignment control supports Claim, Unassign, or selecting an active permitted owner.
- Requested Priority is read-only; IT Priority is editable to authorized roles.
- Status menu shows only transitions currently permitted by the matrix.
- Resolve, Close, Cancel, and Reopen actions require confirmation where specified.
- Saving one operational field does not silently submit another field.
- Conflict feedback explains that the ticket changed and offers Reload rather than overwriting newer data.
- Attachments remain available through the protected Lab 2 lifecycle.

## 8. Public Comments and Internal Notes

- Public Comments use a shared communication heading and neutral-green treatment visible to all permitted participants.
- Internal Notes use an amber/private treatment and explicit `Internal - not visible to Requester` label.
- Each entry shows author name, role, backend timestamp, and preserved line breaks.
- Composer controls display character count, validation, posting state, success/failure, and prevent duplicate posts.
- The two composers are separated spatially and semantically to reduce accidental private disclosure.

## 9. Administrator User Management

- One screen contains page title, Create User action, name/email search, optional role filter, and user list.
- Desktop columns: Name, Email, Role, Status, Password Change Required, and Edit action.
- Mobile uses stacked user items with the Edit icon/action in a stable location.
- Create/Edit uses a modal or focused panel, not a nested card.
- Create fields: name, email, role, activation, initial password, and confirmation.
- Edit fields: name, email, role, and activation. Initial-password reset is a separate confirmed action.
- Self-deactivation and last-Administrator conflicts show specific safe guidance without applying partial changes.
- No Delete, bulk operation, import/export, department, or multi-role controls are shown.

## 10. Feedback and Accessibility

- Every control has a visible label or accessible name; focus indicators are visible.
- Validation appears adjacent to fields and a summary focuses the first invalid control when useful.
- Busy controls are disabled and retain stable width. Success/error messages use `role="status"` or `role="alert"` appropriately.
- Authentication expiry returns to Login with a concise message and no protected content left on screen.
- Forbidden and not-found states provide a permitted navigation path without leaking protected data.
- Dialog focus is trapped, Escape behaviour is defined, and destructive/terminal confirmations name the affected record/action.

## 11. Responsive Inspection Matrix

Final inspection is performed on `main` at desktop 1440 x 900, tablet 768 x 1024, and mobile 390 x 844 for:

- Login and mandatory Change Password.
- Authenticated shell for each role.
- Requester Create Ticket, My Tickets, Ticket Detail, comments, and resolution indication.
- IT Staff Ticket Queue and Ticket Detail, including comments and notes.
- Administrator User Management create/edit/conflict states.

Screenshots are stored under `artifacts/lab-03/screenshots/authentication/`, `requester/`, `staff-queue/`, `staff-ticket-detail/`, and `user-management/`.

## 12. Visual Checklist

- [x] Zen Green tokens and component hierarchy match Lab 2.
- [x] Role navigation, user identity, and Logout remain visible and readable.
- [x] Status, role, Requested Priority, and IT Priority badges are distinguishable by text and color.
- [x] Editable and read-only fields are visibly different.
- [x] Public Comments and Internal Notes cannot be visually confused.
- [x] Validation, focus, busy, success, empty, no-results, forbidden, conflict, and failure states are readable.
- [x] Buttons, labels, menus, tables/items, and dialogs contain no clipped or overlapping text.
- [x] Desktop, tablet, and mobile have no unexpected page-level horizontal overflow.

The checklist was completed on the Issue #34 integrated branch using Playwright screenshots at 1440x1000, 820x1180, and 390x844. Axe reported no WCAG 2 A/AA violations on the captured major-screen states. Repeat the suite on final `main` before submission.
