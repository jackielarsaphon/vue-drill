<template>
  <div class="week-row">
    <WeekSelector :week="week" :fmt-date="fmtDate" @prev="$emit('prev')" @next="$emit('next')" />

    <div v-if="showBell" class="bell-wrap" v-click-outside="() => { panelOpen = false }">
      <button
        type="button"
        class="bell-btn"
        :data-active="notifStore.count > 0 ? 'true' : undefined"
        :data-pending="notifStore.hasPending ? 'true' : undefined"
        :title="`${notifStore.count} การแจ้งเตือน`"
        @click="togglePanel"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span v-if="notifStore.count > 0" class="bell-badge">{{ notifStore.count }}</span>
      </button>

      <Transition name="bell-panel">
        <div v-if="panelOpen" class="bell-panel">

          <!-- header -->
          <div class="bell-panel-head">
            <span>Pattern ใหม่รอยืนยัน</span>
            <button type="button" class="bell-panel-close" @click="panelOpen = false">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- pending: grouped by pit -->
          <template v-if="notifStore.pendingNewPatterns">
            <div class="bell-pit-list">
              <div v-for="(group, pit) in groupedByPit" :key="pit" class="bell-pit-group">
                <!-- pit header row -->
                <div class="bell-pit-row">
                  <div class="bell-pit-info">
                    <span class="bell-pit-name">{{ pit }}</span>
                    <span class="bell-pit-meta">{{ group.patterns.length }} pattern · {{ group.rows.length }} drill log</span>
                  </div>
                  <div class="bell-pit-btns">
                    <button
                      type="button"
                      class="bell-pit-btn"
                      data-variant="confirm"
                      :disabled="notifStore.confirmingPending"
                      @click="openEditModal(String(pit))"
                    >ยืนยัน</button>
                    <button
                      type="button"
                      class="bell-pit-btn"
                      data-variant="reject"
                      :disabled="notifStore.confirmingPending"
                      @click="notifStore.rejectPendingByPit(String(pit))"
                    >ปฏิเสธ</button>
                  </div>
                </div>
                <!-- pattern chips -->
                <div class="bell-pit-chips">
                  <span v-for="p in group.patterns" :key="p.pattern_id" class="bell-chip">{{ p.pattern_id }}</span>
                </div>
              </div>
            </div>

            <!-- footer: confirm/reject all -->
            <div class="bell-footer">
              <span class="bell-footer-count">
                {{ notifStore.pendingNewPatterns.patterns.length }} Pattern ·
                {{ notifStore.pendingNewPatterns.rows.length }} รายการ drill log
              </span>
              <div class="bell-footer-btns">
                <button
                  type="button"
                  class="bell-footer-btn"
                  data-variant="reject"
                  :disabled="notifStore.confirmingPending"
                  @click="notifStore.rejectPendingPatterns(); panelOpen = false"
                >ปฏิเสธทั้งหมด</button>
                <button
                  type="button"
                  class="bell-footer-btn"
                  data-variant="confirm"
                  :disabled="notifStore.confirmingPending"
                  @click="openEditModal(null)"
                >ยืนยันทั้งหมด</button>
              </div>
            </div>
          </template>

          <!-- empty state -->
          <div v-else class="bell-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--ink-4)">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span>ไม่มีการแจ้งเตือน</span>
          </div>

        </div>
      </Transition>
    </div>
  </div>

  <!-- ── Edit modal before confirm ──────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="editingPatterns.length" class="confirm-overlay">
      <div class="confirm-modal">
        <div class="confirm-modal-head">
          <div>
            <div class="confirm-modal-title">เลือก Pattern ที่ต้องการเพิ่มใน Blast Patterns</div>
            <div class="confirm-modal-sub">
              เลือก {{ selectedCount }} / {{ editingPatterns.length }} Pattern
              {{ editingPit ? ` · บ่อ ${editingPit}` : '' }}
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="closeEditModal">ยกเลิก</button>
            <button
              type="button"
              class="btn"
              data-variant="primary"
              data-size="sm"
              :disabled="notifStore.confirmingPending || selectedCount === 0"
              @click="saveEditedAndConfirm"
            >{{ notifStore.confirmingPending ? 'กำลังบันทึก…' : `เพิ่ม ${selectedCount} Pattern` }}</button>
          </div>
        </div>
        <div class="confirm-table-wrap">
          <table class="tbl confirm-tbl">
            <thead>
              <tr>
                <th class="c" style="width:36px">
                  <input type="checkbox" :checked="allSelected" @change="toggleAll" />
                </th>
                <th>Pattern ID</th>
                <th>บ่อ</th>
                <th>Type</th>
                <th class="r">RL</th>
                <th class="r">Bench m</th>
                <th class="r">Holes</th>
                <th class="r">Bit mm</th>
                <th class="r">Plan m</th>
                <th class="r">Vol bcm</th>
                <th>Blast date</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in editingPatterns"
                :key="p.pattern_id"
                :data-selected="selectedIds.has(p.pattern_id) ? 'true' : undefined"
                @click.self="toggleOne(p.pattern_id)"
              >
                <td class="c" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedIds.has(p.pattern_id)"
                    @change="toggleOne(p.pattern_id)"
                  />
                </td>
                <td class="mono" style="font-size:11px;white-space:nowrap">{{ p.pattern_id }}</td>
                <td><input v-model="p.pit_name" class="tbl-input mono" /></td>
                <td><input v-model="p.pattern_type" class="tbl-input mono" style="width:60px" /></td>
                <td><input :value="fmtN(p.rl_level)" class="tbl-input mono r" type="text" style="width:56px" @change="p.rl_level = parseN($event.target.value)" /></td>
                <td><input :value="fmtN(p.bench_height_m)" class="tbl-input mono r" type="text" style="width:56px" @change="p.bench_height_m = parseN($event.target.value)" /></td>
                <td><input :value="fmtN(p.num_holes)" class="tbl-input mono r" type="text" style="width:60px" @change="p.num_holes = parseN($event.target.value)" /></td>
                <td><input :value="fmtN(p.hole_diameter_mm)" class="tbl-input mono r" type="text" style="width:60px" @change="p.hole_diameter_mm = parseN($event.target.value)" /></td>
                <td><input :value="fmtN(p.plan_total_drilling_m, 1)" class="tbl-input mono r" type="text" style="width:72px" @change="p.plan_total_drilling_m = parseN($event.target.value)" /></td>
                <td><input :value="fmtN(p.plan_blast_vol_bcm)" class="tbl-input mono r" type="text" style="width:72px" @change="p.plan_blast_vol_bcm = parseN($event.target.value)" /></td>
                <td><input v-model="p.blast_date" class="tbl-input mono" type="date" style="width:130px" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import WeekSelector from '../components/WeekSelector.vue';
