<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Reference Codes</h1>
        <p class="page-sub">จัดการ Air Code และ Reason Code สำหรับ Down Time</p>
      </div>
    </div>

    <div>

      <!-- ── Reason Code table ── -->
      <div class="code-section">
        <div class="section-head">
          <div>
            <div class="section-title">Reason Codes</div>
            <div class="section-sub">{{ rcStore.codes.length }} items</div>
          </div>
          <button type="button" class="btn" data-variant="primary" data-size="sm" @click="openAdd()">
            + Add
          </button>
        </div>
        <p v-if="rcStore.error" class="load-error">{{ rcStore.error }}</p>
        <table class="rc-table">
          <thead>
            <tr>
              <th style="width:100px">Code</th>
              <th>Description</th>
              <th style="width:72px" />
            </tr>
          </thead>
          <tbody>
            <tr v-if="rcStore.loading">
              <td colspan="3" class="empty-cell">Loading…</td>
            </tr>
            <tr v-else-if="!rcStore.codes.length">
              <td colspan="3" class="empty-cell">ไม่มีข้อมูล</td>
            </tr>
            <tr v-else v-for="r in rcStore.codes" :key="r.id">
              <td class="mono">{{ r.code }}</td>
              <td>{{ r.description || '—' }}</td>
              <td class="c" style="white-space:nowrap">
                <button type="button" class="btn-icon" @click="openEdit(r)"><component :is="I.edit" /></button>
                <button type="button" class="btn-del" @click="handleDelete(r)">×</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>


    <!-- ── Modal ── -->
    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal-panel">
        <div class="modal-head">
          <h2>{{ editingId ? 'Edit' : 'Add' }} Reason Code</h2>
          <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="closeModal">
            <component :is="I.x" />
          </button>
        </div>
        <div class="add-form">
          <div class="form-field">
            <label class="field-label">Code <span style="color:var(--red)">*</span></label>
            <input v-model="draft.code" class="field-input mono" placeholder="e.g. 101" />
            <span v-if="codeTaken" class="field-hint is-error">Code นี้มีอยู่แล้ว</span>
          </div>
          <div class="form-field">
            <label class="field-label">Description</label>
            <input v-model="draft.description" class="field-input" placeholder="คำอธิบาย / Description" />
          </div>
        </div>
        <p v-if="modalError" class="field-hint is-error" style="margin-top:8px">{{ modalError }}</p>
        <div class="modal-actions">
          <button type="button" class="btn" @click="closeModal">Cancel</button>
          <button type="button" class="btn" data-variant="primary" :disabled="!canSubmit || saving" @click="submitModal">
            {{ saving ? 'Saving…' : editingId ? 'Update' : 'Add' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { I } from '../components/format.js'
import { useReasonCodeStore } from '../stores/ReasonCode.stores.ts'

const rcStore  = useReasonCodeStore()

const showModal  = ref(false)
const editingId  = ref(null)
const saving     = ref(false)
const modalError = ref('')
const draft = reactive({ code: '', description: '' })

const codeTaken = computed(() => {
  if (editingId.value) return false
  return !!rcStore.codes.find(r => String(r.code).trim() === draft.code.trim() && draft.code.trim())
})

const canSubmit = computed(() => draft.code.trim().length > 0 && !codeTaken.value)

function openAdd() {
  editingId.value  = null
  draft.code       = ''
  draft.description = ''
  modalError.value = ''
  showModal.value  = true
}

function openEdit(r) {
  editingId.value   = r.id
  draft.code        = r.code
  draft.description = r.description || ''
  modalError.value  = ''
  showModal.value   = true
}

function closeModal() {
  showModal.value = false
  editingId.value = null
  modalError.value = ''
}

async function submitModal() {
  if (!canSubmit.value) return
  saving.value = true
  modalError.value = ''
  if (editingId.value) {
    await rcStore.update(editingId.value, { code: draft.code.trim(), description: draft.description.trim() })
    if (rcStore.error) { modalError.value = rcStore.error; saving.value = false; return }
  } else {
    const err = await rcStore.add(draft.code, draft.description)
    if (err) { modalError.value = err; saving.value = false; return }
  }
  saving.value = false
  closeModal()
}

function handleDelete(r) {
  if (!confirm(`ลบ Reason Code "${r.code}" ออกใช่ไหม?`)) return
  rcStore.remove(r.id)
}

onMounted(() => {
  rcStore.loadAll()
})
</script>

<style scoped>
.page {
  padding: 24px 32px 80px;
  max-width: 1200px;
  margin: 0 auto;
}
.page-head { margin-bottom: 20px; }
.page-title { margin: 0; font-size: 18px; }
.page-sub   { margin: 4px 0 0; color: var(--ink-3); font-size: 12px; }
.load-error { margin: 0 0 8px; color: var(--red, #e53e3e); font-size: 12px; }

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
@media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } }

.code-section {
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  overflow: hidden;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}
.section-title { font-size: 14px; font-weight: 700; color: var(--ink); }
.section-sub   { font-size: 11px; color: var(--ink-3); margin-top: 2px; }

.rc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.rc-table th, .rc-table td {
  padding: 9px 14px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
}
.rc-table th {
  color: var(--ink-3);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  background: var(--surface-2);
}
.rc-table tbody tr:last-child td { border-bottom: none; }
.rc-table .mono { font-family: var(--font-mono, monospace); font-weight: 700; }
.empty-cell { text-align: center; color: var(--ink-3); padding: 20px; }

.btn-icon {
  width: 26px; height: 26px;
  border: 1px solid var(--line); border-radius: var(--radius);
  background: none; color: var(--ink-3); font-size: 13px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  margin-right: 4px;
}
.btn-icon:hover { background: var(--surface-2); color: var(--accent); border-color: var(--accent); }

.btn-del {
  width: 26px; height: 26px;
  border: 1px solid var(--line); border-radius: var(--radius);
  background: none; color: var(--ink-4); font-size: 14px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.btn-del:hover {
  background: color-mix(in srgb, var(--red, #e53e3e) 10%, var(--surface));
  color: var(--red, #e53e3e); border-color: var(--red, #e53e3e);
}

/* Modal */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 50;
  display: grid; place-items: center; padding: 24px;
  background: rgba(15, 23, 42, 0.35);
}
.modal-panel {
  width: min(420px, 100%);
  border: 1px solid var(--line); border-radius: var(--radius-lg);
  background: var(--surface); box-shadow: var(--shadow); padding: 20px;
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 18px;
}
.modal-head h2 { margin: 0; font-size: 16px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.add-form { display: grid; gap: 14px; }
.form-field { display: grid; gap: 5px; }
.field-label {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.07em; color: var(--ink-3);
}
.field-input {
  height: 36px; border: 1px solid var(--line); border-radius: var(--radius);
  background: var(--surface-2); color: var(--ink); padding: 0 10px;
  font-size: 13px; width: 100%; box-sizing: border-box;
}
.field-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.field-hint { font-size: 11px; color: var(--ink-4); }
.field-hint.is-error { color: var(--red, #e53e3e); }
</style>
