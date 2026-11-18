import { createRouter, createWebHistory, type Router, type RouteRecordRaw } from 'vue-router'
import { webRoutes } from './routes.web'
import { adminRoutes } from './routes.admin'
import { installGuards } from './guards'

export function createAppRouter(): Router {
  // __APP_TARGET__ and import.meta.env.DEV are build-time constants, so unused route tables
  // (and every page they lazy-load) are tree-shaken:
  //  - admin build  → admin console only, mounted at "/" (admin.wedpluz.com)
  //  - web build    → public app only; the admin console is NOT shipped to wedpluz.com
  //  - dev server   → public app plus the console at /admin for convenience
  const routes: RouteRecordRaw[] = __APP_TARGET__ === 'admin'
    ? [adminRoutes('/'), { path: '/:pathMatch(.*)*', redirect: '/' }]
    : import.meta.env.DEV
      ? [...webRoutes, adminRoutes('/admin')]
      : webRoutes

  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior(to, from, saved) {
      if (saved) return saved
      if (to.hash) return { el: to.hash, behavior: 'smooth' }
      // Keep scroll position when only the query (filters/tabs) changes.
      if (to.path === from.path) return false
      return { top: 0 }
    },
  })

  installGuards(router)
  return router
}

export type { AppRouteMeta } from './meta'
