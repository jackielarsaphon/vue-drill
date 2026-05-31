<template>
  <div class="card">
    <div v-if="title || $slots.title || action || $slots.action" class="card-head">
      <div>
        <div v-if="title || $slots.title" class="card-title">
          <slot name="title">{{ title }}</slot>
        </div>
        <div v-if="sub" class="card-sub">{{ sub }}</div>
      </div>
      <slot name="action">{{ action }}</slot>
    </div>
    <div class="card-body" :style="pad ? undefined : { padding: 0 }">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: String,
  sub: String,
  action: String,
  pad: { type: Boolean, default: true },
});
</script>
