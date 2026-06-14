<template>
  <LoginView
    v-if="!loggedIn"
    v-model:username="loginName"
    v-model:password="loginPassword"
    :error="loginError"
    :palette="t.palette"
    :density="t.density"
    @login="login"
  />

  <div v-else class="app" :data-palette="t.palette" :data-density="t.density">
    <SidebarNav
      :nav="visibleNav"
      :view="view"
      :is-open="sidebarOpen"
      @change-view="view = $event"
      @close="sidebarOpen = false"
    />
    <div v-if="sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen = false" />

    <main class="main">
      <AppTopbar
        :title="viewTitle(view, dashWhich)"
        :current-user="currentUser"
        :user-initial="userInitial"
        :role="role"
        @logout="logout"
        @menu="sidebarOpen = true"
      />

      <WeekBar
        v-if="week"
        :week="week"
        :fmt-date="fmtDate"
        :show-bell="role === 'admin'"
        @prev="weekIdx = Math.max(0, weekIdx - 1)"
        @next="weekIdx = Math.min(weeks.length - 1, weekIdx + 1)"
      />

      <div class="scroll">
        <div v-if="weeksStore.loading" style="padding: 32px; text-align: center; color: var(--ink-3); font-size: 13px">Loading weeks…</div>
        <template v-else-if="week">
          <DataEntryView
            v-if="view === 'data-entry'"
            :week="week"
            :can-delete-week="weeks.length > 1"
            @create-week="createWeekFromHeader"
            @delete-week="deleteWeekFromHeader"
          />
          <DailyProgressView v-if="view === 'daily-progress'" :week="week" />
          <FuelDataView v-if="view === 'fuel-data'" :week="week" />
          <DownTimeView v-if="view === 'down-time'" :week="week" />
          <DownTimeReportView v-if="view === 'dt-report'" />
          <ReasonCodeView v-if="view === 'reason-codes'" />
          <PlanReviewView v-if="view === 'plan-review'" :week="week" />
          <DashboardsView v-if="view === 'dashboards'" v-model:which="dashWhich" :week="week" />
        </template>
        <div v-else-if="role === 'admin'" class="empty-state">
          <h2>No weekly plan yet</h2>
          <p>Create the first week before adding blast patterns and drill logs.</p>
          <button type="button" class="btn" data-variant="primary" @click="createFirstWeek">
            Create first week
          </button>
        </div>
        <UserAccessView
          v-if="view === 'user-access'"
          :current-username="signedUsername"
          :current-user-id="signedUserId"
          :session-role="signedRole"
          @self-role-changed="onSelfRoleChanged"
        />
        <RigView v-if="view === 'rigs'" />
        <OperatorView v-if="view === 'operators'" />
      </div>
    </main>

    <TweaksPanel title="Tweaks">
      <TweakSection label="Visual">
        <TweakRadio
          label="Palette"
          :value="t.palette"
          :options="[
            { value: 'warm', label: 'Warm' },
            { value: 'graphite', label: 'Graphite' },
            { value: 'ink', label: 'Ink' },
            { value: 'slate', label: 'Slate' },
          ]"
          @update:value="setTweak('palette', $event)"
        />
        <TweakRadio
          label="Density"
          :value="t.density"
          :options="[
            { value: 'compact', label: 'Compact' },
            { value: 'default', label: 'Default' },
            { value: 'comfy', label: 'Comfy' },
          ]"
          @update:value="setTweak('density', $event)"
        />
      </TweakSection>
    </TweaksPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { addDays, fmtDate } from './components/format.js';
import { authenticateDemo } from './components/demo.js';
import { getDemoOverrideRole, getSupabase, isSupabaseConfigured } from './lib/supabaseClient.js';
import { usePatternsStore } from './stores/Patterns.stores.ts';
import { useWeeksStore } from './stores/Weeks.stores.ts';
import { useTweaks } from './components/tweaks/useTweaks.js';
import AppTopbar from './layout/AppTopbar.vue';
import LoginView from './layout/LoginView.vue';
import SidebarNav from './layout/SidebarNav.vue';
import WeekBar from './layout/WeekBar.vue';
import TweaksPanel from './components/tweaks/TweaksPanel.vue';
import TweakSection from './components/tweaks/TweakSection.vue';
import TweakRadio from './components/tweaks/TweakRadio.vue';
import DataEntryView from './pages/DataEntryPage.vue';
import PlanReviewView from './pages/PlanReviewPage.vue';
import DashboardsView from './pages/DashboardPage.vue';
import UserAccessView from './pages/UserAccessPage.vue';
import DailyProgressView from './components/StepDailyProgress.vue';
import FuelDataView from './pages/FuelDataPage.vue';
import DownTimeView from './pages/DownTimePage.vue';
import DownTimeReportView from './pages/DownTimeReportPage.vue';
import ReasonCodeView from './pages/ReasonCodePage.vue';
import RigView from './pages/RigPage.vue';
import OperatorView from './pages/OperatorPage.vue';

