<template>
  <!-- ── Toast notifications ── -->
  <Teleport to="body">
    <div class="toast-stack">
      <TransitionGroup name="toast">
        <div v-for="n in notifications" :key="n.id" class="toast-item" :data-type="n.type">
          <span class="toast-icon">
            <svg v-if="n.type==='success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <svg v-else-if="n.type==='error'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <svg v-else-if="n.type==='warn'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </span>
          <div class="toast-body">
            <span class="toast-msg">{{ n.message }}</span>
            <!-- pending pattern actions -->
            <div v-if="n.type==='pending'" class="toast-actions">
              <button class="toast-action-btn" data-variant="confirm" @click="confirmPendingPatterns">ยืนยัน</button>
              <button class="toast-action-btn" data-variant="reject" @click="rejectPendingPatterns">ปฏิเสธ</button>
            </div>
            <!-- go to drill log -->
            <div v-if="n.showGoToLog" class="toast-actions">
              <button class="toast-action-btn" data-variant="goto" @click="$emit('next'); dismissNotification(n.id)">
                Go to Drill Log →
              </button>
            </div>
          </div>
          <button class="toast-close" @click="dismissNotification(n.id)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div v-if="!n.persistent" class="toast-bar" :style="{ animationDuration: n.duration + 'ms' }" />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>

  <div class="log-shell">
    <div class="log-list">

      <div style="padding: 8px 10px; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px">
        <div class="filter-sel" style="height: 28px">
          <span class="ic" style="color: var(--ink-3)"><component :is="I.search" /></span>
          <input v-model="query" placeholder="Filter patterns..." style="border: 0; background: transparent; flex: 1; font-size: 12px" />
        </div>
        <button type="button" class="import-xl-btn" @click="xlsxInput?.click()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import Excel
        </button>
        <input ref="xlsxInput" type="file" accept=".xlsx,.xls,.csv" style="display:none" @change="onXlsxChange" />
      </div>
      <div v-for="group in groupedPatterns" :key="group.pit" class="log-pit-group">
        <button type="button" class="log-pit-head" :data-open="isPitOpen(group.pit) ? 'true' : undefined" @click="togglePit(group.pit)">
          <span class="ic"><component :is="I.chevR" /></span>
          <span class="log-pit-name">{{ group.pit }}</span>
        </button>
        <div v-if="isPitOpen(group.pit)" class="log-pit-items">
          <div
            v-for="p in group.rows"
            :key="p.pattern_id"
            class="log-list-item"
            :data-active="p.pattern_id === pid ? 'true' : undefined"
            @click="pid = p.pattern_id"
          >
            <div class="log-list-id">{{ p.pattern_id }}</div>
            <div class="log-list-meta">
              <span class="num">{{ Math.round(progressPct(p)) }}</span>% · {{ p.num_holes }} holes · remain {{ fnum(remainingMetres(p), 0) }} m
            </div>
            <div style="margin-top: 6px">
              <Bar :pct="progressPct(p)" :status="barStatus(p)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <Card
        v-if="pat"
        :sub="`${pat.pit_name} - ${pat.pattern_type} - ${pat.num_holes} holes - plan ${fnum(pat.effective_m)} m - remain ${fnum(remainingMetres(pat), 1)} m`"
      >
        <template #title>
          <span class="mono" style="font-family: var(--font-mono)">{{ pid }}</span>
        </template>
        <template #action>
          <div style="display: flex; gap: 8px; align-items: center">
            <span style="font-size: 11px; color: var(--ink-3)">Progress</span>
            <strong class="mono" style="font-size: 13px">{{ Math.round(progressPct(pat)) }}%</strong>
            <div style="width: 120px"><Bar :pct="progressPct(pat)" :status="barStatus(pat)" /></div>
          </div>
        </template>

        <div class="log-summary">
          <div>
            <span>Plan m</span>
            <strong class="mono">{{ fnum(pat.effective_m, 1) }}</strong>
          </div>
          <div>
            <span>Drilled from log</span>
            <strong class="mono">{{ fnum(drilledMetres(pat), 1) }}</strong>
          </div>
          <div>
            <span>Remaining</span>
            <strong class="mono">{{ fnum(remainingMetres(pat), 1) }}</strong>
          </div>
          <div>
            <span>Today</span>
            <strong class="mono">{{ fnum(todayMetres(pat), 1) }}</strong>
          </div>
        </div>

        <div class="hr" />

        <div class="form-grid">
          <Field label="Work date" :hint="weekRangeHint">
            <div class="dmy-wrap">
              <input
                v-model="workDateText"
                class="mono"
                :data-invalid="workDateOutOfWeek ? 'true' : undefined"
                placeholder="DD/MM/YYYY"
                maxlength="10"
                @blur="onWorkDateBlur"
                @keydown.enter.prevent="onWorkDateBlur"
              />
              <span class="dmy-cal">
                <input type="date" :value="date" class="dmy-native" :min="weekStartIso || undefined" :max="weekEndIso || undefined" @change="e => onNativeDate(e.target.value)" />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
            </div>
            <div v-if="workDateOutOfWeek" class="date-week-warn">
              วันที่อยู่นอกสัปดาห์ที่กำหนด — กรอกได้เฉพาะ {{ toDisplayDate(weekStartIso) }} – {{ toDisplayDate(weekEndIso) }}
            </div>
          </Field>
          <Field label="Shift">
            <div class="shift-toggle">
              <button type="button" :data-active="shift === 'day' ? 'true' : undefined" @click="shift = 'day'">Day</button>
              <button type="button" :data-active="shift === 'night' ? 'true' : undefined" @click="shift = 'night'">Night</button>
            </div>
          </Field>
          <Field label="Rig">
            <select v-model="rig" class="mono">
              <option v-for="r in RIGS" :key="r" :value="r">{{ r }}</option>
            </select>
          </Field>
          <Field label="Operator" hint="Type code or name to filter">
            <div class="op-combo">
              <input
                v-model="opQuery"
                placeholder="Code or name…"
                autocomplete="off"
                @focus="showOpDrop = true"
                @input="showOpDrop = true"
                @blur="onOpBlur"
              />
              <ul v-if="showOpDrop && filteredOperators.length" class="op-drop">
                <li
                  v-for="o in filteredOperators"
                  :key="o.operator_id"
                  :data-active="o.name === operator ? 'true' : undefined"
                  @mousedown.prevent="selectOperator(o)"
                >
                  <span class="op-code">{{ o.operator_id }}</span>
                  <span class="op-name">{{ o.name }}</span>
                </li>
              </ul>
            </div>
          </Field>
        </div>

        <div class="hr" />

        <div class="form-grid">
          <Field label="Drill bit size (mm)" :hint="pat?.hole_diameter_mm ? `Auto from pattern: ${pat.hole_diameter_mm} mm` : ''"><input v-model.number="bitSize" class="mono" type="number" /></Field>
          <Field label="Drilling (m)" hint="Net drilling metres"><input v-model.number="totalDrilling" class="mono" type="number" step="0.1" /></Field>
          <Field label="Redrill (m)" hint="Excluded from net progress"><input v-model.number="redrill" class="mono" type="number" step="0.1" /></Field>
          <Field label="Total drilling (m)" hint="Auto: Drilling + Redrill"><input :value="fnum(totalDrillingSum, 1)" class="mono" type="text" readonly tabindex="-1" /></Field>
        </div>

        <div class="hr" />

        <div class="form-grid">
          <Field label="SMU start"><input v-model.number="smuStart" class="mono" type="number" step="0.1" /></Field>
          <Field label="SMU end"><input v-model.number="smuEnd" class="mono" type="number" step="0.1" /></Field>
          <Field label="Drifter start"><input v-model.number="drifterStart" class="mono" type="number" step="0.1" /></Field>
          <Field label="Drifter end"><input v-model.number="drifterEnd" class="mono" type="number" step="0.1" /></Field>
        </div>
        <div class="note" style="margin-top: 12px">
          SMU hours = end - start = <strong>{{ fnum(smuHours, 1) }} h</strong> · Drifter hours =
          <strong>{{ fnum(drifterHours, 1) }} h</strong>. Unique by (pattern, week, date, shift, rig).
        </div>

        <div class="save-entry-row">
          <button type="button" class="btn" data-variant="ghost" @click="resetEntryFields(); editingId = null; saveMessage = ''">Clear</button>
          <button v-if="editingId" type="button" class="btn" data-variant="primary" :disabled="workDateOutOfWeek" @click="saveEntry(false)">
            <span class="ic"><component :is="I.check" /></span>Update entry
          </button>
          <button v-else type="button" class="btn" data-variant="primary" :disabled="workDateOutOfWeek" @click="saveEntry(false)">
            <span class="ic"><component :is="I.check" /></span>Save entry
          </button>
        </div>
        <div v-if="saveMessage" class="note" style="margin-top: 10px; color: var(--ink)">
          {{ saveMessage }}
        </div>

        <div class="hr" />

        <div class="recent-head">
          <div>Recent entries for this pattern</div>
          <div class="recent-date-range">
            <div class="dmy-wrap recent-date-input">
              <input v-model="recentFromText" class="mono" placeholder="DD/MM/YYYY" maxlength="10" @blur="onRecentFromBlur" @keydown.enter.prevent="onRecentFromBlur" />
              <span class="dmy-cal">
                <input type="date" :value="recentFrom" class="dmy-native" @change="e => onNativeRecentFrom(e.target.value)" />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
            </div>
            <span style="color: var(--ink-3); font-size: 12px">to</span>
            <div class="dmy-wrap recent-date-input">
              <input v-model="recentToText" class="mono" placeholder="DD/MM/YYYY" maxlength="10" @blur="onRecentToBlur" @keydown.enter.prevent="onRecentToBlur" />
              <span class="dmy-cal">
                <input type="date" :value="recentTo" class="dmy-native" @change="e => onNativeRecentTo(e.target.value)" />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
            </div>
          </div>
        </div>
        <div class="recent-table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift</th>
              <th>Rig</th>
              <th>Operator</th>
              <th class="r">Bit mm</th>
              <th class="r">Redrill</th>
              <th class="r">Net m</th>
              <th class="r">Total drill</th>
              <th class="r">SMU h</th>
              <th style="width: 72px" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(e, i) in recent" :key="i" :data-editing="editingId === e.id ? 'true' : undefined">
              <td class="num">
                <input v-if="editingId === e.id" v-model="date" type="date" class="inline-date" />
                <span v-else>{{ fmtTableDate(e.work_date) }}</span>
              </td>
              <td>
                <span
                  class="mono"
                  style="font-size: 11px"
                  :style="{ color: e.shift === 'day' ? 'var(--ink)' : 'var(--ink-3)' }"
                  >{{ e.shift }}</span
                >
              </td>
              <td><span class="mono">{{ e.rig_id }}</span></td>
              <td>{{ e.employee_name }}</td>
              <td class="num r dim">{{ e.drill_bit_size_mm ?? '—' }}</td>
              <td class="num r dim">{{ e.redrill_m > 0 ? fnum(e.redrill_m, 1) : '—' }}</td>
              <td class="num r"><strong>{{ fnum(e.total_drilling_m, 1) }}</strong></td>
              <td class="num r"><strong>{{ fnum((Number(e.total_drilling_m) || 0) + (Number(e.redrill_m) || 0), 1) }}</strong></td>
              <td class="num r">{{ fnum(e.smu_hr, 1) }}</td>
              <td class="c" style="white-space: nowrap">
                <button type="button" class="btn" data-variant="ghost" data-size="sm" style="padding: 0 6px" @click="loadEntry(e)">
                  <span class="ic"><component :is="I.edit" /></span>
                </button>
                <button type="button" class="btn" data-variant="ghost" data-size="sm" style="padding: 0 6px; color: var(--red)" @click="deleteEntryRow(e)">
                  <span class="ic"><component :is="I.x" /></span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 18px">
          <button type="button" class="btn" @click="$emit('back')">
            <span class="ic"><component :is="I.chevL" /></span>Back to patterns
          </button>
          <button type="button" class="btn" @click="$emit('next')">Next</button>
        </div>
      </Card>
      <Card v-else title="No pattern selected" sub="Add blast patterns before entering drill logs." />
    </div>
  </div>

  <!-- ── Import preview modal ─────────────────────────────────────── -->
  <div v-if="importRows.length" class="import-overlay">
    <div class="import-modal">
      <!-- ── Step indicator ── -->
      <div v-if="importNewPatterns.length" class="import-steps">
        <span :data-active="importStep===1?'true':undefined">1 ตรวจสอบข้อมูล</span>
        <span class="import-step-sep">›</span>
        <span :data-active="importStep===2?'true':undefined">2 กำหนด Pattern ใหม่</span>
      </div>

      <!-- ── Step 1 header ── -->
      <div v-if="importStep===1" class="import-modal-head">
        <div>
          <div class="import-modal-title">ตรวจสอบข้อมูลก่อนนำเข้า</div>
          <div class="import-modal-sub">
            พบ {{ importRows.length }} รายการ · สัปดาห์ {{ props.week?.week_id }}
            <span v-if="importRows.filter(r=>r._errors?.length).length" style="color:var(--red);margin-left:8px">
              · ผิดพลาด {{ importRows.filter(r=>r._errors?.length).length }} แถว (จะถูกข้าม)
            </span>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="discardImport">ยกเลิก</button>
          <button type="button" class="btn" data-variant="primary" data-size="sm"
            @click="importNewPatterns.length ? importStep=2 : confirmImport()">
            {{ importNewPatterns.length ? `ถัดไป · ${importNewPatterns.length} Pattern ใหม่ →` : `นำเข้า ${importRows.length} รายการ` }}
          </button>
        </div>
      </div>

      <!-- ── Step 2 header ── -->
      <div v-if="importStep===2" class="import-modal-head">
        <div>
          <div class="import-modal-title">กำหนดข้อมูล Pattern ใหม่</div>
          <div class="import-modal-sub">แก้ไขได้ก่อนยืนยัน · {{ importNewPatterns.length }} Pattern ใหม่</div>
        </div>
        <div style="display:flex;gap:8px">
          <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="importStep=1">← กลับ</button>
          <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="rejectNewPatterns">ปฏิเสธ Pattern ใหม่</button>
          <button type="button" class="btn" data-variant="primary" data-size="sm" :disabled="importLoading" @click="confirmImport()">
            {{ importLoading ? 'กำลังนำเข้า…' : 'ยืนยัน' }}
          </button>
        </div>
      </div>

      <!-- ══ STEP 2: edit new patterns ══ -->
      <div v-if="importStep===2" class="import-table-wrap">
        <table class="tbl import-preview-tbl">
          <thead>
            <tr>
              <th>Pattern ID</th>
              <th>บ่อ</th>
              <th>Type</th>
              <th class="r">RL</th>
              <th class="r">Bench m</th>
              <th class="r">Holes</th>
              <th class="r">Bit mm</th>
              <th class="r">Plan m</th>
              <th class="r">Eff. m</th>
              <th>Blast date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in importNewPatterns" :key="p.pattern_id">
              <td class="mono" style="font-size:11px">{{ p.pattern_id }}</td>
              <td><input v-model="p.pit_name" class="tbl-input mono" /></td>
              <td><input v-model="p.pattern_type" class="tbl-input mono" style="width:60px" /></td>
              <td><input v-model.number="p.rl_level" class="tbl-input mono r" type="number" style="width:56px" /></td>
              <td><input v-model.number="p.bench_height_m" class="tbl-input mono r" type="number" style="width:56px" /></td>
              <td><input v-model.number="p.num_holes" class="tbl-input mono r" type="number" style="width:60px" /></td>
              <td><input v-model.number="p.hole_diameter_mm" class="tbl-input mono r" type="number" style="width:60px" /></td>
              <td><input v-model.number="p.plan_total_drilling_m" class="tbl-input mono r" type="number" step="0.1" style="width:72px" /></td>
              <td><input v-model.number="p.effective_m" class="tbl-input mono r" type="number" step="0.1" style="width:72px" /></td>
              <td><input v-model="p.blast_date" class="tbl-input mono" type="date" style="width:130px" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ══ STEP 1: preview + column map ══ -->
      <template v-if="importStep===1">

      <!-- download template link -->
      <div style="padding:8px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;color:var(--ink-3)">ไม่มี template?</span>
        <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="downloadTemplate">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          ดาวน์โหลด Template Excel
        </button>
      </div>

      <!-- column mapping summary -->
      <div class="import-col-summary">
        <span class="import-col-label">คอลัมน์ที่อ่านได้:</span>
        <span v-for="f in SYSTEM_FIELDS" :key="f"
          class="import-col-chip"
          :data-found="importColMap[f] ? 'true' : 'false'"
        >{{ importColMap[f] || f }}</span>
      </div>

      <!-- preview table -->
      <div class="import-table-wrap">
        <table class="tbl import-preview-tbl">
          <thead>
            <tr>
              <th class="c" style="width:36px">#</th>
              <th>Pattern ID</th>
              <th>วันที่</th>
              <th>กะ</th>
              <th>Rig</th>
              <th>พนักงาน</th>
              <th class="r">Bit mm</th>
              <th class="r">Net m</th>
              <th class="r">Redrill</th>
              <th class="r">Total drill</th>
              <th class="r">SMU start</th>
              <th class="r">SMU end</th>
              <th class="r">Drift start</th>
              <th class="r">Drift end</th>
              <th>ตรวจสอบ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in importRows" :key="i"
              :class="[row._isNewPattern ? 'import-row-new' : '', row._errors?.length ? 'import-row-error' : '']"
            >
              <td class="c mono dim">{{ row._row }}</td>
              <td>
                <span class="mono">{{ row.pattern_id }}</span>
                <span v-if="row._isNewPattern" class="import-new-badge">ใหม่</span>
              </td>
              <td class="mono">{{ row.work_date || '—' }}</td>
              <td><span class="mono" :style="{ color: row.shift === 'night' ? 'var(--ink-3)' : undefined }">{{ row.shift }}</span></td>
              <td class="mono">{{ row.rig_id || '—' }}</td>
              <td>{{ row.employee_name || '—' }}</td>
              <td class="r num">{{ row.drill_bit_size_mm || '—' }}</td>
              <td class="r num"><strong>{{ row.total_drilling_m }}</strong></td>
              <td class="r num dim">{{ row.redrill_m > 0 ? row.redrill_m : '—' }}</td>
              <td class="r num"><strong>{{ fnum((Number(row.total_drilling_m) || 0) + (Number(row.redrill_m) || 0), 1) }}</strong></td>
              <td class="r num dim">{{ row.smu_start || '—' }}</td>
              <td class="r num dim">{{ row.smu_end || '—' }}</td>
              <td class="r num dim">{{ row.drifter_start || '—' }}</td>
              <td class="r num dim">{{ row.drifter_end || '—' }}</td>
              <td>
                <span v-if="!row._errors?.length" class="import-valid-badge">✓</span>
                <span v-else class="import-error-list">
                  <span v-for="e in row._errors" :key="e" class="import-error-tag">{{ e }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      </template><!-- end step 1 -->
    </div>
  </div>

  <!-- ── Loading overlay ── -->
  <div v-if="importLoading" class="import-loading-overlay">
    <div class="import-loading-box">
      <svg class="import-loading-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <div class="import-loading-title">กำลังนำเข้าข้อมูล…</div>
      <div class="import-loading-sub">กรุณารอสักครู่ อย่าปิดหน้านี้</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, watchEffect } from 'vue';
