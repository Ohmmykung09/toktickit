# Lab 3 Screenshot Evidence

The Playwright suite generates these screenshots from real browser workflows against an isolated PostgreSQL schema. No credential values, session cookies, CSRF tokens, or password field contents are exposed in the images.

| Evidence group | Screens | Viewports |
| --- | --- | --- |
| `authentication/` | Login and mandatory Change Password | Desktop, tablet, mobile |
| `requester/` | My Tickets, Create Ticket, and Ticket Detail | Desktop, tablet, mobile |
| `staff-queue/` | IT Staff Ticket Queue | Desktop, tablet, mobile |
| `staff-ticket-detail/` | IT Staff Ticket Detail with Public Comments and Internal Notes | Desktop, tablet, mobile |
| `user-management/` | User list and Create User | Desktop, tablet, mobile |

Regenerate all evidence from the repository root:

```powershell
npm run test:e2e:lab3
```

The suite checks each captured state with Axe WCAG 2 A/AA rules and verifies that the page does not overflow horizontally.