import { useNotificationsStore } from '../stores/Notifications.stores.ts';

const props = defineProps({
  week: { type: Object, required: true },
  fmtDate: { type: Function, required: true },
  // Bell is an admin-only workflow (confirm new patterns); hide for managers.
  showBell: { type: Boolean, default: true },
});
defineEmits(['prev', 'next']);

const notifStore = useNotificationsStore();
const panelOpen  = ref(false);

function togglePanel() {
  panelOpen.value = !panelOpen.value;
  if (panelOpen.value) {
    // Opening the bell acknowledges the queue: hide the persistent toast.
    notifStore.acknowledgePending();
    notifStore.refreshPending();
  }
}

// Load the shared pending queue so any admin sees what others left pending.
onMounted(() => {
  if (props.showBell) notifStore.refreshPending();
});

// group pending patterns by pit_name
const groupedByPit = computed(() => {
  const pending = notifStore.pendingNewPatterns;
  if (!pending) return {};
  const { patterns, rows } = pending;
  const groups = {};
  for (const p of patterns) {
    const pit = p.pit_name || 'UNKNOWN';
    if (!groups[pit]) groups[pit] = { patterns: [], rows: [] };
    groups[pit].patterns.push(p);
  }
  const patIdToPit = Object.fromEntries(patterns.map(p => [p.pattern_id, p.pit_name || 'UNKNOWN']));
  for (const r of rows) {
    const pit = patIdToPit[r.pattern_id];
    if (pit && groups[pit]) groups[pit].rows.push(r);
  }
  return groups;
});

