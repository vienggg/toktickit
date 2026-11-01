import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { ActionsTaken } from '../../src/components/ActionsTaken';

// UI-06..UI-10 (docs/lab-04/tests.md): Actions Taken list, create form, view/edit,
// validation, data kept after failures, double-click safety, Requester read-only view.

const staffMembers = [
  { id: 10, name: 'Sam Rivera' },
  { id: 11, name: 'Alex Chen' },
];

interface MockAction {
  id: number;
  ticketId: number;
  actionAt: string;
  description: string;
  result: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  createdBy: { id: number; name: string };
  assignee: { id: number; name: string };
  updatedBy: { id: number; name: string } | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

function makeAction(overrides: Partial<MockAction> = {}): MockAction {
  return {
    id: 1,
    ticketId: 1,
    actionAt: '2026-11-02T03:15:00.000Z',
    description: 'Replaced the faulty network cable at desk 4.',
    result: null,
    status: 'PLANNED',
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    createdBy: { id: 10, name: 'Sam Rivera' },
    assignee: { id: 10, name: 'Sam Rivera' },
    updatedBy: null,
    version: 1,
    createdAt: '2026-11-02T03:20:00.000Z',
    updatedAt: '2026-11-02T03:20:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

let items: MockAction[];
let calls: Array<{ url: string; method: string; body?: Record<string, unknown> }>;
let nextPost: (() => Promise<Response>) | null;
let nextPatch: (() => Promise<Response>) | null;
const onChanged = vi.fn();

function json(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}

function mockFetchImpl(url: RequestInfo | URL, init?: RequestInit) {
  const urlStr = String(url);
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ url: urlStr, method, body });

  if (urlStr.match(/\/api\/tickets\/\d+\/actions$/) && method === 'GET') {
    return json(200, { items, total: items.length });
  }
  if (urlStr.match(/\/api\/staff\/tickets\/\d+\/actions$/) && method === 'POST') {
    if (nextPost) {
      const fn = nextPost;
      nextPost = null;
      return fn();
    }
    const created = makeAction({
      id: items.length + 1,
      description: body.description,
      result: body.result ?? null,
      status: body.status ?? 'PLANNED',
      followUpRequired: !!body.followUpRequired,
      followUpNote: body.followUpNote ?? null,
      attachmentNotes: body.attachmentNotes ?? null,
      assignee: staffMembers.find((m) => m.id === body.assigneeId) ?? { id: 10, name: 'Sam Rivera' },
    });
    items = [...items, created];
    return json(201, created);
  }
  if (urlStr.match(/\/api\/staff\/tickets\/\d+\/actions\/\d+$/) && method === 'PATCH') {
    if (nextPatch) {
      const fn = nextPatch;
      nextPatch = null;
      return fn();
    }
    const id = Number(urlStr.split('/').pop());
    const current = items.find((a) => a.id === id)!;
    const updated = { ...current, ...body, version: current.version + 1 } as MockAction;
    delete (updated as unknown as Record<string, unknown>).expectedVersion;
    items = items.map((a) => (a.id === id ? updated : a));
    return json(200, updated);
  }
  return json(404, {});
}

function renderPanel(props: Partial<React.ComponentProps<typeof ActionsTaken>> = {}) {
  return render(
    <ActionsTaken
      ticketId={1}
      ticketStatus="IN_PROGRESS"
      mode="staff"
      currentUserId={10}
      currentUserName="Sam Rivera"
      staffMembers={staffMembers}
      onChanged={onChanged}
      {...props}
    />
  );
}

async function openCreateForm() {
  fireEvent.click(await screen.findByRole('button', { name: /add action/i }));
  return await screen.findByRole('form', { name: /new action/i });
}

describe('Actions Taken panel (UI-06..UI-10)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    items = [];
    calls = [];
    nextPost = null;
    nextPatch = null;
    onChanged.mockClear();
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetchImpl as typeof fetch);
  });

  it('UI-06a: lists every field of each action in the table and the mobile cards', async () => {
    items = [
      makeAction({
        id: 1,
        status: 'COMPLETED',
        result: 'Link restored; speed test 940 Mbps.',
        followUpRequired: true,
        followUpNote: 'Check again after the cabling audit.',
        attachmentNotes: 'Photo is in the IT shared folder.',
        assignee: { id: 11, name: 'Alex Chen' },
      }),
      makeAction({ id: 2, description: 'Order a spare cable', status: 'PLANNED' }),
    ];
    renderPanel();
    const table = await screen.findByTestId('actions-table');
    expect(screen.getByRole('heading', { name: /actions taken \(2\)/i })).toBeInTheDocument();
    expect(within(table).getByText('Replaced the faulty network cable at desk 4.')).toBeInTheDocument();
    expect(within(table).getByText('Link restored; speed test 940 Mbps.')).toBeInTheDocument();
    expect(within(table).getByText(/Completed/)).toBeInTheDocument();
    expect(within(table).getByText(/Alex Chen/)).toBeInTheDocument();
    expect(within(table).getAllByText(/Recorded by Sam Rivera/).length).toBeGreaterThan(0);
    expect(within(table).getByText(/Check again after the cabling audit/)).toBeInTheDocument();
    expect(within(table).getByText(/Photo is in the IT shared folder/)).toBeInTheDocument();
    const cards = screen.getByTestId('actions-cards');
    expect(within(cards).getByText('Order a spare cable')).toBeInTheDocument();
    expect(within(cards).getByText(/Planned/)).toBeInTheDocument();
  });

  it('UI-06b: shows the empty state with an Add Action button', async () => {
    renderPanel();
    expect(await screen.findByText(/no actions recorded yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add action/i })).toBeInTheDocument();
  });

  it.each(['RESOLVED', 'CLOSED', 'CANCELLED'])('UI-06c: hides Add Action and explains the lock when the ticket is %s', async (status) => {
    items = [makeAction()];
    renderPanel({ ticketStatus: status });
    await screen.findByTestId('actions-table');
    expect(screen.queryByRole('button', { name: /add action/i })).not.toBeInTheDocument();
    expect(screen.getByText(/actions are locked/i)).toBeInTheDocument();
  });

  it('UI-06d: a failed load shows an alert instead of crashing', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((() => json(500, {})) as typeof fetch);
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });

  it('UI-07a: the follow-up note appears only when follow-up is required, and Result becomes required for Completed', async () => {
    renderPanel();
    await openCreateForm();
    expect(screen.queryByLabelText(/follow-up note/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/follow-up required/i));
    expect(screen.getByLabelText(/follow-up note/i)).toBeRequired();
    expect(screen.getByLabelText(/^result/i)).not.toBeRequired();
    fireEvent.change(screen.getByLabelText(/^status/i), { target: { value: 'COMPLETED' } });
    expect(screen.getByLabelText(/^result/i)).toBeRequired();
  });

  it('UI-07b: shows inline errors next to the fields, focuses the first invalid field and sends nothing', async () => {
    renderPanel();
    await openCreateForm();
    fireEvent.click(screen.getByRole('button', { name: /save action/i }));
    const description = screen.getByLabelText(/^description/i);
    expect(description).toHaveAttribute('aria-invalid', 'true');
    const errorId = description.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId as string)).toHaveTextContent(/description is required/i);
    await waitFor(() => expect(description).toHaveFocus());
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('UI-07c: Completed without a result and follow-up without a note are rejected before sending', async () => {
    renderPanel();
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Fixed it' } });
    fireEvent.change(screen.getByLabelText(/^status/i), { target: { value: 'COMPLETED' } });
    fireEvent.click(screen.getByLabelText(/follow-up required/i));
    fireEvent.click(screen.getByRole('button', { name: /save action/i }));
    expect(document.getElementById(screen.getByLabelText(/^result/i).getAttribute('aria-describedby') as string)).toHaveTextContent(/result is required/i);
    expect(document.getElementById(screen.getByLabelText(/follow-up note/i).getAttribute('aria-describedby') as string)).toHaveTextContent(/follow-up note is required/i);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('UI-07d: a valid form posts the documented body, lists the new action and tells the parent to refresh', async () => {
    renderPanel();
    await openCreateForm();
    expect(screen.getByText(/recorded by/i)).toHaveTextContent('Sam Rivera');
    expect(screen.getByText(/visible to the requester/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Replaced the switch port' } });
    fireEvent.change(screen.getByLabelText(/^assignee/i), { target: { value: '11' } });
    fireEvent.click(screen.getByLabelText(/follow-up required/i));
    fireEvent.change(screen.getByLabelText(/follow-up note/i), { target: { value: 'Re-test on Friday' } });
    fireEvent.change(screen.getByLabelText(/attachment notes/i), { target: { value: 'Photo in shared folder' } });
    fireEvent.click(screen.getByRole('button', { name: /save action/i }));

    await waitFor(() => expect(screen.getByTestId('actions-table')).toHaveTextContent('Replaced the switch port'));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toMatch(/\/api\/staff\/tickets\/1\/actions$/);
    expect(post.body).toMatchObject({
      description: 'Replaced the switch port',
      status: 'PLANNED',
      assigneeId: 11,
      followUpRequired: true,
      followUpNote: 'Re-test on Friday',
      attachmentNotes: 'Photo in shared folder',
    });
    expect(typeof post.body?.clientRequestId).toBe('string');
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole('form', { name: /new action/i })).not.toBeInTheDocument();
  });

  it('UI-08a: a network failure keeps everything the user typed and says so', async () => {
    renderPanel();
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Typed text that must survive' } });
    fireEvent.change(screen.getByLabelText(/attachment notes/i), { target: { value: 'My notes' } });
    nextPost = () => Promise.reject(new TypeError('Failed to fetch'));
    fireEvent.click(screen.getByRole('button', { name: /save action/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/your changes are still here/i);
    expect(screen.getByLabelText(/^description/i)).toHaveValue('Typed text that must survive');
    expect(screen.getByLabelText(/attachment notes/i)).toHaveValue('My notes');
    expect(screen.getByRole('button', { name: /save action/i })).toBeEnabled();
  });

  it('UI-08b: an inactive-assignee rejection (422) is shown under Assignee and the form stays filled', async () => {
    renderPanel();
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Keep me' } });
    fireEvent.change(screen.getByLabelText(/^assignee/i), { target: { value: '11' } });
    nextPost = () => json(422, { error: { code: 'INVALID_ASSIGNEE', message: 'The assignee must be an active IT Staff or Administrator user.' } });
    fireEvent.click(screen.getByRole('button', { name: /save action/i }));
    const assignee = screen.getByLabelText(/^assignee/i);
    await waitFor(() => expect(assignee).toHaveAttribute('aria-invalid', 'true'));
    expect(document.getElementById(assignee.getAttribute('aria-describedby') as string)).toHaveTextContent(/active IT Staff/i);
    expect(screen.getByLabelText(/^description/i)).toHaveValue('Keep me');
  });

  it('UI-08c: a server validation error (400) is mapped to its field', async () => {
    renderPanel();
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Something' } });
    nextPost = () => json(400, { error: { code: 'VALIDATION_ERROR', message: "Invalid 'actionAt': Action date/time cannot be in the future.", field: 'actionAt' } });
    fireEvent.click(screen.getByRole('button', { name: /save action/i }));
    const when = screen.getByLabelText(/action date/i);
    await waitFor(() => expect(when).toHaveAttribute('aria-invalid', 'true'));
    expect(document.getElementById(when.getAttribute('aria-describedby') as string)).toHaveTextContent(/cannot be in the future/i);
  });

  it('UI-09a: a double click sends exactly one POST and disables the button while saving', async () => {
    renderPanel();
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Click twice' } });
    let release: (r: Response) => void = () => undefined;
    nextPost = () => new Promise<Response>((resolve) => { release = resolve; });
    const save = screen.getByRole('button', { name: /save action/i });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled());
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    release({ ok: true, status: 201, json: async () => makeAction({ id: 5, description: 'Click twice' }) } as Response);
    await waitFor(() => expect(screen.queryByRole('form', { name: /new action/i })).not.toBeInTheDocument());
  });

  it('UI-09b: retrying after a failure reuses the same clientRequestId', async () => {
    renderPanel();
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'Retry me' } });
    nextPost = () => Promise.reject(new TypeError('Failed to fetch'));
    fireEvent.click(screen.getByRole('button', { name: /save action/i }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: /save action/i }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
    const ids = calls.filter((c) => c.method === 'POST').map((c) => c.body?.clientRequestId);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).toBe(ids[1]);
  });

  it('UI-06e: opening a row shows it read-only; Edit makes it editable and PATCH sends expectedVersion', async () => {
    items = [makeAction({ id: 7, description: 'Original text', version: 3 })];
    renderPanel();
    const table = await screen.findByTestId('actions-table');
    fireEvent.click(within(table).getByRole('button', { name: /view action 7/i }));
    const details = await screen.findByRole('region', { name: /action details/i });
    expect(within(details).getByText('Original text')).toBeInTheDocument();
    expect(within(details).queryByLabelText(/^description/i)).not.toBeInTheDocument();

    fireEvent.click(within(details).getByRole('button', { name: /^edit$/i }));
    const edit = await screen.findByLabelText(/^description/i);
    fireEvent.change(edit, { target: { value: 'Edited text' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.url).toMatch(/\/api\/staff\/tickets\/1\/actions\/7$/);
    expect(patch.body).toMatchObject({ expectedVersion: 3, description: 'Edited text' });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('UI-06f: a PLANNED action offers Start and Cancel action; terminal actions are locked', async () => {
    items = [makeAction({ id: 1 }), makeAction({ id: 2, status: 'COMPLETED', result: 'Done' })];
    renderPanel();
    const table = await screen.findByTestId('actions-table');
    fireEvent.click(within(table).getByRole('button', { name: /view action 1/i }));
    const details = await screen.findByRole('region', { name: /action details/i });
    fireEvent.click(within(details).getByRole('button', { name: /^start$/i }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ status: 'IN_PROGRESS', expectedVersion: 1 }));

    fireEvent.click(within(table).getByRole('button', { name: /view action 2/i }));
    const locked = await screen.findByRole('region', { name: /action details/i });
    expect(within(locked).getByText(/locked/i)).toBeInTheDocument();
    expect(within(locked).queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it('UI-09c: while Start is in flight every row action is disabled, and Start sends exactly one PATCH', async () => {
    items = [makeAction({ id: 1 })];
    let release: (r: Response) => void = () => undefined;
    nextPatch = () => new Promise<Response>((resolve) => { release = resolve; });
    renderPanel();
    fireEvent.click(within(await screen.findByTestId('actions-table')).getByRole('button', { name: /view action 1/i }));
    const details = await screen.findByRole('region', { name: /action details/i });
    const start = within(details).getByRole('button', { name: /^start$/i });
    fireEvent.click(start);
    fireEvent.click(start);
    await waitFor(() => expect(start).toBeDisabled());
    for (const name of [/^edit$/i, /^complete$/i, /^cancel action$/i]) {
      expect(within(details).getByRole('button', { name })).toBeDisabled();
    }
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
    release(await json(200, makeAction({ id: 1, status: 'IN_PROGRESS', version: 2 })));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('UI-08d: a stale edit (409) shows the conflict banner, keeps the typed text and lets the user retry on the latest version', async () => {
    items = [makeAction({ id: 3, description: 'Mine', version: 1 })];
    renderPanel();
    const table = await screen.findByTestId('actions-table');
    fireEvent.click(within(table).getByRole('button', { name: /view action 3/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^edit$/i }));
    fireEvent.change(await screen.findByLabelText(/^description/i), { target: { value: 'My unsaved edit' } });
    nextPatch = () =>
      json(409, {
        error: {
          code: 'STALE_UPDATE',
          message: 'This action was changed by someone else.',
          current: makeAction({ id: 3, description: 'Edited by Alex', version: 2 }),
        },
      });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(/changed by someone else/i);
    expect(banner).toHaveTextContent('Edited by Alex');
    expect(screen.getByLabelText(/^description/i)).toHaveValue('My unsaved edit');

    fireEvent.click(screen.getByRole('button', { name: /keep my edits/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2));
    expect(calls.filter((c) => c.method === 'PATCH')[1].body).toMatchObject({ expectedVersion: 2, description: 'My unsaved edit' });
  });

  it('UI-10: the Requester variant is read-only (no Add, Edit, Start or Cancel controls) and says whose steps these are', async () => {
    items = [makeAction({ id: 1, followUpRequired: true, followUpNote: 'Look again soon' })];
    renderPanel({ mode: 'requester', staffMembers: undefined, currentUserId: undefined });
    const table = await screen.findByTestId('actions-table');
    expect(within(table).getByText('Replaced the faulty network cable at desk 4.')).toBeInTheDocument();
    expect(within(table).getByText(/Look again soon/)).toBeInTheDocument();
    expect(screen.getByText(/steps IT has taken on your ticket/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add action/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit|start|cancel action|view action/i })).not.toBeInTheDocument();
  });
});
