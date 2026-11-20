import type { PermissionKey, UserRole } from '@/types'

export interface AppRouteMeta {
  title?: string
  /** Requires an authenticated web user. */
  requiresAuth?: boolean
  /** Redirect authenticated users away (login/signup pages). */
  guestOnly?: boolean
  /** Any of these roles grants access. */
  roles?: UserRole[]
  /** Admin area: requires an admin session with ALL listed permissions. */
  admin?: boolean
  permissions?: PermissionKey[]
  /** Hide the public footer (chat/planner full-height pages). */
  hideFooter?: boolean
  /** Show the textured band under the header like account/wallet designs. */
  textured?: boolean
  /** Float the header over a full-bleed cover (vendor profile design). */
  overlayHeader?: boolean
  layout?: 'public' | 'auth' | 'admin' | 'blank'
}

declare module 'vue-router' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RouteMeta extends AppRouteMeta {}
}
