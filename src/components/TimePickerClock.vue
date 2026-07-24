<!--
  TimePickerClock — นาฬิกาเลือกเวลาแบบ Material (24 ชม.)
  ใช้แทน <input type="time"> เพื่อคลิกเลือกเวลาบนหน้าปัดได้
  - v-model เป็นสตริง "HH:MM" (24 ชม.) เช่น "06:05"
  - เลือกชั่วโมงก่อน (วงนอก 0–11 / วงใน 12–23) แล้วสลับไปเลือกนาที (ละเอียด 1 นาที)
-->
<template>
  <div class="tpc">
    <!-- ช่องแสดงผล กดเพื่อเปิดนาฬิกา -->
    <input
      type="text"
      readonly
      class="tpc-trigger mono"
      :value="displayValue"
      :placeholder="placeholder"
      @click="open"
      @focus="open"
    />

    <teleport to="body">
      <div v-if="isOpen" class="tpc-overlay" @click.self="cancel">
        <div class="tpc-dialog" role="dialog" aria-modal="true">
          <!-- header: HH : MM -->
          <div class="tpc-head">
            <button
              type="button"
              class="tpc-seg"
              :data-active="mode === 'hour'"
              @click="mode = 'hour'"
            >{{ pad(draftHour) }}</button>
            <span class="tpc-colon">:</span>
            <button
              type="button"
              class="tpc-seg"
              :data-active="mode === 'minute'"
              @click="mode = 'minute'"
            >{{ pad(draftMinute) }}</button>
          </div>

          <!-- clock face -->
          <div ref="faceEl" class="tpc-face" @pointerdown="onPointer" @pointermove="onDrag">
            <!-- เข็ม + จุดปลาย -->
            <svg class="tpc-hand" viewBox="0 0 256 256" width="256" height="256">
              <line
                x1="128" y1="128"
                :x2="handTip.x" :y2="handTip.y"
                stroke="var(--accent)" stroke-width="2"
              />
              <circle cx="128" cy="128" r="4" fill="var(--accent)" />
              <circle :cx="handTip.x" :cy="handTip.y" r="18" fill="var(--accent)" />
            </svg>

            <!-- ตัวเลขบนหน้าปัด -->
            <span
              v-for="n in numbers"
              :key="mode + '-' + n.value"
              class="tpc-num"
              :data-selected="n.selected"
              :style="{ left: n.x + 'px', top: n.y + 'px' }"
            >{{ n.label }}</span>
          </div>

          <!-- footer -->
          <div class="tpc-actions">
            <button type="button" class="btn" data-variant="ghost" @click="cancel">ยกเลิก</button>
            <button type="button" class="btn" data-variant="primary" @click="confirm">ตกลง</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '--:--' },
})
const emit = defineEmits(['update:modelValue'])

const CX = 128, CY = 128, R_OUT = 104, R_IN = 64

const isOpen     = ref(false)
const mode       = ref('hour')   // 'hour' | 'minute'
const draftHour  = ref(0)
const draftMinute = ref(0)
const faceEl     = ref(null)

const displayValue = computed(() => {
  const v = props.modelValue
  return v && /^\d{1,2}:\d{2}$/.test(v) ? v : ''
})

function pad(n) { return String(n).padStart(2, '0') }

function open() {
  const m = /^(\d{1,2}):(\d{2})$/.exec(props.modelValue || '')
  draftHour.value   = m ? Math.min(23, +m[1]) : 0
  draftMinute.value = m ? Math.min(59, +m[2]) : 0
  mode.value  = 'hour'
  isOpen.value = true
}
function cancel()  { isOpen.value = false }
function confirm() {
  emit('update:modelValue', `${pad(draftHour.value)}:${pad(draftMinute.value)}`)
  isOpen.value = false
}

// ── ตำแหน่งตัวเลขบนหน้าปัด ───────────────────────────────────────────────
function polar(angleDeg, r) {
  const rad = (angleDeg - 90) * Math.PI / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

const numbers = computed(() => {
  const out = []
  if (mode.value === 'hour') {
    for (let h = 0; h < 24; h++) {
      const idx = h % 12
      const r   = h < 12 ? R_OUT : R_IN
      const p   = polar(idx * 30, r)
      out.push({ value: h, label: String(h), x: p.x, y: p.y, selected: h === draftHour.value })
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const m = i * 5
      const p = polar(i * 30, R_OUT)
      out.push({ value: m, label: pad(m), x: p.x, y: p.y, selected: m === draftMinute.value })
    }
  }
  return out
})

// ปลายเข็มชี้ไปที่ค่าที่เลือกอยู่
const handTip = computed(() => {
  if (mode.value === 'hour') {
    const h = draftHour.value
    return polar((h % 12) * 30, h < 12 ? R_OUT : R_IN)
  }
  return polar(draftMinute.value * 6, R_OUT)
})

// ── คลิก/ลากบนหน้าปัด ────────────────────────────────────────────────────
function pick(ev) {
  const rect = faceEl.value.getBoundingClientRect()
  const x = ev.clientX - rect.left - rect.width  / 2
  const y = ev.clientY - rect.top  - rect.height / 2
  let ang = Math.atan2(y, x) * 180 / Math.PI      // 0 = ขวา
  ang = (ang + 90 + 360) % 360                     // 0 = บนสุด, ตามเข็ม
  if (mode.value === 'hour') {
    const idx   = Math.round(ang / 30) % 12
    const inner = Math.hypot(x, y) < (R_OUT + R_IN) / 2
    draftHour.value = inner ? idx + 12 : idx
  } else {
    draftMinute.value = Math.round(ang / 6) % 60
  }
}

let dragging = false
function onPointer(ev) {
  dragging = true
  faceEl.value.setPointerCapture?.(ev.pointerId)
  pick(ev)
}
function onDrag(ev) {
  if (dragging) pick(ev)
}
function endDrag(ev) {
  if (!dragging) return
  dragging = false
  // แตะเลือกชั่วโมงเสร็จ → สลับไปเลือกนาทีให้อัตโนมัติ
  if (mode.value === 'hour') mode.value = 'minute'
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerup', endDrag)
}
</script>

<style scoped>
.tpc { display: block; }
.tpc-trigger {
  width: 100%;
  cursor: pointer;
}

.tpc-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, .45);
  display: flex; align-items: center; justify-content: center;
  z-index: 3000;
}
.tpc-dialog {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, .28);
  width: 300px; max-width: calc(100vw - 32px);
}

.tpc-head {
  display: flex; align-items: center; justify-content: center;
  gap: 6px; margin-bottom: 16px;
}
.tpc-seg {
  font-size: 40px; font-weight: 700; line-height: 1;
  padding: 4px 8px; border-radius: 8px;
  border: none; background: transparent;
  color: var(--ink-3); cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.tpc-seg[data-active="true"] { color: var(--accent); background: var(--accent-soft); }
.tpc-colon { font-size: 40px; font-weight: 700; color: var(--ink-3); }

.tpc-face {
  position: relative;
  width: 256px; height: 256px;
  margin: 0 auto;
  border-radius: 50%;
  background: var(--surface-2);
  touch-action: none;
  user-select: none;
}
.tpc-hand { position: absolute; inset: 0; pointer-events: none; }
.tpc-num {
  position: absolute;
  width: 32px; height: 32px;
  margin-left: -16px; margin-top: -16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: var(--ink);
  border-radius: 50%;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
}
.tpc-num[data-selected="true"] { color: #fff; font-weight: 700; }

.tpc-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  margin-top: 16px;
}
</style>