const weeksStore = useWeeksStore();
const patternsStore = usePatternsStore();
const router = useRouter();
const route = useRoute();

interface WeekObj { week_id: number; week_start: Date | string; week_end: Date | string; status: string; plan_source: string; header_locked?: boolean; }

const NAV = [
  { id: 'data-entry', label: 'Data Entry', roles: ['admin'], tag: 'admin' },
  { id: 'fuel-data', label: 'Fuel Data', roles: ['admin'], tag: '' },
  { id: 'down-time', label: 'Down Time', roles: ['admin'], tag: '' },
  { id: 'dashboards', label: 'Dashboards', roles: ['admin', 'manager'], tag: '' },
  { id: 'daily-progress', label: 'Daily Progress', roles: ['admin', 'manager'], tag: '' },
  { id: 'plan-review', label: 'Plan Review', roles: ['admin', 'manager'], tag: '' },
  { id: 'user-access', label: 'User Access', roles: ['manager'], tag: '' },
  { id: 'rigs', label: 'Rigs', roles: ['admin'], tag: '' },
  { id: 'operators', label: 'Operators', roles: ['admin'], tag: '' },
  { id: 'reason-codes', label: 'Reason Codes', roles: ['admin'], tag: '' },
];

const DEFAULTS = {
  palette: 'warm',
  density: 'default',
  role: 'admin',
};

const view = ref('user-access');
const sidebarOpen = ref(false);
const weekIdx = ref(0);
const dashWhich = ref('mgmt');
const loggedIn = ref(!isSupabaseConfigured());
const loginName = ref('');
const loginPassword = ref('');
const loginError = ref('');
const demoOverrideRole = getDemoOverrideRole();
const signedRole = ref(demoOverrideRole || 'manager');
const signedName = ref(demoOverrideRole === 'admin' ? 'Admin User' : 'Site Manager');
const signedUsername = ref(demoOverrideRole === 'admin' ? 'admin' : 'manager');
const signedUserId = ref('');
const [t, setTweak] = useTweaks(DEFAULTS);

const weeks = computed(() => weeksStore.weeks);
const week = computed(() => weeks.value[weekIdx.value] ?? null);
const role = computed(() => signedRole.value);
const currentUser = computed(() => signedName.value || (role.value === 'admin' ? 'Admin' : 'Manager'));
const userInitial = computed(() => currentUser.value.trim().charAt(0).toUpperCase() || 'U');
const visibleNav = computed(() => NAV.filter((n) => n.roles.includes(role.value)));

watch(
  role,
  () => {
    const firstVisible = visibleNav.value[0];
    if (!firstVisible) return;
    if (!visibleNav.value.find((n) => n.id === view.value)) view.value = firstVisible.id;
  },
  { immediate: true },
);

watch(view, (newView: string) => {
  if (route.path !== '/' + newView) router.push('/' + newView);
});

watch(() => route.path, (newPath: string) => {
  const newView = newPath.slice(1);
  if (newView && newView !== view.value && NAV.find((n) => n.id === newView)) view.value = newView;
});

const SESSION_KEY = 'tdl-demo-session';

onMounted(async () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      applyProfile(JSON.parse(raw));
      await weeksStore.loadAll();
      return;
    }
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
});

async function login() {
  loginError.value = '';
  const sb = getSupabase();

  if (isSupabaseConfigured() && sb) {
    const username = loginName.value.trim().toLowerCase();
    if (!username) {
      loginError.value = 'Please enter user name.';
      return;
    }
    if (!loginPassword.value) {
      loginError.value = 'Please enter password.';
      return;
    }
    const domain = import.meta.env.VITE_AUTH_EMAIL_DOMAIN?.trim() || 'tdl-drill.local';
    const email = `${username}@${domain}`;
    const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
      email,
      password: loginPassword.value,
    });
    if (authErr || !authData?.user) {
      loginError.value = 'Username or password is incorrect.';
      return;
    }
    const { data: prof } = await sb
      .from('tdl_profiles')
      .select('id, username, display_name, role')
      .eq('id', authData.user.id)
      .maybeSingle();
    loginPassword.value = '';
    const appUser = {
      username: prof?.username || username,
      display_name: prof?.display_name || authData.user.user_metadata?.display_name || '',
      role: prof?.role || authData.user.user_metadata?.role || 'viewer',
      userId: authData.user.id,
    };
    applyProfile(appUser);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(appUser));
    await weeksStore.loadAll();
    return;
  }

  const user = authenticateDemo(loginName.value, loginPassword.value);
  if (!user) {
    loginError.value = 'Invalid user name or password.';
    return;
  }
  loginPassword.value = '';
  applyProfile({ ...user, userId: '' });
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  await weeksStore.loadAll();
}

async function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  const sb = getSupabase();
  if (sb) await sb.auth.signOut().catch(() => {});
  loggedIn.value = false;
  loginPassword.value = '';
  loginError.value = '';
  signedUserId.value = '';
}

