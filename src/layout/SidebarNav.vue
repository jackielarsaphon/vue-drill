<template>
  <aside class="sidebar">
    <div class="sb-brand">
      <span class="sb-brand-mark">TDL</span>
      <span class="sb-brand-sub">DRILL & BLAST</span>
    </div>

    <div class="sb-section">Workspace</div>
    <div
      v-for="n in nav"
      :key="n.id"
      class="sb-link"
      :data-active="view === n.id ? 'true' : undefined"
      @click="$emit('change-view', n.id)"
    >
      <span>{{ n.label }}</span>
      <span v-if="n.tag" class="sb-link-tag">{{ n.tag }}</span>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  nav: { type: Array, required: true },
  view: { type: String, required: true },
});

defineEmits(['change-view']);
</script>
