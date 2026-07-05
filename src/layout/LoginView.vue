<template>
  <div class="login-page" :data-palette="palette" :data-density="density">
    <section class="login-panel">
      <div class="login-brand">
        <span class="sb-brand-mark">TDL</span>
        <div>
          <h1>Drill & Blast Console</h1>
          <p>LXML - Copper and Gold Mine</p>
        </div>
      </div>

      <div class="login-form">
        <label>
          <span>User name</span>
          <input
            :value="username"
            placeholder="Enter user name"
            @input="$emit('update:username', $event.target.value)"
          />
        </label>
        <label>
          <span>Password</span>
          <input
            :value="password"
            type="password"
            placeholder="Enter password"
            @input="$emit('update:password', $event.target.value)"
            @keyup.enter="$emit('login')"
          />
        </label>
        <div v-if="error" class="login-error">{{ error }}</div>
        <p v-if="authHint" class="login-demo-hint">{{ authHint }}</p>
        <button
          type="button"
          class="btn login-submit"
          data-variant="primary"
          @click="$emit('login')"
        >
          Sign in
        </button>
      </div>

    </section>
  </div>
</template>

<script setup>

const props = defineProps({
  username:  { type: String, required: true },
  password:  { type: String, required: true },
  error:     { type: String, default: '' },
  authHint:  { type: String, default: '' },
  palette:   { type: String, required: true },
  density:   { type: String, required: true },
});

defineEmits(['update:username', 'update:password', 'login']);

</script>

<style scoped>
.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--bg);
  color: var(--ink);
}

.login-panel {
  width: min(520px, 100%);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow);
  padding: 24px;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
}
.login-brand h1 { margin: 0; font-size: 20px; letter-spacing: 0; }
.login-brand p  { margin: 4px 0 0; color: var(--ink-3); font-size: 12px; }

.login-form { display: grid; gap: 16px; }

.login-form label {
  display: grid;
  gap: 7px;
  color: var(--ink-3);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.login-form input {
  height: 36px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--ink);
  padding: 0 10px;
  font-size: 13px;
}

.login-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.login-demo-hint {
  margin: 0;
  color: var(--ink-3);
  font-size: 11px;
  text-align: center;
}

.login-error {
  padding: 9px 10px;
  border: 1px solid color-mix(in srgb, var(--red) 40%, var(--line));
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--red) 10%, var(--surface));
  color: var(--red);
  font-size: 12px;
  text-transform: none;
  letter-spacing: 0;
}

</style>
