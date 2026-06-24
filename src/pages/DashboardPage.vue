<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">
          {{ which === 'mgmt' ? 'Management Dashboard' : which === 'ops' ? 'Operations Dashboard' : which === 'fuel' ? 'Fuel Dashboard' : which === 'daily' ? 'Daily Plan vs Actual' : 'Down Time Report' }}
        </h1>
        <p class="page-sub">
          {{
            which === 'mgmt'
              ? 'Plan completion against the LXML weekly target. Risk grouped by pit.'
              : which === 'ops'
              ? 'Daily drilling output, rig utilisation, and operator performance.'
              : which === 'fuel'
              ? 'Fuel consumption by rig and shift for the current week.'
              : which === 'daily'
              ? 'Planned daily targets vs actual drilling and blast volume for the week.'
              : 'สรุปข้อมูลเวลาหยุดทำงาน'
          }}
        </p>
      </div>
      <div class="seg">
        <button type="button" :data-active="which === 'mgmt' ? 'true' : undefined" @click="setWhich('mgmt')">Management</button>
        <button type="button" :data-active="which === 'ops' ? 'true' : undefined" @click="setWhich('ops')">Operations</button>
        <button type="button" :data-active="which === 'fuel' ? 'true' : undefined" @click="setWhich('fuel')">Fuel</button>
        <button type="button" :data-active="which === 'daily' ? 'true' : undefined" @click="setWhich('daily')">Daily Plan</button>
        <button type="button" :data-active="which === 'dt' ? 'true' : undefined" @click="setWhich('dt')">DT Report</button>
      </div>
    </div>
    <Management    v-if="which === 'mgmt'" key="mgmt" :week="week" />
    <Operations    v-else-if="which === 'ops'"  key="ops"  :week="week" />
    <FuelDashboard v-else-if="which === 'fuel'" key="fuel" :week="week" />
    <DailyPlanDashboard v-else-if="which === 'daily'" key="daily" :week="week" />
    <DownTimeReport v-else-if="which === 'dt'" key="dt" :week="week" />
  </div>
</template>

<script setup>
import Management    from '../components/dashboard/Management.vue';
import Operations    from '../components/dashboard/Operations.vue';
import FuelDashboard from '../components/dashboard/FuelDashboard.vue';
import DailyPlanDashboard from '../components/dashboard/DailyPlanDashboard.vue';
import DownTimeReport from './DownTimeReportPage.vue';

const props = defineProps({
  which: { type: String, default: 'mgmt' },
  week: { type: Object, required: true },
});

const emit = defineEmits(['update:which']);

function setWhich(v) {
  emit('update:which', v);
}
</script>
