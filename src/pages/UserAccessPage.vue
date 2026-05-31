<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">User Access</h1>
        <p class="page-sub">System user accounts and page permissions.</p>
      </div>
      <button
        v-if="canAddUser"
        type="button"
        class="btn"
        data-variant="primary"
        @click="showAdd = true"
      >
        + Add User
      </button>
    </div>

    <!-- ── User list ────────────────────────────────────────────────────── -->
    <div class="user-section">
      <Card :title="accountsTitle" :sub="accountsSub" :pad="false">
        <div v-if="pageError" class="list-empty is-error">{{ pageError }}</div>
        <div v-else-if="storeLoading" class="list-empty">กำลังโหลด…</div>
        <div v-else-if="profileRows.length === 0" class="list-empty">ยังไม่มีบัญชีผู้ใช้</div>
        <div v-else class="profiles-table-wrap">
          <table class="profiles-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Username</th>
                <th>Role</th>
                <th>Password</th>
                <th>Created</th>
                <th>Updated</th>
                <th class="actions-col"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in profileRows" :key="u.id">
                <td>
                  <div class="u-cell">
                    <div class="u-avatar" :data-role="u.role">{{ initial(u.name) }}</div>
                    <span class="u-name">{{ u.name || 'Unnamed user' }}</span>
                  </div>
                </td>
                <td class="mono">@{{ u.username || '-' }}</td>
                <td><span class="u-role-badge" :data-role="u.role">{{ u.role || 'viewer' }}</span></td>
                <td>
                  <div v-if="u.password" class="pw-cell">
                    <span class="mono">{{ shownPw.has(u.id) ? u.password : '••••••' }}</span>
                    <button type="button" class="pw-eye" @click="togglePw(u.id)" :title="shownPw.has(u.id) ? 'ซ่อน' : 'แสดง'">
                      <component :is="shownPw.has(u.id) ? I.eyeOff : I.eye" />
                    </button>
                  </div>
                  <span v-else class="mono">-</span>
                </td>
                <td>{{ formatDateTime(u.created_at) }}</td>
                <td>{{ formatDateTime(u.updated_at) }}</td>
                <td>
                  <div class="u-actions">
                    <button
                      v-if="canEditRow(u)"
                      type="button"
                      class="btn"
                      data-variant="ghost"
                      data-size="sm"
                      @click="openEdit(u)"
                    >Edit</button>
                    <button
                      v-if="canDeleteRow(u)"
                      type="button"
                      class="btn-del"
                      title="Delete"
                      @click="handleDeleteUser(u)"
                    >x</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>

    <!-- ── Edit user modal ───────────────────────────────────────────────── -->
    <div v-if="showEdit" class="modal-backdrop" @click.self="closeEdit">
      <div class="modal-panel">
        <div class="modal-head">
          <div>
            <h2>Edit User</h2>
            <p>{{ editDraft.name }} (@{{ editDraft.username }})</p>
          </div>
          <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="closeEdit"><component :is="I.x" /></button>
        </div>
        <div class="user-form">
          <div class="form-field">
            <label class="field-label">Display Name</label>
            <input v-model="editDraft.name" class="field-input" />
          </div>
          <div class="form-field">
            <label class="field-label">Username</label>
            <input v-model="editDraft.username" class="field-input mono" />
          </div>
          <div class="form-field">
            <label class="field-label">Role</label>
            <select v-model="editDraft.role" class="field-input mono">
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div class="form-field">
            <label class="field-label">Password</label>
            <input v-model="editDraft.password" type="password" class="field-input mono" placeholder="Leave blank to keep current" autocomplete="new-password" />
          </div>
        </div>
        <div v-if="message" class="access-message" :class="{ 'is-error': isError }">{{ message }}</div>
        <div class="modal-actions">
          <button type="button" class="btn" @click="closeEdit">Cancel</button>
          <button type="button" class="btn" data-variant="primary" :disabled="saving" @click="saveEdit">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Add user modal ────────────────────────────────────────────────── -->
    <div v-if="showAdd" class="modal-backdrop" @click.self="closeAdd">
      <div class="modal-panel">
        <div class="modal-head">
          <div>
            <h2>Add User</h2>
            <p>Create a login account for TDL Drill &amp; Blast</p>
          </div>
          <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="closeAdd"><component :is="I.x" /></button>
        </div>

        <div class="user-form">
          <div class="form-field">
            <label class="field-label" for="f-name">Display Name</label>
            <input
              id="f-name"
              v-model="draft.name"
              class="field-input"
              placeholder="e.g. John Smith"
              autocomplete="off"
            />
          </div>

          <div class="form-field">
            <label class="field-label" for="f-username">Username</label>
            <input
              id="f-username"
              v-model="draft.username"
              class="field-input mono"
              placeholder="e.g. jsmith"
              autocomplete="off"
              @input="onDraftUsernameInput"
            />
            <span v-if="usernameTaken" class="field-hint is-error">Username already taken</span>
          </div>

          <div class="form-field">
            <label class="field-label" for="f-pass">Initial Password</label>
            <div class="field-pw-wrap">
              <input
                id="f-pass"
                v-model="draft.password"
                :type="showPw ? 'text' : 'password'"
                class="field-input mono"
                placeholder="At least 6 characters"
                autocomplete="new-password"
              />
              <button type="button" class="pw-toggle" @click="showPw = !showPw">
                <component :is="showPw ? I.eyeOff : I.eye" />
              </button>
            </div>
          </div>

          <div class="form-field">
            <label class="field-label" for="f-role">Role</label>
            <select id="f-role" v-model="draft.role" class="field-input mono">
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>

        <div v-if="message" class="access-message" :class="{ 'is-error': isError }">{{ message }}</div>

        <div class="modal-actions">
          <button type="button" class="btn" @click="closeAdd">Cancel</button>
          <button type="button" class="btn" data-variant="primary" :disabled="saving || !canSubmitAdd" @click="addUser">
            {{ saving ? 'Creating…' : 'Create Account' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed, watch } from 'vue';
import Card from '../components/Card.vue';
import { I } from '../components/format.js';
import { useUserAccessStore } from '../stores/UserAccess.stores';
import {
  listDemoProfiles,
  updateDemoRole,
  updateDemoUsername,
  createDemoUser,
} from '../components/demo.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';

const props = defineProps<{
  currentUsername?: string;
  currentUserId?: string;
  sessionRole?: string;
}>();
const emit = defineEmits<{
  (e: 'self-role-changed', role: string): void;
}>();

interface UserRow {
  id: string;
  username: string;
  name: string;
  password: string;
  role: string;
  job_title: string;
  created_at?: string;
  updated_at?: string;
}

const remote = isSupabaseConfigured();
const store = useUserAccessStore();

// ── State ─────────────────────────────────────────────────────────────────────
const demoUsers = ref<UserRow[]>([]);
const saving   = ref(false);
const message  = ref('');
const isError  = ref(false);

const showAdd  = ref(false);
const showPw   = ref(false);
const shownPw  = ref(new Set<string>());

function togglePw(id: string) {
  const s = new Set(shownPw.value);
  s.has(id) ? s.delete(id) : s.add(id);
  shownPw.value = s;
}
const draft    = reactive({ name: '', username: '', password: '', role: 'manager' });

const showEdit = ref(false);
const editDraft = reactive<{ id: string; name: string; username: string; job_title: string; role: string; password: string }>({
  id: '', name: '', username: '', job_title: '', role: 'manager', password: '',
});

// ── Computed ──────────────────────────────────────────────────────────────────
const sessionRole   = computed(() => props.sessionRole || '');
const pageError     = computed(() => remote ? store.error : '');
const storeLoading  = computed(() => remote ? store.loading : false);
const profileRows   = computed<UserRow[]>(() => {
  if (!remote) return demoUsers.value;
  return store.profiles.map((p) => ({
    id: p.id,
    username: p.username || '',
    name: p.display_name,
    password: p.password ?? '',
    role: p.role,
    job_title: p.job_title ?? '',
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
});
const usernameTaken = computed(() => profileRows.value.some((u) => u.username === draft.username.trim().toLowerCase()));
const canSubmitAdd  = computed(() =>
  draft.name.trim().length > 0 &&
  draft.username.trim().length > 0 &&
  !usernameTaken.value,
);

const canAddUser = computed(() => {
  if (!remote) return true;
  return sessionRole.value === 'admin' || sessionRole.value === 'manager';
});

const accountsTitle = computed(() => 'Login accounts');
const accountsSub   = computed(() => remote ? '' : 'Managers can view and reset passwords for all accounts');

// ── Row helpers ───────────────────────────────────────────────────────────────
function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${hh}:${mm}`;
}

function canEditRow(_u: UserRow): boolean {
  if (!remote) return true;
  return sessionRole.value === 'admin' || sessionRole.value === 'manager';
}

function canDeleteRow(u: UserRow): boolean {
  if (remote) return sessionRole.value === 'admin' && u.id !== props.currentUserId;
  return u.username !== props.currentUsername;
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function openEdit(u: UserRow) {
  Object.assign(editDraft, { id: u.id, name: u.name, username: u.username, job_title: u.job_title, role: u.role, password: '' });
  message.value = '';
  isError.value = false;
  showEdit.value = true;
}

function closeEdit() {
  showEdit.value = false;
  message.value = '';
  isError.value = false;
}

async function saveEdit() {
  const orig = profileRows.value.find((x) => x.id === editDraft.id);
  if (!orig) return;
  saving.value = true;
  message.value = '';
  isError.value = false;

  if (remote) {
    const patch: { display_name: string; username: string; job_title: string; role: string; password?: string } = {
      display_name: editDraft.name.trim(),
      username: editDraft.username.trim().toLowerCase(),
      job_title: editDraft.job_title,
      role: editDraft.role,
    };
    if (editDraft.password.trim()) patch.password = editDraft.password.trim();
    const { error } = await store.update(orig.id, patch);
    saving.value = false;
    if (error) {
      message.value = error.message;
      isError.value = true;
      return;
    }
    if (orig.username === props.currentUsername && editDraft.role !== orig.role) emit('self-role-changed', editDraft.role);
    closeEdit();
    return;
  }

  if (editDraft.name.trim() && editDraft.name !== orig.name) orig.name = editDraft.name.trim();
  if (editDraft.username.trim() && editDraft.username !== orig.username) {
    const { error } = await updateDemoUsername(orig.id, editDraft.username.trim().toLowerCase());
    if (error) {
      saving.value = false;
      message.value = error.message;
      isError.value = true;
      return;
    }
    orig.username = editDraft.username.trim().toLowerCase();
  }
  if (editDraft.job_title !== orig.job_title) orig.job_title = editDraft.job_title.trim();
  if (editDraft.role !== orig.role) {
    const { error } = await updateDemoRole(orig.id, editDraft.role);
    if (error) {
      saving.value = false;
      message.value = error.message;
      isError.value = true;
      return;
    }
    orig.role = editDraft.role;
    if (orig.username === props.currentUsername) emit('self-role-changed', editDraft.role);
  }
  saving.value = false;
  closeEdit();
}

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadUsers() {
  if (remote) {
    await store.getAll();
    return;
  }
  await new Promise((r) => setTimeout(r, 60));
  demoUsers.value = listDemoProfiles().map((p) => ({
    id: p.id,
    username: p.username,
    name: p.display_name,
    password: p.password ?? '',
    role: p.role,
    job_title: '',
  }));
}

// ── Add user ──────────────────────────────────────────────────────────────────
async function addUser() {
  const username = draft.username.trim().toLowerCase();
  if (!draft.name.trim() || !username) {
    message.value = 'Please fill in Display Name and Username.';
    isError.value = true;
    return;
  }
  if (profileRows.value.some((u) => u.username === username)) {
    message.value = 'Username already exists.';
    isError.value = true;
    return;
  }
  saving.value = true;
  message.value = 'Creating user…';
  isError.value = false;

  if (remote) {
    const { error } = await store.create({
      username,
      name: draft.name.trim(),
      role: draft.role,
      password: draft.password.trim() || undefined,
    });
    saving.value = false;
    if (error) {
      message.value = error?.message || 'An error occurred. Please try again.';
      isError.value = true;
      return;
    }
    draft.name = ''; draft.username = ''; draft.password = ''; draft.role = 'manager';
    message.value = '';
    showAdd.value = false;
    return;
  }

  const { data, error } = await createDemoUser({
    username,
    password: draft.password.trim(),
    name: draft.name.trim(),
    role: draft.role,
  });
  saving.value = false;
  if (error || !data) {
    message.value = 'An error occurred. Please try again.';
    isError.value = true;
    return;
  }
  draft.name = ''; draft.username = ''; draft.password = ''; draft.role = 'manager';
  message.value = '';
  showAdd.value = false;
  await loadUsers();
}

// ── Delete user ───────────────────────────────────────────────────────────────
async function handleDeleteUser(u: UserRow) {
  if (!confirm(`Delete account "${u.name}" (${u.username})?`)) return;
  const { error } = remote ? await store.destroy(u.id) : { error: null };
  if (error) { message.value = error.message; isError.value = true; return; }
  if (!remote) demoUsers.value = demoUsers.value.filter((row) => row.id !== u.id);
}

// ── Add modal helpers ─────────────────────────────────────────────────────────
function onDraftUsernameInput(e: Event) {
  draft.username = (e.target as HTMLInputElement).value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

function closeAdd() {
  showAdd.value = false;
  message.value = '';
  isError.value = false;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => { await loadUsers(); });

watch(
  () => props.currentUserId,
  (id) => { if (id && remote) loadUsers(); },
);
</script>

<style scoped>
/* ── Page header ───────────────────────────────────────────────────────────── */
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}
.page-title { margin: 0; font-size: 18px; }
.page-sub   { margin: 4px 0 0; color: var(--ink-3); font-size: 12px; }

/* ── User section ──────────────────────────────────────────────────────────── */
.user-section { margin-top: 0; }

/* ── List ──────────────────────────────────────────────────────────────────── */
.list-empty {
  padding: 28px 16px;
  text-align: center;
  color: var(--ink-3);
  font-size: 13px;
}
.list-empty.is-error { color: var(--danger, #e53e3e); }

.profiles-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.profiles-table {
  width: 100%;
  min-width: 880px;
  border-collapse: collapse;
  font-size: 12px;
}

.profiles-table th,
.profiles-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

.profiles-table th {
  color: var(--ink-3);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  background: var(--surface-2);
}

.profiles-table tbody tr:last-child td { border-bottom: none; }
.profiles-table .actions-col { width: 1%; }
.profiles-table .mono {
  font-family: var(--font-mono, ui-monospace, monospace);
  color: var(--ink-3);
}

.u-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 180px;
}

.user-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
}
.user-row:last-child { border-bottom: none; }

.u-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--accent, #3b82f6);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.u-avatar[data-role="admin"]   { background: var(--red, #e53e3e); }
.u-avatar[data-role="manager"] { background: var(--accent, #3b82f6); }
.u-avatar[data-role="viewer"]  { background: var(--ink-3); }

.u-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.u-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.u-username {
  font-size: 11px;
  color: var(--ink-3);
  font-family: var(--font-mono, ui-monospace, monospace);
}

.u-job {
  font-size: 12px;
  color: var(--ink-3);
  min-width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.u-role-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: 2px 7px;
  border-radius: 20px;
  border: 1px solid var(--line);
  color: var(--ink-3);
  white-space: nowrap;
}
.u-role-badge[data-role="admin"]   { color: var(--red, #e53e3e); border-color: color-mix(in srgb, var(--red, #e53e3e) 40%, var(--line)); background: color-mix(in srgb, var(--red, #e53e3e) 8%, var(--surface)); }
.u-role-badge[data-role="manager"] { color: var(--accent, #3b82f6); border-color: color-mix(in srgb, var(--accent, #3b82f6) 40%, var(--line)); background: color-mix(in srgb, var(--accent, #3b82f6) 8%, var(--surface)); }

.u-active-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--line);
  flex-shrink: 0;
  transition: background 0.2s;
}
.u-active-dot.on { background: var(--green, #22c55e); }

.u-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-3);
}
.u-status.on { color: var(--ink); }

.u-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Buttons ───────────────────────────────────────────────────────────────── */
.th-pw {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.pw-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pw-eye {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 0 2px;
  line-height: 1;
  color: var(--ink-3);
  flex-shrink: 0;
}
.pw-eye:hover { color: var(--ink); }

.btn-del {
  width: 26px; height: 26px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: none;
  color: var(--ink-4);
  font-size: 11px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.btn-del:hover { background: color-mix(in srgb, var(--red, #e53e3e) 10%, var(--surface)); color: var(--red, #e53e3e); border-color: var(--red, #e53e3e); }

/* ── Modal ─────────────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 50;
  display: grid; place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.35);
}
.modal-panel {
  width: min(460px, 100%);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow);
  padding: 18px;
}
.modal-head {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: 12px;
  margin-bottom: 14px;
}
.modal-head h2 { margin: 0; font-size: 16px; letter-spacing: 0; }
.modal-head p  { margin: 4px 0 0; color: var(--ink-3); font-size: 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

/* ── Form fields ───────────────────────────────────────────────────────────── */
.user-form  { display: grid; gap: 14px; }
.form-field { display: grid; gap: 5px; }

.field-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--ink-3);
}

.field-input {
  height: 34px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--ink);
  padding: 0 10px;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}
.field-input:focus { outline: 2px solid var(--accent, #3b82f6); outline-offset: -1px; }

.field-pw-wrap { position: relative; display: flex; }
.field-pw-wrap .field-input { padding-right: 38px; }

.pw-toggle {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px;
  color: var(--ink-3);
}

.field-check {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent, #3b82f6);
}

.field-hint {
  font-size: 11px;
  color: var(--ink-4);
  font-family: var(--font-mono, ui-monospace, monospace);
}
.field-hint.is-error { color: var(--red, #e53e3e); font-family: inherit; }

.access-message { margin-top: 10px; color: var(--ink-3); font-size: 12px; }
.access-message.is-error { color: var(--danger, #e53e3e); }
</style>
