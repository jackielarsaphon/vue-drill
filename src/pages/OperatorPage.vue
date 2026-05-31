<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Operators</h1>
        <p class="page-sub">Manage drill operator roster.</p>
      </div>
      <button type="button" class="btn" data-variant="primary" @click="showAdd = true">
        + Add Operator
      </button>
    </div>

    <p v-if="store.error" class="load-error">{{ store.error }}</p>

    <div class="table-wrap">
      <table class="op-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th style="width: 80px" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in store.operators" :key="o.operator_id">
            <td class="mono">{{ o.operator_id }}</td>
            <td>
              <input
                class="field-input"
                :value="o.name"
                placeholder="—"
                @change="store.update(o.operator_id, { name: $event.target.value.trim() })"
              />
            </td>
            <td>
              <button type="button" class="btn-del" title="Delete" @click="handleDelete(o.operator_id)">×</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add modal -->
    <div v-if="showAdd" class="modal-backdrop" @click.self="closeAdd">
      <div class="modal-panel">
        <div class="modal-head">
          <h2>Add Operator</h2>
          <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="closeAdd"><component :is="I.x" /></button>
        </div>
        <div class="add-form">
          <div class="form-field">
            <label class="field-label">ID</label>
            <input v-model="draft.operator_id" class="field-input mono" placeholder="e.g. OP-011" @input="draft.operator_id = draft.operator_id.toUpperCase()" />
            <span v-if="taken" class="field-hint is-error">ID already exists</span>
          </div>
          <div class="form-field">
            <label class="field-label">Name</label>
            <input v-model="draft.name" class="field-input" placeholder="e.g. C. Souvannalath" />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" @click="closeAdd">Cancel</button>
          <button type="button" class="btn" data-variant="primary" :disabled="!canSubmit" @click="addOperator">
            Add Operator
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useOperatorsStore } from '../stores/Operators.stores.ts';
import { I } from '../components/format.js';

const store = useOperatorsStore();

const showAdd = ref(false);
const draft = reactive({ operator_id: '', name: '' });

const taken = computed(() =>
  !!store.operators.find((o) => o.operator_id === draft.operator_id.trim().toUpperCase()),
);
const canSubmit = computed(() => draft.operator_id.trim().length > 0 && draft.name.trim().length > 0 && !taken.value);

function addOperator() {
  store.add(draft.operator_id, draft.name);
  closeAdd();
}

function closeAdd() {
  showAdd.value = false;
  draft.operator_id = '';
  draft.name = '';
}

function handleDelete(operator_id) {
  if (!confirm(`Delete operator "${operator_id}"?`)) return;
  store.remove(operator_id);
}

onMounted(() => store.loadAll());
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

.table-wrap { overflow-x: auto; }

.op-table {
  width: 100%;
  max-width: 480px;
  border-collapse: collapse;
  font-size: 13px;
}
.op-table th,
.op-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
}
.op-table th {
  color: var(--ink-3);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  background: var(--surface-2);
}
.op-table tbody tr:last-child td { border-bottom: none; }
.op-table .mono { font-family: var(--font-mono, ui-monospace, monospace); font-weight: 700; }

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
  width: min(380px, 100%);
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
.field-hint { font-size: 11px; color: var(--ink-4); }
.field-hint.is-error { color: var(--red, #e53e3e); }
</style>
