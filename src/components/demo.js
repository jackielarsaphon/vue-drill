/** Demo helpers + demo user accounts (single module). */

export function toIsoDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${mm}-${dd}`;
  }
  return value || null;
}

export function cloneRow(row) {
  return { ...row };
}

/** Demo login accounts — stored on each profile for User Access management. */
export const demoProfiles = [
  {
    id: 'u-admin',
    username: 'admin',
    password: 'admin',
    display_name: 'Admin User',
    role: 'admin',
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 'u-manager',
    username: 'manager',
    password: 'manager',
    display_name: 'Site Manager',
    role: 'manager',
    created_at: '2026-02-14T08:00:00Z',
  },
  {
    id: 'u-engineer',
    username: 'engineer',
    password: 'engineer',
    display_name: 'Mining Engineer',
    role: 'manager',
    created_at: '2026-03-01T08:00:00Z',
  },
];

let nextProfileId = 100;

export function authenticateDemo(username, password) {
  const name = username.trim().toLowerCase();
  const profile = demoProfiles.find((p) => p.username === name);
  if (!profile || profile.password !== password) return null;
  return {
    username: name,
    display_name: profile.display_name,
    role: profile.role,
  };
}

export function listDemoProfiles() {
  return demoProfiles.map((p) => ({ ...p }));
}

export function updateDemoRole(id, role) {
  const row = demoProfiles.find((p) => p.id === id);
  if (!row) return { error: new Error('User not found') };
  row.role = role;
  return { error: null };
}

export function updateDemoUsername(id, username) {
  const row = demoProfiles.find((p) => p.id === id);
  if (!row) return { error: new Error('User not found') };
  row.username = username;
  return { error: null };
}

export function updateDemoPassword(id, password) {
  const row = demoProfiles.find((p) => p.id === id);
  if (!row) return { error: new Error('User not found') };
  const next = String(password || '').trim();
  if (!next) return { error: new Error('Password required') };
  row.password = next;
  return { error: null };
}

export function createDemoUser({ username, password, name, role }) {
  const nameKey = username.trim().toLowerCase();
  const pass = String(password || '').trim();
  if (!nameKey || !pass) {
    return { data: null, error: new Error('Username and password required') };
  }
  if (demoProfiles.some((p) => p.username === nameKey)) {
    return { data: null, error: new Error('Username already exists') };
  }
  const row = {
    id: `u-${nextProfileId++}`,
    username: nameKey,
    password: pass,
    display_name: name,
    role,
    created_at: new Date().toISOString(),
  };
  demoProfiles.push(row);
  return { data: { ...row }, error: null };
}
