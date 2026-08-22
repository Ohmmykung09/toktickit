# Lab 2 UI Specification: Zen Green Requester Experience

## 1. Visual System

| Element | Value / Use |
| --- | --- |
| Primary green | `#006B3C` for primary actions, active navigation, and key emphasis. |
| Secondary green | `#0B7A46` for hover or supporting actions. |
| Pale green | `#EAF6EF` for subtle backgrounds and positive states. |
| Page background | `#F5F7F6`. |
| Surface | White with a subtle border and restrained shadow. |
| Text | Dark charcoal-green for readable primary content. |
| Error | Dark red with a visible text message. |
| Warning | Amber. |
| Success | Green with meaningful confirmation text. |

Cards use a maximum 8 px radius. Labels appear above form controls. Required labels include a red asterisk and the validation message appears adjacent to the invalid field.

## 2. Application Shell

The navigation includes TokTickIT identity, My Tickets, Create Ticket, selected requester name, and Change Requester. The current page has a visible active state. On mobile, navigation remains reachable without hiding the selected requester context.

## 3. Development Requester Selection

- Heading identifies the temporary Development Requester selection context.
- Supporting text states this is for Lab 2 testing and not authentication.
- A labelled dropdown loads active requesters from the backend.
- Continue is disabled until a requester is selected.
- Loading, empty list, and request failure states are visible and actionable.

## 4. Create Ticket

- System-generated values, including Ticket Number and initial status, are not editable before submission and are visually distinct from requester input.
- The form includes Category, Related System, Ticket Summary, Requested Priority, Description, and attachments.
- Summary is a single-line input; Description has sufficient multiline space.
- Submit is visually primary, shows a busy state while sending, and prevents duplicate submission.
- Success confirms the generated Ticket Number and provides a clear next action to My Tickets or Ticket Detail.
- On validation or server failure, entered content stays visible and errors explain how to proceed.

## 5. My Tickets and Ticket Detail

- My Tickets provides search, filters, sort control, pagination, and a Create Ticket action.
- Each ticket row shows Ticket Number, Summary, Category, Current Status, and Last Updated.
- Loading, empty collection, no search results, and API failure states have distinct messages.
- Ticket Detail presents ticket information as read-only fields and has an attachment section.

## 6. Attachment Interaction

- File input states permitted types, 5 MB maximum per file, and five active attachments maximum.
- Each uploaded attachment shows its name, type, size, and available action.
- Remove asks for confirmation before soft removal.
- Invalid type, excessive size/count, upload failure, removal failure, and removed-file states display clear messages.

## 7. Responsive and Accessibility Requirements

- Desktop: forms and ticket details may use multiple columns when readable.
- Tablet: controls remain comfortably tappable; tables may use responsive stacking or horizontal scrolling where necessary.
- Mobile: primary actions remain visible, controls fill available width, and ticket information stacks vertically.
- Every interactive control has an accessible name. Keyboard focus is visible. Status messages use text as well as color.
