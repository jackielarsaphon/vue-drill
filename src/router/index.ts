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
  {
    path: '/down-time',
    name: 'DownTime',
    component: () => import('../pages/DownTimePage.vue'),
    meta: { roles: ['admin'] },
  },
  {
    path: '/reason-codes',
    name: 'ReasonCodes',
    component: () => import('../pages/ReasonCodePage.vue'),
    meta: { roles: ['admin'] },
  },
]

const router = createRouter({
  history: createWebHistory('/vue-drill/'),
  routes,
})

const SESSION_KEY = 'tdl-demo-session'

router.beforeEach((to, _from, next) => {
  const allowedRoles = to.meta?.roles as string[] | undefined
  if (!allowedRoles || allowedRoles.length === 0) return next()

  let userRole = ''
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const session = JSON.parse(raw)
      userRole = session.role ?? ''
    }
  } catch { /* no session */ }

  if (userRole && allowedRoles.includes(userRole)) return next()

  const fallback = userRole === 'admin' ? '/data-entry' : '/dashboards'
  if (to.path !== fallback) return next(fallback)
  next()
})

export default router
