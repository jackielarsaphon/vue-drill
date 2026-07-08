<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">TDL — Drill & Blast</h1>
        <p class="page-sub">Weekly LXML plan, patterns, drill logs, daily progress, and blast results. Auto-saves every 60s.</p>
      </div>
    </div>

    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px">
      <div class="stepper">
        <template v-for="(s, i) in steps" :key="s.n">
          <div
            class="step"
            :data-state="step === s.n ? 'active' : step > s.n ? 'done' : 'pending'"
            :data-disabled="!canGoToStep(s.n) ? 'true' : undefined"
            :style="{ cursor: canGoToStep(s.n) ? 'pointer' : 'not-allowed' }"
            @click="goToStep(s.n)"
          >
            <div class="step-num"><component v-if="step > s.n" :is="I.check" /><template v-else>{{ s.n }}</template></div>
            <div>
              <div class="step-label">{{ s.label }}</div>
              <div class="step-meta">{{ s.meta }}</div>
            </div>
          </div>
          <div v-if="i < steps.length - 1" class="step-sep" />
        </template>
      </div>
      <div style="display: flex; gap: 8px">
        <button type="button" class="btn" @click="savePlan">
          <span class="ic"><component :is="I.save" /></span>
          {{ patternsStore.saving ? 'Saving…' : planSaved ? 'Plan saved' : 'Save plan' }}
        </button>
      </div>
    </div>

    <StepWeek
      v-if="step === 1"
      key="step-week"
      :week="week"
      :can-delete-week="canDeleteWeek"
      @next="advanceTo(2)"
      @create-week="createWeek"
      @delete-week="deleteWeek"
    />
    <StepPatterns
      v-else-if="step === 2"
      key="step-patterns"
      :week="week"
      :locked="patternsSaved"
      :initial-pit="importedPit"
      @plan-saved="patternsSaved = true"
      @next="advanceTo(3)"
      @back="step = 1"
    />
    <StepDrillLog v-else-if="step === 3" key="step-drill" :week="week" @back="step = 2" @next="advanceTo(4)" />

    <template v-else-if="step === 4">
      <FuelDataView :week="week" />
      <div class="step-nav">
        <button type="button" class="btn" @click="step = 3">
          <span class="ic"><component :is="I.chevL" /></span>Back to drill log
        </button>
        <button type="button" class="btn" @click="advanceTo(5)">Next</button>
      </div>
    </template>

    <template v-else-if="step === 5">
      <DownTimeView :week="week" />
      <div class="step-nav">
        <button type="button" class="btn" @click="step = 4">
          <span class="ic"><component :is="I.chevL" /></span>Back to fuel
        </button>
        <button type="button" class="btn" @click="advanceTo(6)">Next</button>
      </div>
    </template>

    <StepBlast v-else key="step-blast" :week="week" @back="step = 5" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useDrillLogStore } from '../stores/DrillLog.stores.ts';
import { usePatternsStore } from '../stores/Patterns.stores.ts';
import { useRigsStore } from '../stores/Rigs.stores.ts';
import { useWeeksStore } from '../stores/Weeks.stores.ts';
import { I } from '../components/format.js';
import StepWeek from '../components/steps/StepWeek.vue';
import StepPatterns from '../components/steps/StepPatterns.vue';
import StepDrillLog from '../components/steps/StepDrillLog.vue';
import StepBlast from '../components/steps/StepBlast.vue';
import FuelDataView from './FuelDataPage.vue';
import DownTimeView from './DownTimePage.vue';

const props = defineProps({
  week: { type: Object, required: true },
  canDeleteWeek: { type: Boolean, default: false },
});

const emit = defineEmits(['create-week', 'delete-week']);

const patternsStore = usePatternsStore();
const drillLogStore = useDrillLogStore();
const rigsStore = useRigsStore();
const weeksStore = useWeeksStore();

const step = ref(1);
const unlockedUpTo = ref(1);
const importedPit = ref('');
const planSaved = ref(false);
const patternsSaved = ref(false);

function canGoToStep(n) {
  return n <= unlockedUpTo.value;
}

function goToStep(n) {
  if (canGoToStep(n)) step.value = n;
}

function advanceTo(n) {
  unlockedUpTo.value = Math.max(unlockedUpTo.value, n);
  step.value = n;
}

// Load data whenever the week changes
watch(
  () => props.week?.week_id,
  async (weekId) => {
    if (!weekId) return;
    await Promise.all([
      patternsStore.loadByWeek(weekId),
      drillLogStore.loadByWeek(weekId),
      rigsStore.loadAll(),
    ]);
    planSaved.value = false;
    const hasNonCarryPatterns = patternsStore.patterns.some(
      (p) => Number(p.week_id) === Number(weekId) && Number(p.pit_priority) !== 0,
    );
    patternsSaved.value = hasNonCarryPatterns;
    const isHeaderLocked = Boolean(props.week?.header_locked);
    if (hasNonCarryPatterns) {
      unlockedUpTo.value = 6;
      step.value = 3;
    } else if (isHeaderLocked) {
      unlockedUpTo.value = 2;
      step.value = 2;
    } else {
      unlockedUpTo.value = 1;
      step.value = 1;
    }
  },
  { immediate: true },
);

const weekPatterns = computed(() =>
  patternsStore.patterns.filter((p) => Number(p.week_id) === Number(props.week?.week_id)),
);
const pitCount = computed(() => new Set(weekPatterns.value.map((p) => p.pit_name)).size);
const blastVolume = computed(() => weekPatterns.value.reduce((sum, p) => sum + Number(p.plan_blast_vol_bcm || 0), 0));
const planMetres = computed(() => weekPatterns.value.reduce((sum, p) => sum + Number(p.effective_m || 0), 0));
const actualMetres = computed(() => weekPatterns.value.reduce((sum, p) => sum + Number(p.actual_drilling_m || 0), 0));
const progressPct = computed(() => (planMetres.value > 0 ? (actualMetres.value / planMetres.value) * 100 : 0));

const steps = computed(() => [
  { n: 1, label: 'Week header', meta: `Week ${props.week.week_id} - ${props.week.status}` },
  { n: 2, label: 'Blast patterns', meta: `${weekPatterns.value.length} patterns - ${pitCount.value} pits` },
  { n: 3, label: 'Drill log', meta: 'Daily drilling entries' },
  { n: 4, label: 'Fuel', meta: 'Daily fuel entries' },
  { n: 5, label: 'Down Time', meta: 'Daily downtime entries' },
  { n: 6, label: 'Blast', meta: `${Math.round(blastVolume.value).toLocaleString('en-US')} bcm` },
]);

async function savePlan() {
  await patternsStore.save();
  planSaved.value = true;
}

async function finishWeek() {
  await patternsStore.save();
  await weeksStore.update(props.week.week_id, { status: 'locked' });
  emit('create-week', { week: props.week });
}

function createWeek(event) {
  emit('create-week', event);
  step.value = 1;
  unlockedUpTo.value = 1;
}

function deleteWeek(event) {
  emit('delete-week', event);
  step.value = 1;
  unlockedUpTo.value = 1;
}
</script>

<style scoped>
/* Fuel/Down Time render inside this page's `.page` padding+max-width, so strip
   their own outer box styles to avoid doubled inset. */
.page :deep(.fuel-page),
.page :deep(.dt-page) {
  padding: 0;
  max-width: none;
  margin: 0;
}
/* Back/Next footer for the Fuel and Down Time steps (those pages have no
   built-in step nav of their own). Mirrors the drill-log step footer. */
.step-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 18px;
}
.step[data-disabled] {
  opacity: 0.4;
}
</style>