function applyProfile(user: { username: string; display_name: string; role: string; userId?: string }) {
  signedRole.value = user.role;
  signedName.value = user.display_name;
  signedUsername.value = user.username;
  signedUserId.value = user.userId ?? '';
  view.value = user.role === 'admin' ? 'data-entry' : 'dashboards';
  loggedIn.value = true;
}

function onSelfRoleChanged(newRole: string) {
  signedRole.value = newRole;
  if (!visibleNav.value.find((n) => n.id === view.value)) {
    view.value = visibleNav.value[0]?.id ?? 'dashboards';
  }
}

async function createWeekFromHeader(event: { week?: WeekObj } | null) {
  const sourceWeek = event?.week || weeks.value[weekIdx.value];
  if (!sourceWeek) return;

  const week_start = toIso(addDays(new Date(sourceWeek.week_end), 1));
  const week_end   = toIso(addDays(new Date(week_start), 6));
  const { data: created } = await weeksStore.create({
    week_start,
    week_end,
    status:        'draft' as const,
    plan_source:   String(sourceWeek.plan_source || 'LXML'),
    header_locked: false,
  });

  if (created) {
    await carryPatternsToWeek(sourceWeek.week_id, created.week_id, week_end);
    weekIdx.value = weeks.value.length - 1;
  }
}

async function carryPatternsToWeek(fromWeekId: number, toWeekId: number, blastDate: string) {
  const open = patternsStore.patterns
    .filter((p) => p.week_id === fromWeekId)
    .filter((p) => !patternDone(p))
    .filter((p) => Math.max(0, Number(p.effective_m || 0) - Number(p.actual_drilling_m || 0)) > 0);

  if (!open.length) return;

  const carries = open.map((src) => {
    const remaining = Math.max(0, Number(src.effective_m || 0) - Number(src.actual_drilling_m || 0));
    const prevPct   = Number(src.drilling_pct || 0);
    const { carried_progress_pct: _cp, id: _id, created_at: _ca, updated_at: _ua, ...rest } = src as any;
    void _cp; void _id; void _ca; void _ua;
    return {
      ...rest,
      week_id:             toWeekId,
      pit_priority:        0,
      carried_drilling_m:  Number(src.plan_total_drilling_m || 0) - remaining,
      effective_m:         remaining,
      actual_drilling_m:   0,
      drilling_pct:        prevPct,
      planned_blast_date:  blastDate,
      actual_blast_vol_bcm: 0,
      blast_td_updated:    false,
      status:              'pending' as const,
      risk:                'on-track' as const,
    };
  });
  await patternsStore.upsertMany(carries);
}

interface AppPattern { week_id: number; pattern_id: string; status: string; actual_blast_vol_bcm: number; [key: string]: unknown; }

function patternDone(pattern: AppPattern) {
  const status = String(pattern.status || '').toLowerCase();
  return status === 'done' || status === 'complete' || status === 'blasting' || Number(pattern.actual_blast_vol_bcm || 0) > 1;
}

async function deleteWeekFromHeader(event: { week?: WeekObj } | null) {
  if (weeks.value.length <= 1) return;
  const target = event?.week || weeks.value[weekIdx.value];
  const targetIndex = weeks.value.findIndex((w) => w.week_id === target.week_id);
  if (targetIndex === -1) return;
  await weeksStore.destroy(target.week_id);
  weekIdx.value = Math.max(0, Math.min(targetIndex - 1, weeks.value.length - 1));
}

async function createFirstWeek() {
  const { week_start, week_end } = currentWeekBounds();
  const { data: created } = await weeksStore.create({
    week_start,
    week_end,
    status:        'draft' as const,
    plan_source:   'LXML',
    header_locked: false,
  });

  if (created) {
    weekIdx.value = weeks.value.findIndex((w) => w.week_id === created.week_id);
    view.value = 'data-entry';
  }
}

function currentWeekBounds() {
  const today = new Date();
  const day = today.getDay();
  const daysSinceSaturday = (day + 1) % 7;
  const start = addDays(today, -daysSinceSaturday);
  const end = addDays(start, 6);
  return {
    week_start: toIso(start),
    week_end: toIso(end),
  };
}

function toIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function viewTitle(v: string, dw: string) {
  if (v === 'data-entry') return 'Data Entry';
  if (v === 'plan-review') return 'Plan Review';
  if (v === 'dashboards') return dw === 'ops' ? 'Operations Dashboard' : 'Management Dashboard';
  if (v === 'user-access') return 'User Access';
  return 'Dashboards';
}
</script>

<style scoped>
.empty-state {
  max-width: 520px;
  margin: 56px auto;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  text-align: center;
}

.empty-state h2 {
  margin: 0;
  font-size: 18px;
}

.empty-state p {
  margin: 8px 0 18px;
  color: var(--ink-3);
  font-size: 13px;
}
</style>