import { storeToRefs } from 'pinia';
import * as XLSX from 'xlsx';
import { fmtDate, fmtDisplayDate, fnum, I } from '../format.js';
import Card from '../Card.vue';
import Field from '../Field.vue';
import Bar from '../Bar.vue';
import { useDrillLogStore } from '../../stores/DrillLog.stores.ts';
import { usePatternsStore } from '../../stores/Patterns.stores.ts';
import { useRigsStore } from '../../stores/Rigs.stores.ts';
import { useOperatorsStore } from '../../stores/Operators.stores.ts';
import { useNotificationsStore } from '../../stores/Notifications.stores.ts';

const TODAY = new Date();

defineEmits(['back', 'next']);
const props = defineProps({
  week: { type: Object, required: true },
});

const patternsStore = usePatternsStore();
const drillLogStore = useDrillLogStore();
const rigsStore = useRigsStore();
const operatorsStore = useOperatorsStore();
const notifStore = useNotificationsStore();
operatorsStore.loadAll();

const { patterns } = storeToRefs(patternsStore);
const { drillLog: DRILL_LOG } = storeToRefs(drillLogStore);
const RIGS = computed(() => rigsStore.rigIds);
const OPERATORS = computed(() => operatorsStore.operators);

const pid = ref('');
const query = ref('');
const openPits = ref(new Set());
const date = ref(dateInput(TODAY));
const shift = ref('day');
const rig = ref('HE-001');
const operator    = ref('');
const opQuery     = ref('');
const showOpDrop  = ref(false);

