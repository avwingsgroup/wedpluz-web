import type { RouteLocationRaw } from 'vue-router'

// Curated help content shared by the FAQs page and the Help center. Figures (refund window, settlement delay,
// withdrawal limits, deletion grace) mirror the defaults in docs/backend-handoff/business-rules.md; if product
// changes them in Platform Configuration, update the copy here too. A CMS "faqs" page that has real content
// (see utils/cmsContent.ts) replaces these answers on the FAQs page.

export type FaqTopicId = 'getting-started' | 'tickets' | 'refunds' | 'organisers' | 'vendors' | 'wallet' | 'account'

export interface FaqLink {
  label: string
  to: RouteLocationRaw
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  links?: FaqLink[]
  /** Shown first in the Help center's "Popular questions". */
  popular?: boolean
}

export interface FaqTopic {
  id: FaqTopicId | string
  title: string
  description: string
  icon: 'sparkles' | 'ticket' | 'refund' | 'calendar' | 'store' | 'wallet' | 'shield'
  items: FaqItem[]
}

export const FAQ_TOPICS: FaqTopic[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    description: 'What Wedpluz is and how to set up your account.',
    icon: 'sparkles',
    items: [
      {
        id: 'what-is-wedpluz',
        question: 'What is Wedpluz?',
        answer:
          'Wedpluz is one place for life’s special moments. You can discover events near you, buy digital tickets, hire trusted vendors such as photographers, caterers and planners, and join each event’s community. Organisers use Wedpluz to publish events, sell tickets, manage guests and get paid.',
      },
      {
        id: 'is-wedpluz-free',
        question: 'Is Wedpluz free to use?',
        answer:
          'Creating an account, browsing events and vendors, and attending free events cost nothing. Paid tickets include a small service fee that is shown at checkout before you pay. Vendors and organisers can upgrade to a Premium plan for extra visibility and tools.',
        links: [{ label: 'See plans', to: { name: 'pricing' } }],
      },
      {
        id: 'individuals-vs-businesses',
        question: 'What is the difference between “For Individuals” and “For Businesses”?',
        answer:
          'It changes what Wedpluz shows you first. “For Individuals” focuses on finding events and vendors. “For Businesses” focuses on running a vendor profile and managing the events you organise. You can switch at any time from the header; it is the same account.',
      },
      {
        id: 'create-account',
        question: 'How do I create an account?',
        answer:
          'Select Sign up and continue with your email or Google account. We will send a code to verify your email, then ask a few profile questions and your interests so we can recommend relevant events.',
        links: [{ label: 'Create an account', to: { name: 'auth.signup' } }],
      },
    ],
  },
  {
    id: 'tickets',
    title: 'Tickets & payments',
    description: 'Buying tickets, paying safely and getting in on the day.',
    icon: 'ticket',
    items: [
      {
        id: 'get-my-ticket',
        question: 'Where do I find my ticket after paying?',
        answer:
          'As soon as your payment is confirmed, your ticket appears under My Tickets and is emailed to you with its QR code. Show the QR code at the entrance, either on your phone or printed.',
        links: [{ label: 'Open My Tickets', to: { name: 'tickets' } }],
        popular: true,
      },
      {
        id: 'payment-methods',
        question: 'Which payment methods can I use?',
        answer:
          'You can pay by card, bank transfer or USSD through our licensed payment partners, or with your Wedpluz wallet balance. Card details are entered on the partner’s secure page; Wedpluz never sees or stores your full card number.',
      },
      {
        id: 'charged-no-ticket',
        question: 'I was charged but I don’t have a ticket. What should I do?',
        answer:
          'Most payments are confirmed within a few minutes, so check My Tickets and your email (including spam) first. If there is still no ticket after 30 minutes, contact support with your payment reference or bank narration. If a payment cannot be matched to a ticket, it is reversed to your original payment method.',
        links: [{ label: 'Contact support', to: { name: 'help', hash: '#contact' } }],
        popular: true,
      },
      {
        id: 'service-fee',
        question: 'What is the service fee?',
        answer:
          'The service fee covers secure payment processing and keeping Wedpluz running. It is shown as a separate line at checkout, so you always see the full price before paying.',
      },
      {
        id: 'transfer-ticket',
        question: 'Can I give my ticket to someone else?',
        answer:
          'Where the organiser allows transfers, open the ticket and choose Transfer before the event starts. The recipient gets a new ticket by email and your original QR code stops working, so only share tickets through Wedpluz.',
      },
      {
        id: 'approval-required',
        question: 'Why does an event say “Approval required”?',
        answer:
          'Some organisers review guests before confirming them. Send a request to attend from the event page; you will be notified as soon as the host accepts or declines.',
      },
    ],
  },
  {
    id: 'refunds',
    title: 'Cancellations & refunds',
    description: 'Cancelling a ticket and what happens when events change.',
    icon: 'refund',
    items: [
      {
        id: 'cancel-ticket',
        question: 'How do I cancel a ticket?',
        answer:
          'Open the ticket in My Tickets and select Cancel ticket. Cancelling applies to the whole order, so every ticket bought in that checkout is cancelled together. Tickets that have already been scanned at the event cannot be cancelled.',
        links: [{ label: 'Open My Tickets', to: { name: 'tickets' } }],
        popular: true,
      },
      {
        id: 'refund-eligibility',
        question: 'Will I get a refund if I cancel?',
        answer:
          'If you cancel more than 48 hours before the event starts, you get the ticket price (and any food add-ons) back; the service fee is not refundable. Inside the last 48 hours you can still cancel to free up your place, but it is not refunded unless the organiser has made the event always refundable. We always show the amount before you confirm.',
        popular: true,
      },
      {
        id: 'event-cancelled',
        question: 'What happens if the organiser cancels the event?',
        answer:
          'You receive a full refund, including the service fee, automatically. There is nothing you need to do; we notify you by email and in the app when the refund starts.',
      },
      {
        id: 'refund-timing',
        question: 'How long does a refund take?',
        answer:
          'Refunds go back to the method you paid with. Wallet refunds are instant once processed; card and bank refunds usually arrive within 5–10 working days depending on your bank. You can follow the status on the ticket.',
      },
    ],
  },
  {
    id: 'organisers',
    title: 'Organising events',
    description: 'Publishing events, selling tickets and getting paid.',
    icon: 'calendar',
    items: [
      {
        id: 'create-event',
        question: 'How do I create and publish an event?',
        answer:
          'Select Create event, add the details, schedule, venue or online link, and your ticket types, then publish. New events are reviewed by our team before they go live so attendees only see genuine events; you will be notified once yours is approved.',
        links: [{ label: 'Create an event', to: { name: 'manage.create' } }],
        popular: true,
      },
      {
        id: 'organiser-payouts',
        question: 'When do I get paid for ticket sales?',
        answer:
          'Ticket revenue is settled per event. A settlement becomes ready 3 days after your event ends, provided there are no open disputes on its orders, and is then paid to your verified bank account. Commissions, promoter rewards and any fees you chose to absorb are deducted and itemised.',
      },
      {
        id: 'check-in',
        question: 'How do I check guests in?',
        answer:
          'Open your event in Manage Event and use check-in to scan each guest’s QR code. Every scan is verified by our servers, so duplicated, transferred or cancelled tickets are rejected instantly. You can also add managers to scan at the door.',
      },
      {
        id: 'promote-event',
        question: 'What is event promotion?',
        answer:
          'You can let other Wedpluz users promote your event in return for a commission on the paid tickets they sell. Promoters share their link; their commission is only paid once your event settles, and it is reversed if the order is refunded.',
        links: [{ label: 'Earn with Wedpluz', to: { name: 'earn' } }],
      },
    ],
  },
  {
    id: 'vendors',
    title: 'Vendors & businesses',
    description: 'Hiring vendors and running a vendor profile.',
    icon: 'store',
    items: [
      {
        id: 'hire-vendor',
        question: 'How do I hire a vendor?',
        answer:
          'Browse Hire Vendors by category, location and rating, look through their works and reviews, then select Get in Touch to message them directly. Agree the details, price and payment terms with the vendor in the chat before you book.',
        links: [{ label: 'Hire vendors', to: { name: 'vendors' } }],
        popular: true,
      },
      {
        id: 'become-vendor',
        question: 'How do I become a vendor on Wedpluz?',
        answer:
          'Switch to “For Businesses” and select Register your work. Add your business details, category, location and portfolio. Our team verifies new profiles before they appear in search, and verified vendors show a green badge.',
        links: [{ label: 'Register your work', to: { name: 'business.create' } }],
      },
      {
        id: 'vendor-reviews',
        question: 'Can I review a vendor?',
        answer:
          'Yes. You can leave one rating and review per vendor and edit or delete it later. Reviews must describe a genuine experience; reviews that are abusive or misleading are removed.',
      },
    ],
  },
  {
    id: 'wallet',
    title: 'Wallet & earnings',
    description: 'Your balance, withdrawals and promotion earnings.',
    icon: 'wallet',
    items: [
      {
        id: 'wallet-what',
        question: 'What is the Wedpluz wallet?',
        answer:
          'Your wallet holds refunds paid to wallet, promotion earnings and any money you add. You can use it to pay for tickets or withdraw to your bank. Activating the wallet requires a one-time code and a 4-digit PIN.',
        links: [{ label: 'Open wallet', to: { name: 'wallet' } }],
      },
      {
        id: 'withdraw',
        question: 'How do I withdraw money?',
        answer:
          'Add a Nigerian bank account (the account name is confirmed with your bank automatically), then request a withdrawal of at least ₦1,000. Withdrawals are processed by our payment partners and usually arrive the same day.',
      },
      {
        id: 'pending-balance',
        question: 'Why is part of my balance pending?',
        answer:
          'Promotion earnings stay pending until the promoted event has settled, and bank top-ups stay pending until the payment is confirmed. Pending amounts move to your available balance automatically.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account, privacy & safety',
    description: 'Security, your data and staying safe.',
    icon: 'shield',
    items: [
      {
        id: 'reset-password',
        question: 'I forgot my password. How do I reset it?',
        answer: 'Select Forgot password on the log in page and enter your email. We will send you a link to choose a new password.',
        links: [{ label: 'Reset password', to: { name: 'auth.forgot-password' } }],
      },
      {
        id: 'verify-identity',
        question: 'Why do you ask me to verify my identity?',
        answer:
          'Identity verification protects buyers and keeps payouts safe. Organisers and vendors who receive money verify with a government ID and a selfie. We keep only what we need to confirm the check, never full ID records.',
      },
      {
        id: 'scam-safety',
        question: 'How do I stay safe from scams?',
        answer:
          'Only pay for tickets through Wedpluz checkout, never by direct transfer to someone you met online. Wedpluz staff will never ask for your password, wallet PIN or one-time codes. Report suspicious profiles, events or messages from the “More” menu so our team can review them.',
        popular: true,
      },
      {
        id: 'delete-account',
        question: 'How do I delete my account?',
        answer:
          'Go to Settings → Account → Delete account. Your account is deactivated straight away and permanently deleted after 30 days; signing in during that time lets you cancel. You need to withdraw any wallet balance and finish events you are organising first.',
        links: [{ label: 'Account settings', to: { name: 'settings.account' } }],
      },
    ],
  },
]

/** Topics shown as cards in the Help center (same ids as FAQ_TOPICS). */
export const allFaqItems = (topics: FaqTopic[] = FAQ_TOPICS) => topics.flatMap((t) => t.items.map((item) => ({ ...item, topic: t })))
