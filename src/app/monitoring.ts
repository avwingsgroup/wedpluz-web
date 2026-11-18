import type { App } from 'vue'
import type { Router } from 'vue-router'
import * as Sentry from '@sentry/vue'
import { env } from '@/config/env'

export function installSentry(app: App, router: Router): void {
  Sentry.init({
    app,
    dsn: env.sentryDsn,
    environment: env.sentryEnvironment,
    release: `wedpluz-${env.appTarget}@${env.appVersion}`,
    integrations: [Sentry.browserTracingIntegration({ router })],
    tracesSampleRate: env.isProd ? 0.1 : 1.0,
    // PII is not sent by default; the Authorization header is stripped below.
    beforeSend(event) {
      if (event.request?.headers) delete event.request.headers.Authorization
      return event
    },
  })
}
