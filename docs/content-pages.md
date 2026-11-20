# Content pages

About us, Terms and conditions, Privacy policy, FAQs and Help center are public pages built for reading and self-service. This note explains where their content comes from and how to change it.

## Where the content comes from

| Page | Route | Content source |
|---|---|---|
| About us | `/about` | Layout and sections live in the app. The "Our mission" story comes from the `about` CMS page once it has real content. |
| Terms and conditions | `/terms` | The `terms` CMS page. Until that page has real content, the built-in draft in `src/content/legal.ts` is shown. |
| Privacy policy | `/privacy` | The `privacy` CMS page. Until that page has real content, the built-in draft in `src/content/legal.ts` is shown. |
| FAQs | `/faqs` | The `faqs` CMS page, parsed into topics. Until that page has at least three questions, the curated set in `src/content/faqs.ts` is shown. |
| Help center | `/help` | The curated FAQ set (topics, popular questions and search), contact details from `GET /config` (`support.email`, `support.phone`, `support.whatsapp`), and support requests through `/support/tickets`. |

A CMS page counts as "real content" when it has at least 400 characters of text (200 for the About story); see `isAuthoredCms` in `src/utils/cmsContent.ts`. A seeded one-line placeholder such as "Terms and conditions content is managed by the Wedpluz team" therefore never replaces the built-in text.

## Before launch: legal review

The built-in Terms and Privacy texts are **drafts for legal review**. They describe how Wedpluz works today, including:

- the refund window and non-refundable service fee;
- the 3-day settlement delay;
- the 30-day account deletion grace period;
- the payment, messaging, storage and identity providers;
- the NDPA.

They are not legal advice. Before launch, have counsel review them and publish the approved text in the admin console (Content → Pages, `PUT /admin/pages/{slug}`). The pages switch to the CMS version automatically and show its `updatedAt` as "Last updated".

If product changes a platform setting, update the copy in `src/content/faqs.ts` and `src/content/legal.ts`. Settings to watch: the refund window, settlement delay, withdrawal limits and deletion grace. Defaults are in [business-rules.md](backend-handoff/business-rules.md).

## Writing CMS content

The frontend sanitises CMS HTML before rendering it. It allows `p`, `br`, `strong`, `b`, `em`, `i`, `u`, `ul`, `ol`, `li`, `blockquote`, `h2`, `h3`, `h4` and `a`.

Links may use `https:`, `mailto:` or a same-site path such as `/privacy` or `/help#contact`. Same-site links open inside the app. External links open in a new tab with `rel="noopener noreferrer nofollow"`.

- **Terms and Privacy.** Use `h2` for numbered sections, such as `<h2>5. Cancellations and refunds</h2>`, and `h3` for subsections. Each `h2` becomes an entry in the sticky "On this page" outline and a deep link (`/terms#5-cancellations-and-refunds`).
- **FAQs.** Use `h2` for a topic, `h3` for each question and paragraphs for the answer:

  ```html
  <h2>Tickets &amp; payments</h2>
  <h3>Where do I find my ticket after paying?</h3>
  <p>As soon as your payment is confirmed…</p>
  ```

  A document without `h2` headings becomes a single "General" topic. Each question gets a shareable link (`/faqs#where-do-i-find-my-ticket-after-paying`).
- **About.** Write two or three paragraphs telling the Wedpluz story. Everything else on the page is part of the design.

## UX features

- **Search.** FAQs and Help center search ignores accents and common words, and matches simple plurals. Results highlight the matched words. The FAQ query is kept in the URL (`/faqs?q=refund`) so it can be shared. Press `/` to focus search from anywhere on the page.
- **Help center suggestions.** Typing shows live suggestions as an accessible combobox (arrow keys, Enter, Escape). Enter goes to the full FAQ results.
- **Deep links.** `/faqs#<question>` opens and scrolls to that answer, and `/faqs#topic-<id>` jumps to a topic. Every answer has a "Copy link" button.
- **Legal pages.**
  - A plain-language "short version" (built-in text only).
  - Reading time.
  - A scroll-spy outline: a sticky sidebar on desktop and a collapsible list on phones.
  - A print-friendly layout ("Print or save as PDF" hides the header and footer).
- **Support.** Signed-in users send requests from the Help center and see their recent requests with a status. Guests are asked to log in, with email as a fallback.
- **SEO.** Every page emits breadcrumbs. FAQs and the Help center also emit `FAQPage` data, and About emits `Organization` data. Titles and descriptions come from `src/config/seo.ts`.
