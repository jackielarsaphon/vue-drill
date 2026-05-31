<template>
  <Teleport to="body">
    <div
      v-show="open"
      ref="dragRef"
      class="twk-panel"
      data-noncommentable=""
      :style="{ right: `${offset.x}px`, bottom: `${offset.y}px` }"
    >
      <div class="twk-hd" @mousedown="onDragStart">
        <b>{{ title }}</b>
        <button class="twk-x" aria-label="Close tweaks" @mousedown.stop @click="dismiss"><component :is="I.x" /></button>
      </div>
      <div class="twk-body">
        <slot />
        <template v-if="hasDeckStage && railEnabled && !noDeckControls">
          <TweakSection label="Deck">
            <TweakToggle v-model="railVisible" label="Thumbnail rail" />
          </TweakSection>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import TweakSection from './TweakSection.vue';
import TweakToggle from './TweakToggle.vue';
import { I } from '../format.js';
import './panel.css';

const props = defineProps({
  title: { type: String, default: 'Tweaks' },
  noDeckControls: Boolean,
});

const open = ref(false);
const dragRef = ref(null);
const offset = ref({ x: 16, y: 16 });
const PAD = 16;

const hasDeckStage = computed(
  () => typeof document !== 'undefined' && !!document.querySelector('deck-stage'),
);

const railEnabled = ref(false);

function readRailVisible() {
  try {
    return localStorage.getItem('deck-stage.railVisible') !== '0';
  } catch {
    return true;
  }
}

const railVisible = ref(readRailVisible());

watch(railVisible, (on) => {
  window.postMessage({ type: '__deck_rail_visible', on }, '*');
});

const offsetRef = { x: 16, y: 16 };

function clampToViewport() {
  const panel = dragRef.value;
  if (!panel) return;
  const w = panel.offsetWidth;
  const h = panel.offsetHeight;
  const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
  const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
  offsetRef.x = Math.min(maxRight, Math.max(PAD, offsetRef.x));
  offsetRef.y = Math.min(maxBottom, Math.max(PAD, offsetRef.y));
  offset.value = { x: offsetRef.x, y: offsetRef.y };
  panel.style.right = `${offsetRef.x}px`;
  panel.style.bottom = `${offsetRef.y}px`;
}

let resizeObserver;

watch(open, (isOpen) => {
  if (!isOpen) {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = undefined;
    }
    window.removeEventListener('resize', clampToViewport);
    return;
  }
  clampToViewport();
  if (typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', clampToViewport);
  } else {
    resizeObserver = new ResizeObserver(clampToViewport);
    resizeObserver.observe(document.documentElement);
  }
});

function onMsg(e) {
  const t = e?.data?.type;
  if (t === '__activate_edit_mode') open.value = true;
  else if (t === '__deactivate_edit_mode') open.value = false;
}

function onRailMsg(e) {
  if (e.data && e.data.type === '__omelette_rail_enabled') railEnabled.value = true;
}

onMounted(() => {
  window.addEventListener('message', onMsg);
  window.addEventListener('message', onRailMsg);
  try {
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
  } catch {
    /* ignore */
  }
  if (hasDeckStage.value) {
    const el = document.querySelector('deck-stage');
    railEnabled.value = !!el?._railEnabled;
  }
});

onUnmounted(() => {
  window.removeEventListener('message', onMsg);
  window.removeEventListener('message', onRailMsg);
  window.removeEventListener('resize', clampToViewport);
  if (resizeObserver) resizeObserver.disconnect();
});

function dismiss() {
  open.value = false;
  try {
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  } catch {
    /* ignore */
  }
}

function onDragStart(e) {
  const panel = dragRef.value;
  if (!panel) return;
  const r = panel.getBoundingClientRect();
  const sx = e.clientX;
  const sy = e.clientY;
  const startRight = window.innerWidth - r.right;
  const startBottom = window.innerHeight - r.bottom;
  const move = (ev) => {
    offsetRef.x = startRight - (ev.clientX - sx);
    offsetRef.y = startBottom - (ev.clientY - sy);
    clampToViewport();
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}
</script>
