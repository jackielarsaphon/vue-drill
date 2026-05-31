import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/user-access',
  },
  {
    path: '/data-entry',
    name: 'DataEntry',
    component: () => import('../pages/DataEntryPage.vue'),
    meta: { roles: ['admin'] },
  },
  {
    path: '/user-access',
    name: 'UserAccess',
    component: () => import('../pages/UserAccessPage.vue'),
    meta: { roles: ['manager'] },
  },
  {
    path: '/daily-progress',
    name: 'DailyProgress',
    component: () => import('../components/StepDailyProgress.vue'),
    meta: { roles: ['admin'] },
  },
  {
    path: '/rigs',
    name: 'Rigs',
    component: () => import('../pages/RigPage.vue'),
    meta: { roles: ['admin'] },
  },
  {
    path: '/operators',
    name: 'Operators',
    component: () => import('../pages/OperatorPage.vue'),
    meta: { roles: ['admin'] },
  },
  {
    path: '/plan-review',
    name: 'PlanReview',
    component: () => import('../pages/PlanReviewPage.vue'),
    meta: { roles: ['admin', 'manager'] },
  },
  {
    path: '/dashboards',
    name: 'Dashboards',
    component: () => import('../pages/DashboardPage.vue'),
    meta: { roles: ['admin', 'manager'] },
  },
  {
    path: '/fuel-data',
    name: 'FuelData',
    component: () => import('../pages/FuelDataPage.vue'),
    meta: { roles: ['admin'] },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
