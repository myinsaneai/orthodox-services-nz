// src/admin/UsersPage.tsx
// My page → Users. Admins and superadmins give people their role (see src/lib/roles.ts
// for who may do what; firestore.rules enforces the same on the server).
// Everybody who has ever signed in appears here, as a plain "user" until promoted.

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { listUserProfiles, setUserRole, deleteUserProfile, toMillis } from '../lib/firestore';
import { signInLabel } from '../lib/signIn';
import type { UserProfile } from '../lib/firestore';
import { ROLES, ROLE_LABEL, rank, assignableRoles, canChangeRole, canDeleteUser } from '../lib/roles';
import type { RoleName } from '../lib/roles';

const when = (v: unknown) => {
  const ms = toMillis(v);
  return ms ? new Date(ms).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';
};

const failure = (err: unknown) =>
  (err as { code?: string })?.code === 'permission-denied'
    ? 'Not allowed. Your role may have changed; reload the page and try again.'
    : 'Could not save. Check your connection and try again.';

export default function UsersPage() {
  const { user, role: myRole } = useAuth();
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<RoleName | ''>('');

  const [reload, setReload] = useState(0);        // Refresh bumps it, which fetches again

  useEffect(() => {
    let current = true;
    listUserProfiles().then(
      list => { if (current) { setUsers(list); setLoadError(''); } },
      () => { if (current) { setLoadError('Could not load the users. Check your connection and try again.'); setUsers([]); } },
    );
    return () => { current = false; };
  }, [reload]);

  const shown = useMemo(() => (users ?? [])
    .filter(u => (!filter || u.role === filter)
      && `${u.displayName} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => rank(b.role) - rank(a.role)
      || (a.displayName || a.email).localeCompare(b.displayName || b.email)),
  [users, q, filter]);

  const myUid = user?.uid ?? '';

  return (
    <>
      <div className="hero">
        <h1>Users</h1>
        <div className="hero-sub">Everyone who has signed in. Give people their role.</div>
      </div>
      <div className="page">
        <details className="um-roles">
          <summary>What do the roles mean?</summary>
          <ul>
            <li><b>User</b>: saves favourite parishes and can apply to become a Coordinator.</li>
            <li><b>Coordinator</b>: as User, and changes the schedule of the parishes given to them.</li>
            <li><b>Admin</b>: as Coordinator, and gives the User, Coordinator and Admin roles to Users and Coordinators.</li>
            <li><b>SuperAdmin</b>: as Admin, and also gives the SuperAdmin role, changes Admins and deletes users.</li>
          </ul>
        </details>

        <div className="um-bar">
          <input type="search" placeholder="Search name or email" aria-label="Search users"
                 value={q} onChange={e => setQ(e.target.value)} />
          <select className="um-select" aria-label="Filter by role" value={filter}
                  onChange={e => setFilter(e.target.value as RoleName | '')}>
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <button type="button" className="um-btn" onClick={() => setReload(n => n + 1)}>Refresh</button>
        </div>
        <p className="um-muted" style={{ margin: '0 0 6px' }}>
          {users ? `${shown.length} of ${users.length} users` : 'Loading users…'}
        </p>
        {loadError && <p role="alert" className="um-error">{loadError}</p>}

        <div className="um-head" aria-hidden="true">
          <div>User</div><div>Role</div><div>Signs in with</div><div>Last sign-in</div><div />
        </div>
        {shown.map(u => (
          <Row key={u.uid} u={u} myRole={myRole} myUid={myUid}
               onChanged={(uid, r) => setUsers(l => (l ?? []).map(x =>
                 x.uid === uid ? { ...x, role: r, parishIds: r === 'coordinator' ? x.parishIds : [] } : x))}
               onDeleted={uid => setUsers(l => (l ?? []).filter(x => x.uid !== uid))} />
        ))}
        {users && !shown.length && !loadError && <p className="um-muted" style={{ paddingTop: 12 }}>No users match.</p>}
      </div>
    </>
  );
}

function Row({ u, myRole, myUid, onChanged, onDeleted }: {
  u: UserProfile; myRole: RoleName | null; myUid: string;
  onChanged: (uid: string, role: RoleName) => void; onDeleted: (uid: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<RoleName>(u.role);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const name = u.displayName || u.email;
  const self = u.uid === myUid;
  const options = assignableRoles(myRole, u.role);
  const mayChange = canChangeRole(myRole, myUid, u.role, u.uid);
  const mayDelete = canDeleteUser(myRole, myUid, u.uid);

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      if (role !== u.role) { await setUserRole(u.uid, role, u.parishIds); onChanged(u.uid, role); }
      setEditing(false);
    } catch (err) { setMsg(failure(err)); }
    setBusy(false);
  };
  const cancel = () => { setEditing(false); setRole(u.role); setMsg(''); };
  const remove = async () => {
    setBusy(true); setMsg('');
    try { await deleteUserProfile(u.uid); onDeleted(u.uid); }
    catch (err) { setMsg(failure(err)); setConfirming(false); setBusy(false); }
  };

  return (
    <div className="um-row">
      <div className="um-person">
        {u.photoURL
          ? <img className="um-avatar" src={u.photoURL} alt="" referrerPolicy="no-referrer" />
          : <span className="um-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
        <div style={{ minWidth: 0 }}>
          <span className="um-name">{name}</span>
          {u.displayName && <span className="um-email">{u.email}</span>}
        </div>
      </div>
      <div>
        {editing
          ? <select className="um-select" aria-label={`Role for ${name}`} value={role}
                    onChange={e => setRole(e.target.value as RoleName)}>
              {ROLES.map(r => <option key={r} value={r} disabled={!options.includes(r)}>{ROLE_LABEL[r]}</option>)}
            </select>
          : <span className={`um-tag um-tag--${u.role}`}>{ROLE_LABEL[u.role]}</span>}
      </div>
      <div className="um-muted"><span className="um-lab">Signs in with: </span>{signInLabel(u.providers)}</div>
      <div className="um-muted"><span className="um-lab">Last sign-in: </span>{when(u.lastSignInAt)}</div>
      <div className="um-actions">
        {self ? <span className="um-muted">You</span>
          : editing ? (
            <>
              <button type="button" className="um-btn um-btn--primary" disabled={busy} onClick={save}>Save</button>
              <button type="button" className="um-btn" disabled={busy} onClick={cancel}>Cancel</button>
            </>
          ) : (
            <>
              {mayChange
                ? <button type="button" className="um-btn" aria-label={`Change role for ${name}`}
                          onClick={() => setEditing(true)}>Change role</button>
                : <span className="um-muted">SuperAdmin only</span>}
              {mayDelete && (
                <button type="button" className="um-btn um-btn--danger" aria-label={`Delete ${name}`}
                        onClick={() => setConfirming(true)}>Delete…</button>
              )}
            </>
          )}
      </div>
      {confirming && (
        <div className="um-confirm" role="alertdialog" aria-label={`Delete ${name}`}>
          Delete <b>{name}</b>? This removes their profile and role. They can still sign in, and would
          start again as a User.{' '}
          <button type="button" className="um-btn um-btn--danger" disabled={busy} onClick={remove}>Delete</button>{' '}
          <button type="button" className="um-btn" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      )}
      {msg && <p role="alert" className="um-error">{msg}</p>}
    </div>
  );
}
