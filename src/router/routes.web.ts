import type { RouteRecordRaw } from 'vue-router'
import { APP_STORE_LINKS } from '@/config/app'
import { detectMobilePlatform } from '@/utils/appStore'

const PublicLayout = () => import('@/layouts/PublicLayout.vue')
const AuthLayout = () => import('@/layouts/AuthLayout.vue')

export const webRoutes: RouteRecordRaw[] = [
  {
    path: '/auth',
    component: AuthLayout,
    meta: { guestOnly: true, layout: 'auth' },
    children: [
      { path: '', redirect: { name: 'auth.login' } },
      { path: 'login', name: 'auth.login', component: () => import('@/pages/auth/LoginPage.vue'), meta: { title: 'Log in' } },
      { path: 'login/email', name: 'auth.login-email', component: () => import('@/pages/auth/LoginEmailPage.vue'), meta: { title: 'Log in' } },
      { path: 'signup', name: 'auth.signup', component: () => import('@/pages/auth/SignupPage.vue'), meta: { title: 'Create account' } },
      { path: 'verify-email', name: 'auth.verify-email', component: () => import('@/pages/auth/VerifyEmailPage.vue'), meta: { title: 'Verify your email', guestOnly: false } },
      { path: 'profile-setup', name: 'auth.profile-setup', component: () => import('@/pages/auth/ProfileSetupPage.vue'), meta: { title: 'Set up your profile', guestOnly: false, requiresAuth: true } },
      { path: 'interests', name: 'auth.interests', component: () => import('@/pages/auth/InterestsPage.vue'), meta: { title: 'Your interests', guestOnly: false, requiresAuth: true } },
      { path: 'forgot-password', name: 'auth.forgot-password', component: () => import('@/pages/auth/ForgotPasswordPage.vue'), meta: { title: 'Forgot password' } },
      { path: 'reset-password', name: 'auth.reset-password', component: () => import('@/pages/auth/ResetPasswordPage.vue'), meta: { title: 'Reset password' } },
      // Google redirect-flow callback (GET /auth/google/redirect sends people back here). Open to signed-in users so a refresh doesn't bounce.
      { path: 'google/callback', name: 'auth.google-callback', component: () => import('@/pages/auth/GoogleCallbackPage.vue'), meta: { title: 'Signing in with Google', guestOnly: false } },
    ],
  },
  {
    path: '/',
    component: PublicLayout,
    children: [
      { path: '', name: 'home', component: () => import('@/pages/HomePage.vue'), meta: { title: 'Discover events' } },
      // Target of the footer QR code: phones go straight to their store; desktops land on the download card.
      { path: 'app', name: 'app', redirect: () => { const platform = detectMobilePlatform(); if (platform) window.location.replace(APP_STORE_LINKS[platform]); return { name: 'home', hash: '#get-the-app' } } },
      { path: 'events', name: 'events', component: () => import('@/pages/events/EventsPage.vue'), meta: { title: 'Events' } },
      { path: 'events/:slug', name: 'event', component: () => import('@/pages/events/EventDetailPage.vue'), meta: { title: 'Event' } },
      { path: 'vendors', name: 'vendors', component: () => import('@/pages/vendors/VendorsPage.vue'), meta: { title: 'Hire Vendors' } },
      { path: 'vendors/:slug', name: 'vendor', component: () => import('@/pages/vendors/VendorProfilePage.vue'), meta: { title: 'Vendor', overlayHeader: true } },
      { path: 'works/:id', name: 'work', component: () => import('@/pages/vendors/WorkDetailPage.vue'), meta: { title: 'Work' } },
      { path: 'pricing', name: 'pricing', component: () => import('@/pages/PricingPage.vue'), meta: { title: 'Pricing' } },
      { path: 'about', name: 'about', component: () => import('@/pages/static/AboutPage.vue'), meta: { title: 'About us' } },
      { path: 'terms', name: 'terms', component: () => import('@/pages/static/LegalPage.vue'), props: { slug: 'terms' }, meta: { title: 'Terms and conditions' } },
      { path: 'privacy', name: 'privacy', component: () => import('@/pages/static/LegalPage.vue'), props: { slug: 'privacy' }, meta: { title: 'Privacy policy' } },
      { path: 'faqs', name: 'faqs', component: () => import('@/pages/static/FaqsPage.vue'), meta: { title: 'FAQs' } },
      { path: 'help', name: 'help', component: () => import('@/pages/static/HelpPage.vue'), meta: { title: 'Help center' } },
      { path: 'contact', redirect: { name: 'help' } },
      { path: 'c/join/:code', name: 'community.join', component: () => import('@/pages/community/JoinCommunityPage.vue'), meta: { requiresAuth: true, title: 'Join community' } },

      /* ---- authenticated ---- */
      { path: 'tickets', name: 'tickets', component: () => import('@/pages/tickets/MyTicketsPage.vue'), meta: { requiresAuth: true, title: 'My Tickets', textured: true } },
      { path: 'tickets/:id', name: 'ticket', component: () => import('@/pages/tickets/MyTicketsPage.vue'), meta: { requiresAuth: true, title: 'Ticket details', textured: true } },
      { path: 'checkout/mock-gateway', name: 'checkout.gateway', component: () => import('@/pages/checkout/MockGatewayPage.vue'), meta: { requiresAuth: true, title: 'Payment' } },
      { path: 'checkout/return', name: 'checkout.return', component: () => import('@/pages/checkout/PaymentReturnPage.vue'), meta: { requiresAuth: true, title: 'Confirming payment' } },
      { path: 'saved', name: 'saved', component: () => import('@/pages/saved/SavedEventsPage.vue'), meta: { requiresAuth: true, title: 'Saved Events', textured: true } },
      { path: 'saved/vendors', name: 'saved.vendors', component: () => import('@/pages/saved/SavedVendorsPage.vue'), meta: { requiresAuth: true, title: 'Saved vendors', textured: true } },
      { path: 'messages/:id?', name: 'messages', component: () => import('@/pages/messages/MessagesPage.vue'), meta: { requiresAuth: true, title: 'Messages', textured: true } },
      { path: 'communities/:id/live', name: 'community.live', component: () => import('@/pages/community/LivePage.vue'), meta: { requiresAuth: true, title: 'Live', hideFooter: true } },
      { path: 'wallet', name: 'wallet', component: () => import('@/pages/wallet/WalletPage.vue'), meta: { requiresAuth: true, title: 'My Wallet', textured: true } },
      { path: 'premium', name: 'premium', component: () => import('@/pages/PremiumPage.vue'), meta: { requiresAuth: true, title: 'Premium', textured: true } },
      { path: 'earn', name: 'earn', component: () => import('@/pages/earn/EarnPage.vue'), meta: { requiresAuth: true, title: 'Earn with Wedpluz', textured: true } },
      { path: 'earn/:id', name: 'earn.detail', component: () => import('@/pages/earn/PromotionDetailPage.vue'), meta: { requiresAuth: true, title: 'Promoted event', textured: true } },
      { path: 'profile', name: 'profile', component: () => import('@/pages/profile/ProfilePage.vue'), meta: { requiresAuth: true, title: 'My Profile' } },
      { path: 'u/:id', name: 'user', component: () => import('@/pages/profile/PublicProfilePage.vue'), meta: { title: 'Profile' } },
      {
        path: 'settings',
        component: () => import('@/pages/settings/SettingsLayout.vue'),
        meta: { requiresAuth: true, textured: true },
        children: [
          { path: '', name: 'settings', redirect: { name: 'settings.account' } },
          { path: 'account', name: 'settings.account', component: () => import('@/pages/settings/AccountPage.vue'), meta: { title: 'Account' } },
          { path: 'business', name: 'settings.business', component: () => import('@/pages/settings/BusinessAccountPage.vue'), meta: { title: 'Business Account' } },
          { path: 'privacy', name: 'settings.privacy', component: () => import('@/pages/settings/PrivacyPage.vue'), meta: { title: 'Privacy settings' } },
          { path: 'notifications', name: 'settings.notifications', component: () => import('@/pages/settings/NotificationSettingsPage.vue'), meta: { title: 'Notifications' } },
          { path: 'help', name: 'settings.help', component: () => import('@/pages/settings/GetHelpPage.vue'), meta: { title: 'Get Help' } },
          { path: 'language', name: 'settings.language', component: () => import('@/pages/settings/LanguagePage.vue'), meta: { title: 'Language' } },
          { path: 'about', name: 'settings.about', component: () => import('@/pages/settings/AboutPage.vue'), meta: { title: 'About Wedpluz' } },
          { path: 'sessions', name: 'settings.sessions', component: () => import('@/pages/settings/SessionsPage.vue'), meta: { title: 'Sessions' } },
        ],
      },
      { path: 'business/become-a-vendor', name: 'business.create', component: () => import('@/pages/business/BecomeVendorPage.vue'), meta: { requiresAuth: true, title: 'Become a Vendor', textured: true } },
      { path: 'business', name: 'business', component: () => import('@/pages/business/MyBusinessPage.vue'), meta: { requiresAuth: true, title: 'My business' } },
      { path: 'business/works/new', name: 'business.work.new', component: () => import('@/pages/business/WorkEditorPage.vue'), meta: { requiresAuth: true, title: 'Add work', textured: true } },
      { path: 'business/works/:id/edit', name: 'business.work.edit', component: () => import('@/pages/business/WorkEditorPage.vue'), meta: { requiresAuth: true, title: 'Edit work', textured: true } },
      { path: 'planner', name: 'planner', component: () => import('@/pages/planner/PlannerPage.vue'), meta: { requiresAuth: true, title: 'Pluz planner' } },
      { path: 'planner/chats/:id', name: 'planner.chat', component: () => import('@/pages/planner/PlannerPage.vue'), meta: { requiresAuth: true, title: 'Pluz planner' } },
      { path: 'planner/assets', name: 'planner.assets', component: () => import('@/pages/planner/PlannerAssetsPage.vue'), meta: { requiresAuth: true, title: 'Assets' } },
      { path: 'planner/menus/:id?', name: 'planner.menu', component: () => import('@/pages/planner/MenuBuilderPage.vue'), meta: { requiresAuth: true, title: 'Create menu' } },
      { path: 'planner/hall-layouts/:id?', name: 'planner.hall', component: () => import('@/pages/planner/HallLayoutPage.vue'), meta: { requiresAuth: true, title: 'Hall layout', hideFooter: true } },
      { path: 'planner/design/:type', name: 'planner.design', component: () => import('@/pages/planner/DesignGeneratorPage.vue'), meta: { requiresAuth: true, title: 'Design' } },

      /* ---- organizer ---- */
      { path: 'manage/events', name: 'manage.events', component: () => import('@/pages/manage/MyEventsPage.vue'), meta: { requiresAuth: true, title: 'My Events' } },
      { path: 'manage/events/new', name: 'manage.create', component: () => import('@/pages/manage/CreateEventPage.vue'), meta: { requiresAuth: true, title: 'Create an Event' } },
      { path: 'manage/events/:id/edit', name: 'manage.edit', component: () => import('@/pages/manage/CreateEventPage.vue'), meta: { requiresAuth: true, title: 'Edit event' } },
      {
        path: 'manage/events/:id',
        component: () => import('@/pages/manage/ManageEventLayout.vue'),
        meta: { requiresAuth: true },
        children: [
          { path: '', name: 'manage.overview', component: () => import('@/pages/manage/ManageOverviewPage.vue'), meta: { title: 'Manage Event' } },
          { path: 'tasks', name: 'manage.tasks', component: () => import('@/pages/manage/ManageTasksPage.vue'), meta: { title: 'Tasks' } },
          { path: 'vendors', name: 'manage.vendors', component: () => import('@/pages/manage/ManageVendorsPage.vue'), meta: { title: 'Vendors' } },
          { path: 'guests', name: 'manage.guests', component: () => import('@/pages/manage/ManageGuestsPage.vue'), meta: { title: 'Guests' } },
          { path: 'managers', name: 'manage.managers', component: () => import('@/pages/manage/ManageManagersPage.vue'), meta: { title: 'Managers' } },
        ],
      },
      { path: 'manage/events/:id/tickets', name: 'manage.tickets', component: () => import('@/pages/manage/ManageTicketsPage.vue'), meta: { requiresAuth: true, title: 'Tickets' } },
      { path: 'manage/events/:id/checklist', name: 'manage.checklist', component: () => import('@/pages/manage/ChecklistPage.vue'), meta: { requiresAuth: true, title: 'Checklist', hideFooter: true } },
      { path: 'manage/events/:id/assets', name: 'manage.assets', component: () => import('@/pages/manage/ManageAssetsPage.vue'), meta: { requiresAuth: true, title: 'Event Assets' } },
      { path: 'manage/events/:id/collaborators', name: 'manage.collaborators', component: () => import('@/pages/manage/CollaboratorsPage.vue'), meta: { requiresAuth: true, title: 'Collaborators' } },
      { path: 'manage/events/:id/activity', name: 'manage.activity', component: () => import('@/pages/manage/ActivityLogPage.vue'), meta: { requiresAuth: true, title: 'Activity log' } },
      { path: 'manage/events/:id/promoters', name: 'manage.promoters', component: () => import('@/pages/manage/PromotersBoardPage.vue'), meta: { requiresAuth: true, title: 'Promoters board' } },

      { path: ':pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue'), meta: { title: 'Page not found' } },
    ],
  },
]
