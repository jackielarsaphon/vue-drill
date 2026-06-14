import { describe, it, expect, beforeEach } from 'vitest';
import {
  toIsoDate,
  cloneRow,
  authenticateDemo,
  listDemoProfiles,
  updateDemoRole,
  updateDemoUsername,
  updateDemoPassword,
  createDemoUser,
  demoProfiles,
} from '../demo.js';

describe('toIsoDate', () => {
  it('converts a Date to ISO string', () => {
    expect(toIsoDate(new Date(2026, 3, 15))).toBe('2026-04-15');
  });

  it('returns null for invalid Date', () => {
    expect(toIsoDate(new Date('invalid'))).toBe(null);
  });

  it('passes through string values', () => {
    expect(toIsoDate('2026-04-15')).toBe('2026-04-15');
  });

  it('returns null for falsy values', () => {
    expect(toIsoDate(null)).toBe(null);
    expect(toIsoDate(undefined)).toBe(null);
    expect(toIsoDate('')).toBe(null);
  });
});

describe('cloneRow', () => {
  it('returns a shallow copy', () => {
    const row = { id: 1, name: 'test' };
    const clone = cloneRow(row);
    expect(clone).toEqual(row);
    expect(clone).not.toBe(row);
  });

  it('does not share references', () => {
    const row = { id: 1, name: 'test' };
    const clone = cloneRow(row);
    clone.name = 'changed';
    expect(row.name).toBe('test');
  });
});

describe('authenticateDemo', () => {
  it('returns user object for valid credentials', () => {
    const result = authenticateDemo('admin', 'admin');
    expect(result).toEqual({
      username: 'admin',
      display_name: 'Admin User',
      role: 'admin',
    });
  });

  it('is case-insensitive for username', () => {
    const result = authenticateDemo('ADMIN', 'admin');
    expect(result).not.toBeNull();
    expect(result.username).toBe('admin');
  });

  it('trims whitespace from username', () => {
    const result = authenticateDemo('  admin  ', 'admin');
    expect(result).not.toBeNull();
  });

  it('returns null for wrong password', () => {
    expect(authenticateDemo('admin', 'wrong')).toBeNull();
  });

  it('returns null for non-existent user', () => {
    expect(authenticateDemo('nobody', 'pass')).toBeNull();
  });

  it('authenticates manager user', () => {
    const result = authenticateDemo('manager', 'manager');
    expect(result.role).toBe('manager');
  });
});

describe('listDemoProfiles', () => {
  it('returns an array of profiles', () => {
    const profiles = listDemoProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(3);
    expect(profiles[0]).toHaveProperty('id');
    expect(profiles[0]).toHaveProperty('username');
    expect(profiles[0]).toHaveProperty('role');
  });

  it('returns clones (not references)', () => {
    const profiles = listDemoProfiles();
    profiles[0].username = 'hacked';
    const fresh = listDemoProfiles();
    expect(fresh[0].username).not.toBe('hacked');
  });
});

describe('updateDemoRole', () => {
  it('updates the role of an existing user', () => {
    const result = updateDemoRole('u-admin', 'manager');
    expect(result.error).toBeNull();
    // Restore
    updateDemoRole('u-admin', 'admin');
  });

  it('returns error for non-existent user', () => {
    const result = updateDemoRole('u-nonexistent', 'admin');
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('User not found');
  });
});

describe('updateDemoUsername', () => {
  it('updates username of existing user', () => {
    const result = updateDemoUsername('u-admin', 'superadmin');
    expect(result.error).toBeNull();
    // Restore
    updateDemoUsername('u-admin', 'admin');
  });

  it('returns error for non-existent user', () => {
    const result = updateDemoUsername('u-fake', 'newname');
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('updateDemoPassword', () => {
  it('updates password of existing user', () => {
    const result = updateDemoPassword('u-admin', 'newpass');
    expect(result.error).toBeNull();
    // Restore
    updateDemoPassword('u-admin', 'admin');
  });

  it('returns error for empty password', () => {
    const result = updateDemoPassword('u-admin', '');
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('Password required');
  });

  it('returns error for non-existent user', () => {
    const result = updateDemoPassword('u-fake', 'pass');
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('createDemoUser', () => {
  it('creates a new user', () => {
    const result = createDemoUser({
      username: 'newuser_test',
      password: 'pass123',
      name: 'New User',
      role: 'manager',
    });
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      username: 'newuser_test',
      display_name: 'New User',
      role: 'manager',
    });
    expect(result.data.id).toBeTruthy();
  });

  it('rejects duplicate username', () => {
    const result = createDemoUser({
      username: 'admin',
      password: 'pass',
      name: 'Dup',
      role: 'admin',
    });
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('Username already exists');
    expect(result.data).toBeNull();
  });

  it('rejects empty username', () => {
    const result = createDemoUser({
      username: '',
      password: 'pass',
      name: 'No Name',
      role: 'admin',
    });
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('Username and password required');
  });

  it('rejects empty password', () => {
    const result = createDemoUser({
      username: 'user_no_pass',
      password: '',
      name: 'No Pass',
      role: 'admin',
    });
    expect(result.error).toBeInstanceOf(Error);
  });
});
