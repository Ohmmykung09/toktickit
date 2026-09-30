import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from './AuthGate';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const actionStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'COMPLETED', 'CANCELLED'] as const;

type Actor = { id: number; name: string; role: string };
export type ActionTaken = {
  id: number;
  actionDateTime: string;
  status: typeof actionStatuses[number];
  description: string;
  result: string;
  assignee: Actor | null;
  createdBy: Actor;
  performedBy: Actor;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  version: number;
  completedAt: string | null;
  cancelledAt: string | null;
};

type Draft = {
  actionDateTime: string;
  description: string;
  result: string;
  assigneeId: string;
  status: typeof actionStatuses[number];
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
};

type Props = { ticketNumber: string; editable: boolean; assignees?: Actor[]; initialActions?: ActionTaken[] };

function label(value: string) {
  return value.toLowerCase().split('_').map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(' ');
}

function inputDate(value: string) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

function initialDraft(): Draft {
  return {
    actionDateTime: inputDate(new Date().toISOString()),
    description: '', result: '', assigneeId: '', status: 'OPEN',
    followUpRequired: false, followUpNote: '', attachmentNotes: ''
  };
}

function actorName(actor: Actor | null) {
  return actor?.name ?? 'Unassigned';
}

async function responseMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return payload?.error?.message ?? fallback;
}

