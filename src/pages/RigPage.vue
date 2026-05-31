<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Drill Rigs</h1>
        <p class="page-sub">Manage drill rig fleet and contractor assignments.</p>
      </div>
      <button type="button" class="btn" data-variant="primary" @click="showAdd = true">
        + Add Rig
      </button>
    </div>

    <p v-if="rigsStore.error" class="load-error">{{ rigsStore.error }}</p>

    <div class="rig-table-wrap">
      <table class="rig-table">
        <thead>
          <tr>
            <th>Rig Name</th>
            <th>Contractor</th>
            <th style="width: 80px" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rigsStore.rigs" :key="r.rig_id">
            <td class="mono">{{ r.rig_id }}</td>
            <td>
              <input
                class="field-input"
                :value="r.contractor"
                placeholder="—"
                @change="rigsStore.update(r.rig_id, { contractor: $event.target.value.trim() })"
              />
            </td>
            <td>
              <button type="button" class="btn-del" title="Delete" @click="handleDelete(r.rig_id)">×</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add rig modal -->
    <div v-if="showAdd" class="modal-backdrop" @click.self="closeAdd">
      <div class="modal-panel">
        <div class="modal-head">
          <h2>Add Rig</h2>
          <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="closeAdd"><component :is="I.x" /></button>
        </div>
        <div class="add-form">
          <div class="form-field">
            <label class="field-label">Rig Name</label>
            <input v-model="draft.rig_id" class="field-input mono" placeholder="e.g. HE-010" @input="draft.rig_id = draft.rig_id.toUpperCase()" />
            <span v-if="taken" class="field-hint is-error">Rig ID already exists</span>
          </div>
          <div class="form-field">
            <label class="field-label">Contractor</label>
            <input v-model="draft.contractor" class="field-input" placeholder="e.g. Thaidrill" />
          </div>
        </div>
        <p v-if="addError" class="field-hint is-error" style="margin-top:8px">{{ addError }}</p>
        <div class="modal-actions">
          <button type="button" class="btn" @click="closeAdd">Cancel</button>
          <button type="button" class="btn" data-variant="primary" :disabled="!canSubmit || saving" @click="addRig">
            {{ saving ? 'Saving…' : 'Add Rig' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRigsStore } from '../stores/Rigs.stores.ts';
import { I } from '../components/format.js';

const rigsStore = useRigsStore();

const showAdd = ref(false);
const saving = ref(false);
const addError = ref('');
const draft = reactive({ rig_id: '', contractor: '' });

const taken = computed(() =>
  !!rigsStore.rigs.find((r) => r.rig_id === draft.rig_id.trim().toUpperCase()),
);
const canSubmit = computed(() => draft.rig_id.trim().length > 0 && !taken.value);

async function addRig() {
  saving.value = true;
  addError.value = '';
  const err = await rigsStore.add(draft.rig_id, draft.contractor);
  saving.value = false;
  if (err) { addError.value = err; return; }
  closeAdd();
}

function closeAdd() {
  showAdd.value = false;
  addError.value = '';
  draft.rig_id = '';
  draft.contractor = '';
}

function handleDelete(rig_id) {
  if (!confirm(`Delete rig "${rig_id}"?`)) return;
  rigsStore.remove(rig_id);
}

onMounted(() => rigsStore.loadAll());
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}
.page-title { margin: 0; font-size: 18px; }
.page-sub   { margin: 4px 0 0; color: var(--ink-3); font-size: 12px; }
.load-error { margin: 0 0 16px; color: var(--red, #e53e3e); font-size: 12px; }

.rig-table-wrap { overflow-x: auto; }

.rig-table {
  width: 100%;
  max-width: 560px;
  border-collapse: collapse;
  font-size: 13px;
}
.rig-table th,
.rig-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
}
.rig-table th {
  color: var(--ink-3);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  background: var(--surface-2);
}
.rig-table tbody tr:last-child td { border-bottom: none; }
.rig-table .mono { font-family: var(--font-mono, ui-monospace, monospace); font-weight: 700; }

.field-input {
  height: 30px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ink);
  padding: 0 8px;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}
.field-input:focus {
  outline: 2px solid var(--accent, #3b82f6);
  outline-offset: -1px;
  background: var(--surface-2);
  border-color: transparent;
}

.btn-del {
  width: 26px; height: 26px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: none;
  color: var(--ink-4);
  font-size: 14px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.btn-del:hover {
  background: color-mix(in srgb, var(--red, #e53e3e) 10%, var(--surface));
  color: var(--red, #e53e3e);
  border-color: var(--red, #e53e3e);
}

.modal-backdrop {
  position: fixed; inset: 0; z-index: 50;
  display: grid; place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.35);
}
.modal-panel {
  width: min(400px, 100%);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow);
  padding: 18px;
}
.modal-head {
  display: flex; align-items: center;
  justify-content: space-between; gap: 12px;
  margin-bottom: 16px;
}
.modal-head h2 { margin: 0; font-size: 16px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

.add-form { display: grid; gap: 14px; }
.form-field { display: grid; gap: 5px; }
.field-label {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.07em;
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
.field-hint { font-size: 11px; color: var(--ink-4); }
.field-hint.is-error { color: var(--red, #e53e3e); }
</style>