watch(OPERATORS, (list) => {
  if (!operator.value && list.length) {
    operator.value = list[0].name;
    opQuery.value  = list[0].name;
  }
}, { immediate: true });

const filteredOperators = computed(() => {
  const q = opQuery.value.trim().toLowerCase();
  if (!q) return OPERATORS.value;
  return OPERATORS.value.filter(
    (o) => o.operator_id.toLowerCase().includes(q) || o.name.toLowerCase().includes(q),
  );
});

function selectOperator(o) {
  operator.value   = o.name;
  opQuery.value    = o.name;
  showOpDrop.value = false;
}

function onOpBlur() {
  setTimeout(() => { showOpDrop.value = false; }, 160);
  const val = opQuery.value.trim();
  const byCode = OPERATORS.value.find((o) => o.operator_id.toLowerCase() === val.toLowerCase());
  if (byCode) selectOperator(byCode);
  else if (val) operator.value = val;
}
const workDateText = ref('');

function toDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${parseInt(d)}/${parseInt(m)}/${y}`;
}

function parseDisplayDate(text) {
  const parts = text.trim().split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  const dd = String(parseInt(d || '0')).padStart(2, '0');
  const mm = String(parseInt(m || '0')).padStart(2, '0');
  const yyyy = y?.trim();
  if (dd === '00' || mm === '00' || !yyyy || yyyy.length !== 4) return '';
  return `${yyyy}-${mm}-${dd}`;
}

// บีบวันที่ให้อยู่ในช่วงสัปดาห์ที่กำหนดเสมอ (สุดแค่ week_start – week_end)
function clampToWeek(iso) {
  if (!iso) return iso;
  if (weekStartIso.value && iso < weekStartIso.value) return weekStartIso.value;
  if (weekEndIso.value && iso > weekEndIso.value) return weekEndIso.value;
  return iso;
}

function onWorkDateBlur() {
  const iso = parseDisplayDate(workDateText.value);
  if (iso) {
    date.value = clampToWeek(iso);
    workDateText.value = toDisplayDate(date.value);
  } else {
    workDateText.value = toDisplayDate(date.value);
  }
}

function onNativeDate(iso) {
  date.value = clampToWeek(iso);
  workDateText.value = toDisplayDate(date.value);
}

watch(date, (val) => { workDateText.value = toDisplayDate(val); }, { immediate: true });

const bitSize = ref(115);
const totalDrilling = ref(0);
const redrill = ref(0);
const fuelLitres = ref(0);
const smuStart = ref(0);
const smuEnd = ref(0);
const drifterStart = ref(0);
const drifterEnd = ref(0);
const saveMessage = ref('');
const editingId = ref(null);

const weekId = computed(() => Number(props.week?.week_id));

// ── week-bounds guard: ห้ามกรอกวันที่นอกสัปดาห์ที่กำหนด ──────────────────────
const weekStartIso = computed(() => (props.week?.week_start ? dateInput(props.week.week_start) : ''));
const weekEndIso   = computed(() => (props.week?.week_end ? dateInput(props.week.week_end) : ''));
const workDateOutOfWeek = computed(() =>
  !!weekStartIso.value && !!weekEndIso.value && !!date.value &&
  (date.value < weekStartIso.value || date.value > weekEndIso.value),
);
const weekRangeHint = computed(() =>
  weekStartIso.value && weekEndIso.value
    ? `สัปดาห์: ${toDisplayDate(weekStartIso.value)} – ${toDisplayDate(weekEndIso.value)}`
    : '',
);

// ค่าเริ่มต้น/เปลี่ยนสัปดาห์ที่หลุดนอกช่วง → เริ่มที่ "วันแรกของสัปดาห์" (ให้เลือกไล่ไป 4→10 ได้)
// ส่วนการพิมพ์/เลือกเกินขอบเขต จะถูกบีบเข้าใกล้สุด (สุดที่วันจบ week) ใน onWorkDateBlur/onNativeDate
watch([date, weekStartIso, weekEndIso], () => {
  if (editingId.value) return;
  if (workDateOutOfWeek.value) date.value = weekStartIso.value || clampToWeek(date.value);
}, { immediate: true });

const pat = computed(() =>
  patterns.value.find((p) => p.pattern_id === pid.value && Number(p.week_id) === weekId.value),
);

watch(
  [patterns, weekId],
  ([list, id]) => {
    if (!list?.length || id == null || Number.isNaN(id)) return;
    const match = list.find((p) => Number(p.week_id) === id);
    if (!match) return;
    if (!pid.value || !list.some((p) => p.pattern_id === pid.value && Number(p.week_id) === id)) {
      pid.value = match.pattern_id;
    }
  },
  { immediate: true },
);

watch(pid, (newPid) => {
  if (editingId.value) return;
  const p = patterns.value.find((p) => p.pattern_id === newPid && Number(p.week_id) === weekId.value);
  if (p?.hole_diameter_mm) bitSize.value = p.hole_diameter_mm;
}, { immediate: true });

const totalDrillingSum = computed(() => Number(totalDrilling.value || 0) + Number(redrill.value || 0));
const smuHours = computed(() => Math.max(0, Number(smuEnd.value || 0) - Number(smuStart.value || 0)));
const drifterHours = computed(() => Math.max(0, Number(drifterEnd.value || 0) - Number(drifterStart.value || 0)));
const activePatterns = computed(() => {
  const q = query.value.trim().toLowerCase();
  const rows = patterns.value.filter((p) => Number(p.week_id) === weekId.value);
  if (!q) return rows;
  return rows.filter((p) =>
    [p.pattern_id, p.pit_name, p.pattern_type].some((value) => String(value || '').toLowerCase().includes(q)),
  );
});
const groupedPatterns = computed(() => {
  const groups = new Map();
  for (const p of activePatterns.value) {
    if (!groups.has(p.pit_name)) groups.set(p.pit_name, []);
    groups.get(p.pit_name).push(p);
  }

  return [...groups.entries()]
    .map(([pit, rows]) => {
      const plan = rows.reduce((sum, p) => sum + Number(p.effective_m || 0), 0);
      const actual = rows.reduce((sum, p) => sum + drilledMetres(p), 0);
      return {
        pit,
        rows,
        progress: plan > 0 ? (actual / plan) * 100 : 0,
      };
    })
    .sort((a, b) => a.pit.localeCompare(b.pit));
});
const recentFrom = ref('');
const recentTo = ref(dateInput(TODAY));
const recentFromText = ref('');
const recentToText = ref(toDisplayDate(dateInput(TODAY)));

watchEffect(() => {
  if (props.week?.week_start) {
    recentFrom.value = dateInput(props.week.week_start);
    recentFromText.value = toDisplayDate(recentFrom.value);
  }
});

function onRecentFromBlur() {
  const iso = parseDisplayDate(recentFromText.value);
  if (iso) { recentFrom.value = iso; recentFromText.value = toDisplayDate(iso); }
  else recentFromText.value = toDisplayDate(recentFrom.value);
}
function onNativeRecentFrom(iso) { recentFrom.value = iso; recentFromText.value = toDisplayDate(iso); }

function onRecentToBlur() {
  const iso = parseDisplayDate(recentToText.value);
  if (iso) { recentTo.value = iso; recentToText.value = toDisplayDate(iso); }
  else recentToText.value = toDisplayDate(recentTo.value);
}
function onNativeRecentTo(iso) { recentTo.value = iso; recentToText.value = toDisplayDate(iso); }

const recent = computed(() => {
  const from = recentFrom.value;
  const to = recentTo.value;
  return DRILL_LOG.value
    .filter((e) => {
      if (e.pattern_id !== pid.value) return false;
      const d = dateInput(e.work_date);
      return (!from || d >= from) && (!to || d <= to);
    })
    .sort((a, b) => dateInput(b.work_date).localeCompare(dateInput(a.work_date)));
});

function fmtShortDate(value) {
  return fmtDisplayDate(value);
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtTableDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1970) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function dateInput(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function entryDate() {
  const nextDate = new Date(date.value);
  return Number.isNaN(nextDate.getTime()) ? new Date(TODAY) : nextDate;
}

function sameEntryDate(a, b) {
  return dateInput(a) === dateInput(b);
}

function totalEntry(entry) {
  return Number(entry.total_drilling_m || 0) + Number(entry.redrill_m || 0);
}

function drilledMetres(pattern) {
  return +DRILL_LOG.value
    .filter((e) => Number(e.week_id) === weekId.value && e.pattern_id === pattern.pattern_id)
    .reduce((s, e) => s + totalEntry(e), 0)
    .toFixed(1);
}

function remainingMetres(pattern) {
  const drilled = drilledMetres(pattern);
  return +Math.max(0, Number(pattern.effective_m || 0) - drilled).toFixed(1);
}

function progressPct(pattern) {
  const plan = Number(pattern.effective_m || 0);
  const drilled = drilledMetres(pattern);
  return plan > 0 ? +(Math.min(100, (drilled / plan) * 100)).toFixed(1) : 0;
}

function barStatus(pattern) {
  if (pattern.blast_td_updated) return riskFor(pattern);
  const blastDate = pattern.planned_blast_date ? new Date(pattern.planned_blast_date) : null;
  if (!blastDate || isNaN(blastDate.getTime())) return 'no-date';
  const daysToBlast = Math.round((blastDate.getTime() - TODAY.getTime()) / 86400000);
  if (daysToBlast < 0 && !pattern.blast_td_updated) return 'delayed';
  if (daysToBlast <= 2 && !pattern.blast_td_updated) return 'at-risk';
  return 'on-track';
}

function todayMetres(pattern) {
  const day = entryDate();
  return DRILL_LOG.value
    .filter((entry) => Number(entry.week_id) === weekId.value && entry.pattern_id === pattern.pattern_id && sameEntryDate(entry.work_date, day))
    .reduce((sum, entry) => sum + totalEntry(entry), 0);
}

function riskFor(pattern) {
  const blastDate = pattern.planned_blast_date ? new Date(pattern.planned_blast_date) : null;
  if (!blastDate || isNaN(blastDate.getTime())) return 'no-date';
  const daysToBlast = Math.round((blastDate.getTime() - TODAY.getTime()) / 86400000);
  if (daysToBlast < 0 && !pattern.blast_td_updated) return 'delayed';
  if (daysToBlast <= 2 && !pattern.blast_td_updated) return 'at-risk';
  return 'on-track';
}

function resetEntryFields() {
  bitSize.value = pat.value?.hole_diameter_mm ?? 115;
  totalDrilling.value = 0;
  redrill.value = 0;
  fuelLitres.value = 0;
  smuStart.value = 0;
  smuEnd.value = 0;
  drifterStart.value = 0;
  drifterEnd.value = 0;
}

async function saveEntry(addAnotherShift) {
  if (!pat.value) return;
  if (workDateOutOfWeek.value) {
    saveMessage.value = `กรอกไม่ได้: วันที่ ${toDisplayDate(date.value)} อยู่นอกสัปดาห์ที่กำหนด (${toDisplayDate(weekStartIso.value)} – ${toDisplayDate(weekEndIso.value)})`;
    return;
  }
  const workDate = entryDate();
  const isoDate = dateInput(workDate);
  const entry = {
    ...(editingId.value ? { id: editingId.value } : {}),
    pattern_id: pid.value,
    week_id: props.week.week_id,
    rig_id: rig.value,
    work_date: isoDate,
    shift: shift.value,
    employee_name: operator.value || 'Unknown',
    drill_bit_size_mm: Number(bitSize.value || pat.value.hole_diameter_mm || 115),
    total_drilling_m: Number(totalDrilling.value || 0),
    redrill_m: Number(redrill.value || 0),
    smu_start: Number(smuStart.value || 0),
    smu_end: Number(smuEnd.value || 0),
    smu_hr: smuHours.value,
    drifter_start: Number(drifterStart.value || 0),
    drifter_end: Number(drifterEnd.value || 0),
    drifter_hr: drifterHours.value,
    fuel_l: Number(fuelLitres.value || 0),
  };

  const { error } = await drillLogStore.upsertEntry(entry);
  saveMessage.value = error
    ? `Error saving entry: ${error.message ?? error}`
    : `Saved drill log for ${fmtDate(workDate)} ${shift.value} shift.`;

  if (!error) {
    editingId.value = null;
    resetEntryFields();
    if (addAnotherShift) {
      shift.value = shift.value === 'day' ? 'night' : 'day';
    }
  }
}

function loadEntry(e) {
  editingId.value = e.id;
  date.value = dateInput(e.work_date);
  shift.value = e.shift ?? 'day';
  rig.value = e.rig_id ?? rig.value;
  operator.value = e.employee_name ?? '';
  opQuery.value = e.employee_name ?? '';
  bitSize.value = Number(e.drill_bit_size_mm || 115);
  totalDrilling.value = Number(e.total_drilling_m || 0);
  redrill.value = Number(e.redrill_m || 0);
  fuelLitres.value = Number(e.fuel_l || 0);
  smuStart.value = Number(e.smu_start || 0);
  smuEnd.value = Number(e.smu_end || 0);
  drifterStart.value = Number(e.drifter_start || 0);
  drifterEnd.value = Number(e.drifter_end || 0);
  saveMessage.value = '';
}

async function deleteEntryRow(e) {
  const { error } = await drillLogStore.deleteEntry(e.id);
  saveMessage.value = error ? `Delete failed: ${error.message}` : `Deleted entry for ${fmtDate(e.work_date)} ${e.shift} shift.`;
  if (!error && editingId.value === e.id) {
    editingId.value = null;
    resetEntryFields();
  }
}

function isPitOpen(pitName) {
  return openPits.value.has(pitName);
}

function togglePit(pitName) {
  const next = new Set(openPits.value);
  if (next.has(pitName)) next.delete(pitName);
  else next.add(pitName);
  openPits.value = next;
}

watchEffect(() => {
  if (!activePatterns.value.length) {
    pid.value = '';
    return;
  }

  if (!activePatterns.value.some((p) => p.pattern_id === pid.value)) {
    pid.value = activePatterns.value[0].pattern_id;
  }
});

watchEffect(() => {
  if (query.value.trim()) openPits.value = new Set(groupedPatterns.value.map((group) => group.pit));
});

// ── Excel import ─────────────────────────────────────────────────────────────
const xlsxInput         = ref(null);
const importRows        = ref([]);
const importNewPatterns = ref([]);   // editable new pattern list (step 2)
const importColMap      = ref({});
const importLoading     = ref(false);
const importStep        = ref(1);    // 1 = preview, 2 = edit new patterns

const notifications = computed(() => notifStore.notifications);

const PARTS_RE = /^([A-Z]+[0-9]+[A-Z]*)_([0-9]+)RL_([0-9]+(?:\.[0-9]+)?)M_[0-9]+_([A-Z0-9]+(?:_[A-Z0-9]+)*)$/;

const COL_ALIASES = {
  pattern_id:        ['pattern_name','pattern_id','pattern id','patternid','pattern','pid','work description','work_description','description','รหัส pattern','รหัส'],
  work_date:         ['date','work_date','work date','วันที่','วัน'],
  shift:             ['shift','กะ','กะงาน','กะการทำงาน'],
  rig_id:            ['air code','air_code','rig_id','rig id','rig','รถ','เครื่อง','รถเจาะ'],
  employee_name:     ['operator','employee_name','employee name','employee','name','ชื่อ','พนักงาน','คนขับ'],
  drill_bit_size_mm: ['bit size','bit_size','drill_bit_size_mm','drill bit size mm','bit mm','bit','ดอก mm','ดอก','ขนาดดอก'],
  total_drilling_m:  ['meter','metre','total_drilling_m','total drilling m','total m','net m','drilling m','เมตร','ระยะเจาะ'],
  redrill_m:         ['re-drill','redrill','redrill_m','redrill m','เจาะซ้ำ','ซ้ำ'],
  smu_start:         ['smu','smu_start','smu start','smu_s','smu เริ่ม'],
  smu_end:           ['emu','smu_end','smu end','smu_e','smu จบ'],
  drifter_start:     ['drifter start','drifter_start','drift_s','drifter เริ่ม'],
  drifter_end:       ['drifter end','drifter_end','drift_e','drifter จบ'],
};
const SYSTEM_FIELDS = Object.keys(COL_ALIASES);

function validateImportRow(row, week) {
  const errs = [];
  if (!row.pattern_id) errs.push('ไม่มี Pattern ID');
  if (row.work_date) {
    const d = row.work_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      errs.push('วันที่ผิด format');
    } else if (week?.week_start && week?.week_end) {
      const ws = dateInput(week.week_start);
      const we = dateInput(week.week_end);
      if (d < ws || d > we) errs.push(`วันที่ ${d} อยู่นอกสัปดาห์ (${ws} – ${we})`);
    }
  }
  // ไม่มีวันที่ → ใช้ week_start เป็น fallback (ไม่ถือว่า error)
  if (!['day','night'].includes(row.shift)) errs.push(`กะ "${row.shift}" ไม่ถูกต้อง`);
  if (Number(row.total_drilling_m) < 0) errs.push('Net m ติดลบ');
  if (Number(row.drill_bit_size_mm) <= 0) errs.push('Bit size ต้องมากกว่า 0');
  const smuS = Number(row.smu_start) || 0;
  const smuE = Number(row.smu_end)   || 0;
  if (smuE > 0 && smuS > 0 && smuE < smuS) errs.push('SMU end < start');
  const dftS = Number(row.drifter_start) || 0;
  const dftE = Number(row.drifter_end)   || 0;
  if (dftE > 0 && dftS > 0 && dftE < dftS) errs.push('Drifter end < start');
  return errs;
}

function patternPartsFromId(patternId) {
  const m = String(patternId || '').toUpperCase().match(PARTS_RE);
  if (m) return { pit_name: m[1], rl_level: +m[2], bench_height_m: +m[3], pattern_type: m[4] };
  const pit = String(patternId || '').split('_')[0].toUpperCase();
  return { pit_name: pit || 'UNKNOWN', rl_level: 0, bench_height_m: 0, pattern_type: 'TRI' };
}

const SHIFT_NIGHT = new Set(['night','n','tn','กค','กลางคืน','คืน','กะคืน','กะกลางคืน','2']);
function normalizeShift(val) {
  const s = String(val || '').trim().toLowerCase();
  return SHIFT_NIGHT.has(s) ? 'night' : 'day';
}

function parseExcelDate(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return dateInput(d);
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : dateInput(d);
}

async function onXlsxChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  try {
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf);
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const raw  = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!raw.length) { pushNotification('ไม่พบข้อมูลในไฟล์', 'warn'); return; }

    // build column map (case-insensitive alias matching)
    const firstRow = raw[0];
    const headerKeys = Object.keys(firstRow);
    const colMap = {};
    for (const [field, aliases] of Object.entries(COL_ALIASES)) {
      const key = headerKeys.find(k => aliases.includes(k.trim().toLowerCase()));
      if (key) colMap[field] = key;
    }

    // auto-detect pattern_id: สแกน column ที่มีค่าตรงกับ format Pattern ID
    if (!colMap.pattern_id) {
      const autoKey = headerKeys.find(k =>
        raw.slice(0, 5).some(r => PARTS_RE.test(String(r[k] || '').trim().toUpperCase()))
      );
      if (autoKey) {
        colMap.pattern_id = autoKey;
        pushNotification(`ตรวจพบ Pattern ID อัตโนมัติจากคอลัมน์ "${autoKey}"`, 'info');
      } else {
        pushNotification(`ไม่พบคอลัมน์ Pattern ID — คอลัมน์ในไฟล์: ${headerKeys.join(', ')}`, 'error');
        return;
      }
    }
    importColMap.value = colMap;

    const existingIds = new Set(
      patterns.value.filter(p => Number(p.week_id) === weekId.value).map(p => p.pattern_id)
    );

    const rows = raw.map((r, i) => {
      const patId = String(r[colMap.pattern_id] || '').trim().toUpperCase();
      if (!patId) return null;
      const smuS = colMap.smu_start ? Number(r[colMap.smu_start] || 0) : 0;
      const smuE = colMap.smu_end   ? Number(r[colMap.smu_end]   || 0) : 0;
      const dftS = colMap.drifter_start ? Number(r[colMap.drifter_start] || 0) : 0;
      const dftE = colMap.drifter_end   ? Number(r[colMap.drifter_end]   || 0) : 0;
      const row = {
        _row:          i + 2,
        _isNewPattern: !existingIds.has(patId),
        pattern_id:        patId,
        work_date:         colMap.work_date ? parseExcelDate(r[colMap.work_date]) : '',
        shift:             colMap.shift ? normalizeShift(r[colMap.shift]) : 'day',
        rig_id:            colMap.rig_id ? String(r[colMap.rig_id] || '').trim() : '',
        employee_name:     colMap.employee_name ? String(r[colMap.employee_name] || '').trim() : '',
        drill_bit_size_mm: colMap.drill_bit_size_mm ? Number(r[colMap.drill_bit_size_mm] || 115) : 115,
        total_drilling_m:  colMap.total_drilling_m ? Number(r[colMap.total_drilling_m] || 0) : 0,
        redrill_m:         colMap.redrill_m ? Number(r[colMap.redrill_m] || 0) : 0,
        smu_start: smuS, smu_end: smuE,
        drifter_start: dftS, drifter_end: dftE,
      };
      row._errors = validateImportRow(row, props.week);
      return row;
    }).filter(Boolean);

    if (!rows.length) { pushNotification('ไม่พบแถวข้อมูลที่ใช้ได้', 'warn'); return; }

    const errorCount = rows.filter(r => r._errors.length).length;
    if (errorCount) pushNotification(`พบข้อมูลผิดพลาด ${errorCount} แถว — ตรวจสอบในตาราง preview`, 'warn');

    const newPidSet = new Set(rows.filter(r => r._isNewPattern).map(r => r.pattern_id));
    importNewPatterns.value = [...newPidSet].map(pid => {
      const parts = patternPartsFromId(pid);
      return {
        pattern_id:           pid,
        pit_name:             parts.pit_name,
        pattern_type:         parts.pattern_type,
        rl_level:             parts.rl_level,
        bench_height_m:       parts.bench_height_m,
        hole_diameter_mm:     115,
        num_holes:            0,
        plan_total_drilling_m: 0,
        effective_m:          0,
        blast_date:           '',
        status:               'pending',
        risk:                 'on-track',
      };
    });
    importStep.value = 1;
    importRows.value = rows;
  } catch (err) {
    pushNotification(`อ่านไฟล์ผิดพลาด: ${err?.message ?? err}`, 'error');
  }
}

async function confirmImport() {
  importLoading.value = true;
  try {
    const fallbackDate = dateInput(props.week?.week_start) || dateInput(new Date());
    const validRows = importRows.value.filter(r => !r._errors?.length);
    const existingRows = validRows.filter(r => !r._isNewPattern);
    const newPatRows   = validRows.filter(r =>  r._isNewPattern);

    // 1. นำเข้า drill log เฉพาะ pattern ที่มีอยู่แล้ว
    let ok = 0, fail = 0, dateDefaulted = 0;
    let skipped = importRows.value.length - validRows.length;
    for (const row of existingRows) {
      let workDate = row.work_date;
      if (!workDate) { workDate = fallbackDate; dateDefaulted++; }
      const safeShift = row.shift === 'night' ? 'night' : 'day';
      const smuS = Number(row.smu_start) || 0, smuE = Number(row.smu_end) || 0;
      const dftS = Number(row.drifter_start) || 0, dftE = Number(row.drifter_end) || 0;
      const { error } = await drillLogStore.upsertEntry({
        pattern_id: row.pattern_id, week_id: weekId.value,
        work_date: workDate, shift: safeShift, rig_id: row.rig_id || '',
        employee_name: row.employee_name || 'Unknown',
        drill_bit_size_mm: Number(row.drill_bit_size_mm) || 115,
        total_drilling_m: Number(row.total_drilling_m) || 0,
        redrill_m: Number(row.redrill_m) || 0,
        smu_start: smuS, smu_end: smuE, smu_hr: Math.max(0, smuE - smuS),
        drifter_start: dftS, drifter_end: dftE, drifter_hr: Math.max(0, dftE - dftS),
        fuel_l: 0,
      });
      error ? fail++ : ok++;
    }

    // 2. pattern ใหม่ → เก็บไว้รอยืนยัน (ไม่สร้างทันที)
    if (importNewPatterns.value.length) {
      notifStore.setPendingPatterns({
        patterns: importNewPatterns.value.map(p => ({ ...p, week_id: weekId.value })),
        rows: newPatRows,
        fallbackDate,
        weekId: weekId.value,
      });
    }

    // 3. แจ้งเตือนผล
    if (dateDefaulted) pushNotification(`${dateDefaulted} แถวไม่มีวันที่ → ใช้ ${fallbackDate}`, 'warn');
    if (skipped) pushNotification(`ข้าม ${skipped} แถวที่ข้อมูลผิดพลาด`, 'error');
    pushNotification(
      `นำเข้าสำเร็จ ${ok} รายการ${fail ? ` · ${fail} ผิดพลาด` : ''}`,
      fail ? 'warn' : 'success',
      8000,
      true, // showGoToLog
    );
    discardImport();
  } finally {
    importLoading.value = false;
  }
}

function rejectNewPatterns() {
  // ข้าม pattern ใหม่ — นำเข้าเฉพาะ pattern ที่มีอยู่แล้ว
  importRows.value = importRows.value.map(r =>
    r._isNewPattern ? { ...r, _errors: [...(r._errors || []), 'ปฏิเสธ Pattern ใหม่'] } : r
  );
  importNewPatterns.value = [];
  importStep.value = 1;
}

function discardImport() {
  importRows.value = [];
  importNewPatterns.value = [];
  importColMap.value = {};
  importStep.value = 1;
}

function downloadTemplate() {
  const headers = [
    'pattern_id','work_date','shift','rig_id','employee_name',
    'drill_bit_size_mm','total_drilling_m','redrill_m',
    'smu_start','smu_end','drifter_start','drifter_end',
  ];
  const example = [
    'NLU01_180RL_5M_001_TRI','2025-06-01','day','HE-001','ชื่อพนักงาน',
    115, 25.5, 0, 1000, 1008, 500, 508,
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DrillLog');
  XLSX.writeFile(wb, 'drill-log-template.xlsx');
}

// ── notifications ────────────────────────────────────────────────────────────
function pushNotification(message, type = 'info', duration = 6000, showGoToLog = false) {
  notifStore.push(message, type, duration, showGoToLog);
}

function confirmPendingPatterns() {
  notifStore.confirmPendingPatterns();
}

function rejectPendingPatterns() {
  notifStore.rejectPendingPatterns();
}

function dismissNotification(id) {
  notifStore.dismiss(id);
}
</script>

<style scoped>
.log-pit-group {
  border-bottom: 1px solid var(--line);
}

.log-pit-group:last-child {
  border-bottom: 0;
}

tr[data-editing="true"] td {
  background: var(--accent-soft);
}

.dmy-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}

.dmy-wrap input:first-child {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0 8px;
  height: 32px;
  color: var(--ink);
}

.dmy-wrap:has(input[data-invalid='true']) {
  border-color: color-mix(in srgb, var(--red) 55%, transparent);
  background: color-mix(in srgb, var(--red) 6%, var(--surface));
}

.date-week-warn {
  margin-top: 4px;
  font-size: 11px;
  color: var(--red);
}

.dmy-cal {
  position: relative;
  width: 34px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: 1px solid var(--line);
  color: var(--ink-3);
  cursor: pointer;
  flex-shrink: 0;
  overflow: hidden;
}

.dmy-cal:hover {
  background: var(--surface-2);
  color: var(--ink);
}

.dmy-native {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  color-scheme: light;
}

.inline-date {
  width: 130px;
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 12px;
}

.log-pit-head {
  width: 100%;
  height: 55px;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 32px 34px;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  background: var(--surface);
  border: 0;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
}

.log-pit-head .ic {
  color: var(--ink-3);
  transition: transform 0.15s ease;
}

.log-pit-head:hover {
  background: var(--surface-2);
}

.log-pit-head[data-open="true"] .ic {
  transform: rotate(90deg);
}

.log-pit-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
}

.log-pit-count,
.log-pit-progress {
  font-size: 11px;
  color: var(--ink-3);
}

.log-pit-count {
  min-width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink-2);
  font-size: 13px;
}

.log-pit-progress {
  text-align: right;
}

.log-pit-items {
  background: var(--surface);
}

.log-pit-items .log-list-item {
  padding-left: 22px;
}

.recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
}

.recent-table-wrap {
  overflow-x: auto;
}

.recent-head > div:first-child {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.recent-date-range {
  display: flex;
  align-items: center;
  gap: 6px;
}

.recent-date-input {
  width: 150px;
  font-size: 12px;
}

.save-entry-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

/* ── operator combobox ───────────────────────────────────────────── */
.op-combo {
  position: relative;
}

.op-combo input {
  width: 100%;
}

.op-drop {
  position: absolute;
  z-index: 50;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
  max-height: 220px;
  overflow-y: auto;
}

.op-drop li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
}

.op-drop li:hover,
.op-drop li[data-active="true"] {
  background: var(--surface-2);
}

.op-code {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-3);
  min-width: 52px;
  flex-shrink: 0;
}

.op-name {
  color: var(--ink);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── import Excel button ────────────────────────────────────────── */
.import-xl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 28px;
  border-radius: var(--radius);
  border: 1px solid #1d6f42;
  background: #1d6f42;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background .12s, border-color .12s;
  letter-spacing: 0.02em;
}
.import-xl-btn:hover {
  background: #155232;
  border-color: #155232;
}

/* ── Toast notifications ─────────────────────────────────────── */
.toast-stack {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 320px;
  pointer-events: none;
}
.toast-item {
  pointer-events: all;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px 16px;
  border-radius: 10px;
  font-size: 12.5px;
  border: 1px solid transparent;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(4px);
}
.toast-item[data-type="success"] {
  background: color-mix(in srgb, var(--green) 12%, white);
  border-color: color-mix(in srgb, var(--green) 35%, transparent);
  color: color-mix(in srgb, var(--green) 85%, black);
}
.toast-item[data-type="error"] {
  background: color-mix(in srgb, var(--red) 10%, white);
  border-color: color-mix(in srgb, var(--red) 35%, transparent);
  color: color-mix(in srgb, var(--red) 85%, black);
}
.toast-item[data-type="warn"] {
  background: color-mix(in srgb, var(--amber) 12%, white);
  border-color: color-mix(in srgb, var(--amber) 35%, transparent);
  color: color-mix(in srgb, var(--amber) 80%, black);
}
.toast-item[data-type="info"] {
  background: color-mix(in srgb, var(--accent) 10%, white);
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  color: var(--accent);
}
.toast-icon { flex-shrink: 0; margin-top: 2px; }
.toast-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.toast-msg  { line-height: 1.5; }
.toast-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.toast-action-btn {
  padding: 4px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 11.5px;
  font-weight: 600;
  transition: opacity 0.15s;
}
.toast-action-btn:hover { opacity: 0.85; }
.toast-action-btn[data-variant="confirm"] { background: var(--green); color: #fff; }
.toast-action-btn[data-variant="reject"]  { background: var(--surface-2); color: var(--ink); }
.toast-action-btn[data-variant="goto"]    { background: var(--accent); color: #fff; }

.toast-item[data-type="pending"] {
  background: color-mix(in srgb, var(--amber) 10%, white);
  border-color: color-mix(in srgb, var(--amber) 40%, transparent);
  color: color-mix(in srgb, var(--amber) 80%, black);
}
.toast-close {
  background: none; border: none; cursor: pointer;
  padding: 2px; opacity: 0.5; flex-shrink: 0;
  color: inherit; display: flex; align-items: center;
}
.toast-close:hover { opacity: 1; }

/* progress bar */
.toast-bar {
  position: absolute;
  bottom: 0; left: 0;
  height: 3px;
  width: 100%;
  background: currentColor;
  opacity: 0.35;
  transform-origin: left;
  animation: toast-shrink linear forwards;
}
@keyframes toast-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }

/* transition */
.toast-enter-active { animation: toast-in 0.28s ease; }
.toast-leave-active { animation: toast-out 0.22s ease forwards; }
@keyframes toast-in {
  from { opacity: 0; transform: translateX(60px) scale(0.95); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes toast-out {
  from { opacity: 1; transform: translateX(0) scale(1); }
  to   { opacity: 0; transform: translateX(60px) scale(0.95); }
}

/* ── import modal overlay ──────────────────────────────────────── */
.import-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  overflow-y: auto;
}

.import-modal {
  width: 100%;
  max-width: 1100px;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 40px rgba(0,0,0,.22);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.import-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.import-modal-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}

.import-modal-sub {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 2px;
}

.import-warn-box {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  background: var(--amber-soft, #fff8e1);
  border-bottom: 1px solid color-mix(in srgb, var(--amber) 30%, transparent);
  color: color-mix(in srgb, var(--amber) 80%, var(--ink));
  font-size: 12px;
}

.import-warn-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.import-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-family: var(--font-mono);
  background: color-mix(in srgb, var(--amber) 15%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--amber) 40%, transparent);
  color: var(--ink);
}

.import-chip-pit {
  font-weight: 700;
  color: var(--amber);
  margin-right: 2px;
}

.import-loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}
.import-loading-box {
  background: var(--surface);
  border-radius: 12px;
  padding: 36px 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}
.import-loading-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}
.import-loading-sub {
  font-size: 12px;
  color: var(--ink-3);
}
@keyframes spin { to { transform: rotate(360deg); } }
.import-loading-spin {
  color: var(--accent);
  animation: spin 0.9s linear infinite;
}

.import-steps {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--line);
  font-size: 11px;
  color: var(--ink-3);
}
.import-steps span[data-active="true"] { color: var(--accent); font-weight: 600; }
.import-step-sep { color: var(--ink-4); }

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

.import-row-error td { background: color-mix(in srgb, var(--red) 6%, transparent); }
.import-valid-badge { color: var(--green); font-size: 12px; font-weight: 700; }
.import-error-list { display: flex; flex-direction: column; gap: 2px; }
.import-error-tag {
  display: inline-block;
  font-size: 10px;
  color: var(--red);
  background: color-mix(in srgb, var(--red) 12%, transparent);
  border-radius: 4px;
  padding: 1px 5px;
  white-space: nowrap;
}

.import-col-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--line);
  font-size: 11px;
}
.import-col-label {
  color: var(--ink-3);
  margin-right: 4px;
  white-space: nowrap;
}
.import-col-chip {
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-family: var(--font-mono);
}
.import-col-chip[data-found="true"] {
  background: color-mix(in srgb, var(--green) 15%, transparent);
  color: var(--green);
}
.import-col-chip[data-found="false"] {
  background: var(--surface-2);
  color: var(--ink-4);
  text-decoration: line-through;
}

.import-table-wrap {
  overflow: auto;
  max-height: 55vh;
}

.import-preview-tbl th,
.import-preview-tbl td {
  white-space: nowrap;
}

.import-row-new td {
  background: color-mix(in srgb, var(--amber) 6%, var(--surface));
}

.import-new-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-sans);
  background: var(--amber-soft, #fff8e1);
  color: var(--amber);
  border: 1px solid color-mix(in srgb, var(--amber) 40%, transparent);
  vertical-align: middle;
}
</style>