// click-outside directive
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => { if (!el.contains(e.target)) binding.value(e); };
    document.addEventListener('mousedown', el._clickOutside);
  },
  unmounted(el) { document.removeEventListener('mousedown', el._clickOutside); },
};

// ── number formatting helpers ─────────────────────────────────────────────────
function fmtN(v, dec = 0) {
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return dec > 0
    ? n.toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : n.toLocaleString('en')
}
function parseN(s) { return Number(String(s).replace(/,/g, '')) || 0 }

// ── edit modal before confirm ─────────────────────────────────────────────────
const editingPatterns = ref([]);
const editingPit      = ref(null);
const selectedIds     = ref(new Set());

const allSelected = computed(() =>
  editingPatterns.value.length > 0 && editingPatterns.value.every(p => selectedIds.value.has(p.pattern_id)),
);
const selectedCount = computed(() => editingPatterns.value.filter(p => selectedIds.value.has(p.pattern_id)).length);

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(editingPatterns.value.map(p => p.pattern_id));
  }
}

function toggleOne(id) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

function openEditModal(pit) {
  const pending = notifStore.pendingNewPatterns;
  if (!pending) return;
  editingPit.value = pit;
  const source = pit
    ? pending.patterns.filter(p => p.pit_name === pit)
    : pending.patterns;
  editingPatterns.value = source.map(p => ({ ...p }));
  selectedIds.value = new Set(editingPatterns.value.map(p => p.pattern_id));
  panelOpen.value = false;
}

function closeEditModal() {
  editingPatterns.value = [];
  editingPit.value = null;
  selectedIds.value = new Set();
}

async function saveEditedAndConfirm() {
  if (!notifStore.pendingNewPatterns || selectedCount.value === 0) return;
  const chosen = editingPatterns.value.filter(p => selectedIds.value.has(p.pattern_id));
  const editedMap = Object.fromEntries(chosen.map(p => [p.pattern_id, p]));
  notifStore.pendingNewPatterns.patterns = notifStore.pendingNewPatterns.patterns.map(
    p => editedMap[p.pattern_id] || p,
  );
  const ids = chosen.map(p => p.pattern_id);
  closeEditModal();
  await notifStore.confirmSpecific(ids);
  if (!notifStore.pendingNewPatterns) panelOpen.value = false;
}
</script>

<style scoped>
.week-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 24px;
  border-bottom: 1px solid var(--line);
  background: var(--bg);
  flex-shrink: 0;
}

/* ── bell button ─────────────────────────────────────────────────── */
.bell-wrap { position: relative; flex-shrink: 0; }

