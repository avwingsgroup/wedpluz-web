import type { RouteRecordRaw } from 'vue-router'

/**
 * Admin dashboard routes. Mounted at "/" in the admin build and at "/admin" on the dev server
 * (https://admin.wedpluz.com). Every record carries `meta.admin` so the guard can enforce an
 * admin session and the listed permissions.
 */
export function adminRoutes(base: string): RouteRecordRaw {
  return {
    path: base,
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { admin: true, layout: 'admin' },
    children: [
      { path: 'login', name: 'admin.login', component: () => import('@/pages/admin/AdminLoginPage.vue'), meta: { title: 'Admin login', layout: 'blank' } },
      { path: '', name: 'admin.dashboard', component: () => import('@/pages/admin/DashboardPage.vue'), meta: { title: 'Dashboard', permissions: ['dashboard.view'] } },

      { path: 'users', name: 'admin.users', component: () => import('@/pages/admin/users/UsersPage.vue'), meta: { title: 'Users', permissions: ['users.view'] } },
      { path: 'users/deletion-requests', name: 'admin.users.deletions', component: () => import('@/pages/admin/users/DeletionRequestsPage.vue'), meta: { title: 'Deletion requests', permissions: ['users.view'] } },
      { path: 'users/:id', name: 'admin.user', component: () => import('@/pages/admin/users/UserDetailPage.vue'), meta: { title: 'User', permissions: ['users.view'] } },

      { path: 'events', name: 'admin.events', component: () => import('@/pages/admin/events/EventsPage.vue'), meta: { title: 'Events', permissions: ['events.view'] } },
      { path: 'events/categories', name: 'admin.categories', component: () => import('@/pages/admin/events/CategoriesPage.vue'), meta: { title: 'Categories', permissions: ['events.view'] } },
      { path: 'events/:id', name: 'admin.event', component: () => import('@/pages/admin/events/EventDetailPage.vue'), meta: { title: 'Event', permissions: ['events.view'] } },

      { path: 'organizers', name: 'admin.organizers', component: () => import('@/pages/admin/organizers/OrganizersPage.vue'), meta: { title: 'Organizers & Vendors', permissions: ['organizers.view'] } },
      { path: 'organizers/:id', name: 'admin.organizer', component: () => import('@/pages/admin/organizers/OrganizerDetailPage.vue'), meta: { title: 'Organizer', permissions: ['organizers.view'] } },

      { path: 'bookings', name: 'admin.bookings', component: () => import('@/pages/admin/bookings/BookingsPage.vue'), meta: { title: 'Bookings', permissions: ['bookings.view'] } },
      { path: 'bookings/disputes', name: 'admin.disputes', component: () => import('@/pages/admin/bookings/DisputesPage.vue'), meta: { title: 'Disputes', permissions: ['bookings.view'] } },
      { path: 'bookings/check-ins', name: 'admin.checkins', component: () => import('@/pages/admin/bookings/CheckInsPage.vue'), meta: { title: 'QR validations', permissions: ['bookings.view'] } },
      { path: 'bookings/inventory', name: 'admin.inventory', component: () => import('@/pages/admin/bookings/InventoryPage.vue'), meta: { title: 'Ticket inventory', permissions: ['bookings.view'] } },
      { path: 'bookings/:id', name: 'admin.booking', component: () => import('@/pages/admin/bookings/BookingDetailPage.vue'), meta: { title: 'Booking', permissions: ['bookings.view'] } },

      { path: 'finance', name: 'admin.finance', component: () => import('@/pages/admin/finance/FinanceOverviewPage.vue'), meta: { title: 'Finance', permissions: ['finance.view'] } },
      { path: 'finance/transactions', name: 'admin.transactions', component: () => import('@/pages/admin/finance/TransactionsPage.vue'), meta: { title: 'Transactions', permissions: ['finance.view'] } },
      { path: 'finance/settlements', name: 'admin.settlements', component: () => import('@/pages/admin/finance/SettlementsPage.vue'), meta: { title: 'Settlements', permissions: ['finance.settlements'] } },
      { path: 'finance/payouts', name: 'admin.payouts', component: () => import('@/pages/admin/finance/PayoutsPage.vue'), meta: { title: 'Payouts', permissions: ['finance.view'] } },
      { path: 'finance/refunds', name: 'admin.refunds', component: () => import('@/pages/admin/finance/RefundsPage.vue'), meta: { title: 'Refunds', permissions: ['refunds.view'] } },
      { path: 'finance/commissions', name: 'admin.commissions', component: () => import('@/pages/admin/finance/CommissionsPage.vue'), meta: { title: 'Commissions', permissions: ['finance.view'] } },
      { path: 'finance/gateways', name: 'admin.gateways', component: () => import('@/pages/admin/finance/GatewaysPage.vue'), meta: { title: 'Payment gateways', permissions: ['finance.view'] } },

      { path: 'moderation', name: 'admin.moderation', component: () => import('@/pages/admin/moderation/ReportsPage.vue'), meta: { title: 'Moderation', permissions: ['moderation.view'] } },
      { path: 'moderation/communities', name: 'admin.communities', component: () => import('@/pages/admin/moderation/CommunitiesPage.vue'), meta: { title: 'Communities', permissions: ['moderation.view'] } },
      { path: 'moderation/:id', name: 'admin.report', component: () => import('@/pages/admin/moderation/ReportDetailPage.vue'), meta: { title: 'Report', permissions: ['moderation.view'] } },

      { path: 'notifications', name: 'admin.campaigns', component: () => import('@/pages/admin/notifications/CampaignsPage.vue'), meta: { title: 'Campaigns', permissions: ['notifications.view'] } },
      { path: 'notifications/new', name: 'admin.campaign.new', component: () => import('@/pages/admin/notifications/CampaignEditorPage.vue'), meta: { title: 'New campaign', permissions: ['notifications.send'] } },
      { path: 'notifications/templates', name: 'admin.templates', component: () => import('@/pages/admin/notifications/TemplatesPage.vue'), meta: { title: 'Templates', permissions: ['notifications.view'] } },
      { path: 'notifications/:id', name: 'admin.campaign', component: () => import('@/pages/admin/notifications/CampaignDetailPage.vue'), meta: { title: 'Campaign', permissions: ['notifications.view'] } },

      { path: 'settings', name: 'admin.settings', component: () => import('@/pages/admin/settings/SettingsPage.vue'), meta: { title: 'Platform settings', permissions: ['settings.view'] } },
      { path: 'settings/banners', name: 'admin.banners', component: () => import('@/pages/admin/settings/BannersPage.vue'), meta: { title: 'Banners', permissions: ['settings.view'] } },
      { path: 'settings/content', name: 'admin.content', component: () => import('@/pages/admin/settings/ContentPage.vue'), meta: { title: 'Content pages', permissions: ['settings.view'] } },

      { path: 'access/roles', name: 'admin.roles', component: () => import('@/pages/admin/access/RolesPage.vue'), meta: { title: 'Roles & permissions', permissions: ['roles.manage'] } },
      { path: 'access/admins', name: 'admin.admins', component: () => import('@/pages/admin/access/AdminsPage.vue'), meta: { title: 'Administrators', permissions: ['roles.manage'] } },
      { path: 'access/audit', name: 'admin.audit', component: () => import('@/pages/admin/access/AuditLogsPage.vue'), meta: { title: 'Audit logs', permissions: ['audit.view'] } },
      { path: 'access/security', name: 'admin.security', component: () => import('@/pages/admin/access/SecurityLogsPage.vue'), meta: { title: 'Security logs', permissions: ['audit.view'] } },

      { path: 'reports', name: 'admin.reports', component: () => import('@/pages/admin/reports/ReportsPage.vue'), meta: { title: 'Reports & analytics', permissions: ['reports.view'] } },
      { path: 'support', name: 'admin.support', component: () => import('@/pages/admin/support/SupportPage.vue'), meta: { title: 'Support', permissions: ['support.view'] } },
      { path: 'support/:id', name: 'admin.support.ticket', component: () => import('@/pages/admin/support/SupportTicketPage.vue'), meta: { title: 'Support ticket', permissions: ['support.view'] } },

      { path: ':pathMatch(.*)*', redirect: { name: 'admin.dashboard' } },
    ],
  }
}
