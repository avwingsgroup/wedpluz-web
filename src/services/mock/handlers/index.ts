import { registerAuthHandlers } from './auth'
import { registerAccountHandlers } from './account'
import { registerEventHandlers } from './events'
import { registerOrganizerHandlers } from './organizer'
import { registerTicketingHandlers } from './ticketing'
import { registerVendorHandlers } from './vendors'
import { registerCommunityHandlers } from './community'
import { registerMessagingHandlers } from './messaging'
import { registerNotificationHandlers } from './notifications'
import { registerWalletHandlers } from './wallet'
import { registerPlannerHandlers } from './planner'
import { registerAdminHandlers } from './admin'

/**
 * Registration order matters: more specific static routes (e.g. /events/featured)
 * are registered before parameterised ones (/events/:slug) inside each module.
 */
export function registerAllHandlers(): void {
  registerAuthHandlers()
  registerAccountHandlers()
  registerEventHandlers()
  registerTicketingHandlers()
  registerOrganizerHandlers()
  registerVendorHandlers()
  registerCommunityHandlers()
  registerMessagingHandlers()
  registerNotificationHandlers()
  registerWalletHandlers()
  registerPlannerHandlers()
  registerAdminHandlers()
}