.bell-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-3);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.bell-btn:hover { background: var(--surface-2); color: var(--ink); }
.bell-btn[data-active="true"] { color: var(--ink); border-color: var(--ink-4); }
.bell-btn[data-pending="true"] {
  color: var(--amber, #d97706);
  border-color: color-mix(in srgb, var(--amber, #d97706) 40%, transparent);
  background: color-mix(in srgb, var(--amber, #d97706) 8%, var(--surface));
}

.bell-badge {
  position: absolute;
  top: -5px; right: -5px;
  min-width: 17px; height: 17px;
  border-radius: 999px;
  background: var(--red, #e53e3e);
  color: #fff;
  font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  padding: 0 4px;
  border: 1.5px solid var(--bg);
  pointer-events: none;
}
.bell-btn[data-pending="true"] .bell-badge { background: var(--amber, #d97706); }

/* ── panel ───────────────────────────────────────────────────────── */
.bell-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 340px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.14);
  z-index: 9999;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}

.bell-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
  flex-shrink: 0;
}
.bell-panel-close {
  background: none; border: none; cursor: pointer;
  color: var(--ink-3); padding: 2px; display: flex; align-items: center;
}
.bell-panel-close:hover { color: var(--ink); }

/* ── pit list ────────────────────────────────────────────────────── */
.bell-pit-list {
  overflow-y: auto;
  flex: 1;
}

.bell-pit-group {
  border-bottom: 1px solid var(--line);
  padding: 10px 14px;
}
.bell-pit-group:last-child { border-bottom: 0; }

.bell-pit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.bell-pit-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.bell-pit-name {
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono, monospace);
  color: var(--ink);
}

.bell-pit-meta {
  font-size: 10.5px;
  color: var(--ink-3);
}

.bell-pit-btns {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}

.bell-pit-btn {
  padding: 3px 11px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: opacity 0.12s;
  white-space: nowrap;
}
.bell-pit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.bell-pit-btn[data-variant="confirm"] { background: var(--green, #16a34a); color: #fff; }
.bell-pit-btn[data-variant="reject"]  {
  background: var(--surface-2);
  color: var(--ink-2);
  border: 1px solid var(--line);
}

.bell-pit-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.bell-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-family: var(--font-mono, monospace);
  font-weight: 600;
  background: color-mix(in srgb, var(--amber, #d97706) 12%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--amber, #d97706) 30%, transparent);
  color: color-mix(in srgb, var(--amber, #d97706) 85%, black);
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── footer ──────────────────────────────────────────────────────── */
.bell-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--line);
  background: var(--surface-2);
  flex-shrink: 0;
}

.bell-footer-count {
  font-size: 11px;
  color: var(--ink-3);
}

.bell-footer-btns {
  display: flex;
  gap: 6px;
}

.bell-footer-btn {
  padding: 4px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: opacity 0.12s;
  white-space: nowrap;
}
.bell-footer-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.bell-footer-btn[data-variant="confirm"] { background: var(--green, #16a34a); color: #fff; }
.bell-footer-btn[data-variant="reject"]  {
  background: transparent;
  color: var(--ink-3);
  border: 1px solid var(--line);
}

/* ── empty ───────────────────────────────────────────────────────── */
.bell-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 16px;
  color: var(--ink-4);
  font-size: 12px;
}

/* ── transition ──────────────────────────────────────────────────── */
.bell-panel-enter-active { animation: bell-drop 0.2s ease; }
.bell-panel-leave-active { animation: bell-drop 0.16s ease reverse; }
@keyframes bell-drop {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── confirm/edit modal ──────────────────────────────────────────── */
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  overflow-y: auto;
}

.confirm-modal {
  width: 100%;
  max-width: 1100px;
  background: var(--surface);
  border-radius: var(--radius-lg, 10px);
  box-shadow: 0 8px 40px rgba(0,0,0,.22);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.confirm-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  flex-shrink: 0;
}

.confirm-modal-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}

.confirm-modal-sub {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 2px;
}

.confirm-table-wrap {
  overflow: auto;
  max-height: 60vh;
}

.confirm-tbl th,
.confirm-tbl td {
  white-space: nowrap;
}

.tbl-input {
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 2px 5px;
  font-size: 11px;
  background: var(--surface);
  color: var(--ink);
  width: 100%;
  min-width: 40px;
}
.tbl-input:focus { outline: none; border-color: var(--accent); }
.tbl-input.r { text-align: right; }

.confirm-tbl tbody tr[data-selected="true"] td {
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}
.confirm-tbl tbody tr:not([data-selected]) td {
  opacity: 0.45;
}
</style>