export function ActionsTakenPanel({ ticketNumber, editable, assignees = [], initialActions }: Props) {
  const { authenticatedFetch } = useAuth();
  const [actions, setActions] = useState<ActionTaken[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(initialActions ? 'ready' : 'loading');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/tickets/${encodeURIComponent(ticketNumber)}/actions-taken`);
      if (!response.ok) throw new Error(await responseMessage(response, 'Unable to load Actions Taken.'));
      setActions(await response.json() as ActionTaken[]);
      setState('ready');
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load Actions Taken.');
      setState('error');
    }
  }, [authenticatedFetch, ticketNumber]);

  useEffect(() => {
    if (initialActions) { setActions(initialActions); setState('ready'); return; }
    void load();
  }, [initialActions, load]);

  function updateDraft<K extends keyof Draft>(target: 'create' | 'edit', key: K, value: Draft[K]) {
    if (target === 'create') setDraft((current) => ({ ...current, [key]: value }));
    else setEditDraft((current) => current ? { ...current, [key]: value } : current);
  }

  function validate(current: Draft) {
    if (!current.actionDateTime || !current.description.trim() || !current.result.trim()) {
      return 'Action Date/Time, Description, and Result are required.';
    }
    if (current.followUpRequired && !current.followUpNote.trim()) return 'Follow-up Note is required when Follow-Up Required is selected.';
    if (!current.followUpRequired && current.followUpNote.trim()) return 'Clear Follow-up Note when Follow-Up Required is not selected.';
    return '';
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const validation = validate(draft);
    if (validation) { setMessage(validation); return; }
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/staff/tickets/${encodeURIComponent(ticketNumber)}/actions-taken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': globalThis.crypto.randomUUID() },
        body: JSON.stringify({ ...draft, actionDateTime: new Date(draft.actionDateTime).toISOString(), assigneeId: draft.assigneeId ? Number(draft.assigneeId) : null })
      });
      if (!response.ok) { setMessage(await responseMessage(response, 'Unable to create Action Taken.')); return; }
      setDraft(initialDraft());
      await load();
      setMessage('Action Taken created.');
    } catch { setMessage('Unable to reach TokTickIT. Try again.'); }
    finally { setBusy(false); }
  }

  function startEdit(action: ActionTaken) {
    setEditingId(action.id);
    setEditDraft({
      actionDateTime: inputDate(action.actionDateTime), description: action.description, result: action.result,
      assigneeId: action.assignee?.id ? String(action.assignee.id) : '', status: action.status,
      followUpRequired: action.followUpRequired, followUpNote: action.followUpNote ?? '', attachmentNotes: action.attachmentNotes ?? ''
    });
    setMessage('');
  }

  async function saveEdit(event: FormEvent, action: ActionTaken) {
    event.preventDefault();
    if (!editDraft) return;
    const validation = validate(editDraft);
    if (validation) { setMessage(validation); return; }
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/staff/tickets/${encodeURIComponent(ticketNumber)}/actions-taken/${action.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editDraft, expectedVersion: action.version, actionDateTime: new Date(editDraft.actionDateTime).toISOString(), assigneeId: editDraft.assigneeId ? Number(editDraft.assigneeId) : null })
      });
      if (!response.ok) { setMessage(await responseMessage(response, 'Unable to update Action Taken.')); return; }
      setEditingId(null); setEditDraft(null); await load(); setMessage('Action Taken updated.');
    } catch { setMessage('Unable to reach TokTickIT. Try again.'); }
    finally { setBusy(false); }
  }

  function formFields(current: Draft, target: 'create' | 'edit') {
    return <>
      <label>Action Date/Time<input aria-label={`${target} action date and time`} onChange={(event) => updateDraft(target, 'actionDateTime', event.target.value)} required type="datetime-local" value={current.actionDateTime} /></label>
      <label>Description<textarea aria-label={`${target} action description`} onChange={(event) => updateDraft(target, 'description', event.target.value)} required rows={3} value={current.description} /></label>
      <label>Result<textarea aria-label={`${target} action result`} onChange={(event) => updateDraft(target, 'result', event.target.value)} required rows={3} value={current.result} /></label>
      <label>Performed By<input aria-label={`${target} performed by`} readOnly value={target === 'create' ? 'Signed-in staff user' : (editingId ? actorName(actions.find((item) => item.id === editingId)?.performedBy ?? null) : '')} /></label>
      <label>Assignee<select aria-label={`${target} action assignee`} onChange={(event) => updateDraft(target, 'assigneeId', event.target.value)} value={current.assigneeId}><option value="">Unassigned</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      {target === 'edit' && <label>Status<select aria-label="Edit action status" onChange={(event) => updateDraft(target, 'status', event.target.value as Draft['status'])} value={current.status}>{actionStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>}
      <label className="action-checkbox"><input checked={current.followUpRequired} onChange={(event) => updateDraft(target, 'followUpRequired', event.target.checked)} type="checkbox" /> Follow-Up Required</label>
      <label>Follow-up Note<textarea aria-label={`${target} follow-up note`} onChange={(event) => updateDraft(target, 'followUpNote', event.target.value)} required={current.followUpRequired} rows={2} value={current.followUpNote} /></label>
      <label>Attachment Notes<textarea aria-label={`${target} attachment notes`} onChange={(event) => updateDraft(target, 'attachmentNotes', event.target.value)} rows={2} value={current.attachmentNotes} /></label>
    </>;
  }

  return <section className="actions-taken-panel" aria-label="Actions Taken">
    <header><div><h2>Actions Taken</h2><p>Work performed on this ticket, including follow-up and audit details.</p></div>{state === 'ready' && <span>{actions.length} action{actions.length === 1 ? '' : 's'}</span>}</header>
    {message && <div className="alert alert-info" role="status">{message}</div>}
    {state === 'loading' && <p role="status">Loading Actions Taken...</p>}
    {state === 'error' && <div className="queue-state queue-error" role="alert"><p>{message}</p><button className="btn btn-outline-danger" onClick={() => void load()} type="button">Retry</button></div>}
    {state === 'ready' && actions.length === 0 && <p className="actions-empty">No Actions Taken recorded yet.</p>}
    {state === 'ready' && actions.length > 0 && <div className="actions-list">{actions.map((action) => <article key={action.id}>
      {editingId === action.id && editDraft ? <form className="action-form" noValidate onSubmit={(event) => void saveEdit(event, action)}><h3>Edit Action Taken</h3>{formFields(editDraft, 'edit')}<footer><button className="btn btn-success btn-sm" disabled={busy} type="submit">Save Action</button><button className="btn btn-outline-secondary btn-sm" onClick={() => { setEditingId(null); setEditDraft(null); }} type="button">Cancel</button></footer></form> : <>
        <header><div><strong>{new Date(action.actionDateTime).toLocaleString()}</strong><span className="action-status">{label(action.status)}</span></div>{editable && !['COMPLETED', 'CANCELLED'].includes(action.status) && <button className="btn btn-outline-success btn-sm" onClick={() => startEdit(action)} type="button">Edit</button>}</header>
        <dl><div><dt>Description</dt><dd>{action.description}</dd></div><div><dt>Result</dt><dd>{action.result}</dd></div><div><dt>Performed By</dt><dd>{action.performedBy.name}</dd></div><div><dt>Follow-Up Required</dt><dd>{action.followUpRequired ? 'Yes' : 'No'}</dd></div>{action.followUpRequired && <div><dt>Follow-up Note</dt><dd>{action.followUpNote}</dd></div>}<div><dt>Attachment Notes</dt><dd>{action.attachmentNotes ?? 'None'}</dd></div><div><dt>Assignee</dt><dd>{actorName(action.assignee)}</dd></div></dl>
      </>}
    </article>)}</div>}
    {editable && <form className="action-form action-create-form" noValidate onSubmit={(event) => void create(event)}><h3>Record Action Taken</h3>{formFields(draft, 'create')}<button className="btn btn-success" disabled={busy} type="submit">{busy ? 'Saving...' : 'Add Action Taken'}</button></form>}
  </section>;
}
