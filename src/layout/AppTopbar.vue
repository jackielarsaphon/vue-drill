<template>
  <header class="topbar">
    <button type="button" class="sb-menu-btn" @click="$emit('menu')">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <line x1="2" y1="4.5" x2="16" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="2" y1="13.5" x2="16" y2="13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
    <div class="tb-title">
      <span>{{ title }}</span>
      <span class="tb-crumb">· LXML - Copper and Gold Mine</span>
    </div>
    <div class="tb-right">
      <div class="top-user">
        <div class="sb-avatar">{{ userInitial }}</div>
        <div class="top-user-text">
          <div>{{ currentUser }}</div>
        </div>
        <span class="sb-role">{{ role }}</span>
        <button type="button" class="logout-btn" @click="$emit('logout')">Logout</button>
      </div>
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  currentUser: { type: String, required: true },
  userInitial: { type: String, required: true },
  role: { type: String, required: true },
});

defineEmits(['logout', 'menu']);
</script>

<style scoped>
.sb-role {
  text-transform: uppercase;
}

.logout-btn {
  height: 30px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink-2);
  cursor: pointer;
  padding: 0 10px;
  font-size: 12px;
}

.logout-btn:hover {
  color: var(--ink);
  border-color: var(--ink-4);
}

.top-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.top-user-text {
  min-width: 0;
  font-size: 12px;
  color: var(--ink);
  line-height: 1.2;
}

.top-user-text span {
  color: var(--ink-3);
  font-size: 11px;
}
</style>
