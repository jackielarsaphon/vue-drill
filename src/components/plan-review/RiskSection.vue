<template>
  <div>
    <div class="risk-head" :data-collapsed="!open" @click="open = !open">
      <Pill :status="status">
        <span class="pill-dot" />{{ label }}
      </Pill>
      <div>
        <div style="font-weight: 600; font-size: 13px">
          {{ label }} <span class="count">· {{ list.length }}</span>
        </div>
        <div style="font-size: 11px; color: var(--ink-3)">{{ hint }}</div>
      </div>
      <span class="chev"><component :is="I.chev" /></span>
    </div>
    <div v-show="open" class="risk-body">
      <div
        v-if="list.length === 0"
        style="padding: 24px; color: var(--ink-4); font-size: 12px; text-align: center"
      >
        No patterns match.
      </div>
      <PatternRow v-for="p in list" :key="p.pattern_id" :p="p" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import Pill from '../Pill.vue';
import PatternRow from './PatternRow.vue';
import { I } from '../format.js';

const props = defineProps({
  status: String,
  list: { type: Array, default: () => [] },
  defaultOpen: Boolean,
});

const open = ref(props.defaultOpen);

const label = computed(() =>
  props.status === 'delayed' ? 'Delayed' : props.status === 'at-risk' ? 'At risk' : 'On track',
);

const hint = computed(() =>
  props.status === 'delayed'
    ? 'Blast date has passed and drilling is incomplete'
    : props.status === 'at-risk'
      ? 'Blast date ≤ 2 days away'
      : 'On schedule — no intervention needed',
);
</script>
