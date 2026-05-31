<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">
          {{ which === 'mgmt' ? 'Management Dashboard' : which === 'ops' ? 'Operations Dashboard' : 'Fuel Dashboard' }}
        </h1>
        <p class="page-sub">
          {{
            which === 'mgmt'
              ? 'Plan completion against the LXML weekly target. Risk grouped by pit.'
              : which === 'ops'
              ? 'Daily drilling output, rig utilisation, and operator performance.'
              : 'Fuel consumption by rig and shift for the current week.'
          }}
        </p>
      </div>
      <div class="seg">
        <button
          type="button"
          :data-active="which === 'mgmt' ? 'true' : undefined"
          @click="setWhich('mgmt')"
        >
          Management
        </button>
        <button
          type="button"
          :data-active="which === 'ops' ? 'true' : undefined"
          @click="setWhich('ops')"
        >
          Operations
        </button>
        <button
          type="button"
          :data-active="which === 'fuel' ? 'true' : undefined"
          @click="setWhich('fuel')"
        >
          Fuel
        </button>
      </div>
    </div>
    <Management v-if="which === 'mgmt'" key="mgmt" :week="week" />
    <Operations v-else-if="which === 'ops'" key="ops" :week="week" />
    <FuelDashboard v-else-if="which === 'fuel'" key="fuel" :week="week" />
  </div>
</template>

<script setup>
import Management from '../components/dashboard/Management.vue';
import Operations from '../components/dashboard/Operations.vue';
import FuelDashboard from '../components/dashboard/FuelDashboard.vue';

const props = defineProps({
  which: { type: String, default: 'mgmt' },
  week: { type: Object, required: true },
});

const emit = defineEmits(['update:which']);

function setWhich(v) {
  emit('update:which', v);
}
</script>
