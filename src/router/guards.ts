import type { Router } from 'vue-router'
import { APP_NAME } from '@/config/app'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminStore } from '@/stores/admin.store'
import { useUiStore } from '@/stores/ui.store'

export function installGuards(router: Router): void {
  router.beforeEach(async (to) => {
    const isAdminRoute = to.matched.some((r) => r.meta.admin)

    if (isAdminRoute) {
      const admin = useAdminStore()
      await admin.bootstrap()
      const isLogin = to.name === 'admin.login'
      if (!admin.isAuthenticated && !isLogin) {
        return { name: 'admin.login', query: { redirect: to.fullPath } }
      }
      if (admin.isAuthenticated && isLogin) return { name: 'admin.dashboard' }
      const required = to.matched.flatMap((r) => r.meta.permissions ?? [])
      if (required.length && !admin.can(...required)) {
        useUiStore().error('You do not have access to that module.')
        return { name: 'admin.dashboard' }
      }
      return true
    }

    const auth = useAuthStore()
    await auth.bootstrap()

    const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)
    const guestOnly = to.matched.some((r) => r.meta.guestOnly)
    const roles = to.matched.flatMap((r) => r.meta.roles ?? [])

    if (requiresAuth && !auth.isAuthenticated) {
      auth.redirectAfterLogin = to.fullPath
      return { name: 'auth.login', query: { redirect: to.fullPath } }
    }
    if (guestOnly && auth.isAuthenticated && !auth.pendingStep) {
      return (to.query.redirect as string) || { name: 'home' }
    }
    // Onboarding gate: a logged-in user with an unfinished step is sent to it (except on auth pages).
    if (auth.isAuthenticated && auth.pendingStep && !to.path.startsWith('/auth')) {
      const stepRoute = { verify_email: 'auth.verify-email', profile_setup: 'auth.profile-setup', interests: 'auth.interests' }[auth.pendingStep]
      if (stepRoute) return { name: stepRoute }
    }
    if (roles.length && !roles.some((r) => auth.hasRole(r))) {
      useUiStore().error('That area is only available to ' + roles.join(' / ') + ' accounts.')
      return { name: 'home' }
    }
    return true
  })

  router.afterEach((to) => {
    const title = to.meta.title
    document.title = title ? `${title} | ${APP_NAME}` : APP_NAME
    useUiStore().mobileNavOpen = false
  })

  router.onError((error) => {
    // Stale chunk after a deployment: reload once to fetch the new asset manifest.
    if (/Failed to fetch dynamically imported module|Importing a module script failed/.test(String(error))) {
      const key = 'wp.chunk-reload'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        window.location.reload()
      }
    }
  })
}
