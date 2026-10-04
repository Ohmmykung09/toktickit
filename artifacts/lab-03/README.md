# Lab 3 Screenshot Evidence

The Playwright suite generates these screenshots from real browser workflows against an isolated PostgreSQL schema. No credential values, session cookies, CSRF tokens, or password field contents are exposed in the images. The authoritative evidence viewports are desktop 1440 x 1000, tablet 820 x 1180, and mobile 390 x 844.

| Evidence group | Screens | Viewports |
| --- | --- | --- |
| `authentication/` | Login and mandatory Change Password | 1440 x 1000, 820 x 1180, 390 x 844 |
| `requester/` | My Tickets, Create Ticket, and Ticket Detail | 1440 x 1000, 820 x 1180, 390 x 844 |
| `staff-queue/` | IT Staff Ticket Queue | 1440 x 1000, 820 x 1180, 390 x 844 |
| `staff-ticket-detail/` | IT Staff Ticket Detail with Public Comments and Internal Notes | 1440 x 1000, 820 x 1180, 390 x 844 |
| `user-management/` | User list and Create User | 1440 x 1000, 820 x 1180, 390 x 844 |

Regenerate all evidence from the repository root:

```powershell
npm run test:e2e:lab3
```

The suite checks each captured state with Axe WCAG 2 A/AA rules and verifies that the page does not overflow horizontally.
