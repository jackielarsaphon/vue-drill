<template>
  <TweakRow v-if="!fitsAsSegments" :label="label">
    <TweakSelect :model-value="String(value)" :options="options" @update:model-value="onSelectChange" />
  </TweakRow>
  <TweakRow v-else :label="label">
    <div
      ref="trackRef"
      role="radiogroup"
      class="twk-seg"
      :class="{ dragging }"
      @pointerdown="onPointerDown"
    >
      <div
        class="twk-seg-thumb"
        :style="{
          left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
          width: `calc((100% - 4px) / ${n})`,
        }"
      />
      <button
        v-for="o in opts"
        :key="String(o.value)"
        type="button"
        role="radio"
        :aria-checked="o.value === value"
      >
        {{ o.label }}
      </button>
    </div>
  </TweakRow>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import TweakRow from './TweakRow.vue';
import TweakSelect from './TweakSelect.vue';

const props = defineProps({
  label: String,
  value: null,
  options: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:value']);

const trackRef = ref(null);
const dragging = ref(false);
const valueRef = ref(props.value);

watch(
  () => props.value,
  (v) => {
    valueRef.value = v;
  },
);

function labelLen(o) {
  return String(typeof o === 'object' ? o.label : o).length;
}

const fitsAsSegments = computed(() => {
  const maxLen = props.options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const len = props.options.length;
  const limit = { 2: 16, 3: 10 }[len];
  return limit != null && maxLen <= limit;
});

const opts = computed(() => props.options.map((o) => (typeof o === 'object' ? o : { value: o, label: o })));

const idx = computed(() => Math.max(0, opts.value.findIndex((o) => o.value === props.value)));

const n = computed(() => opts.value.length);

function resolve(s) {
  const m = props.options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
  if (m === undefined) return s;
  return typeof m === 'object' ? m.value : m;
}

function onSelectChange(s) {
  emit('update:value', resolve(s));
}

function segAt(clientX) {
  if (!trackRef.value) return props.value;
  const r = trackRef.value.getBoundingClientRect();
  const inner = r.width - 4;
  const i = Math.floor(((clientX - r.left - 2) / inner) * n.value);
  return opts.value[Math.max(0, Math.min(n.value - 1, i))].value;
}

function onPointerDown(e) {
  dragging.value = true;
  valueRef.value = props.value;
  const v0 = segAt(e.clientX);
  if (v0 !== valueRef.value) emit('update:value', v0);
  const move = (ev) => {
    const v = segAt(ev.clientX);
    if (v !== valueRef.value) {
      valueRef.value = v;
      emit('update:value', v);
    }
  };
  const up = () => {
    dragging.value = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
</script>
