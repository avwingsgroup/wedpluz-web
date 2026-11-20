// Built-in Terms and Privacy documents.
//
// DRAFT FOR LEGAL REVIEW. These describe how Wedpluz actually works (see docs/backend-handoff/business-rules.md and
// integrations.md) so the pages are useful before launch, but they are not legal advice and must be reviewed by
// counsel. Publishing reviewed text in the admin console (Content → Pages) replaces them automatically: the pages
// prefer CMS content once it is authored (utils/cmsContent.ts → isAuthoredCms).
//
// `{{supportEmail}}` is replaced with the support address from the public config at render time.

export interface LegalDocumentContent {
  title: string
  /** ISO date the built-in text takes effect (shown as "Last updated" when the CMS has no real content). */
  updatedAt: string
  /** Plain-language key points shown above the full text. */
  summary: string[]
  html: string
}

export const TERMS: LegalDocumentContent = {
  title: 'Terms and conditions',
  updatedAt: '2026-11-20',
  summary: [
    'Wedpluz is a marketplace: organisers run their events and vendors provide their own services. We provide the platform, payments and support.',
    'Tickets are paid through our licensed payment partners. The service fee is shown before you pay.',
    'Cancel more than 48 hours before an event for a refund of the ticket price. If an organiser cancels, you get everything back.',
    'Organisers are paid 3 days after their event ends, once there are no open disputes.',
    'Be honest and respectful. We can remove content or suspend accounts that break these terms.',
  ],
  html: `
<h2>1. About these terms</h2>
<p>These terms and conditions (“Terms”) form an agreement between you and Wedpluz (“Wedpluz”, “we”, “us”) for your use of the Wedpluz website, mobile apps and related services (the “Platform”). By creating an account or using the Platform you agree to these Terms and to our <a href="/privacy">Privacy policy</a>. If you do not agree, please do not use the Platform.</p>
<p>We may update these Terms from time to time. When we make material changes we will tell you by email or in the app before they take effect. Continuing to use the Platform after that date means you accept the updated Terms.</p>

<h2>2. Who can use Wedpluz</h2>
<p>You must be at least 18 years old, or the age of majority where you live, to create an account, buy tickets or receive payments. Some events are restricted to adults and organisers may refuse entry to anyone who cannot prove their age.</p>
<p>You are responsible for keeping your login details, wallet PIN and one-time codes secret, and for everything done through your account. Tell us immediately at {{supportEmail}} if you think your account has been accessed without permission.</p>

<h2>3. Our role</h2>
<p>Wedpluz is a marketplace. Events are created and run by independent organisers, and services are provided by independent vendors. We are not the organiser of events listed by others, and we are not a party to agreements you make directly with a vendor. We review new events and vendor profiles to keep the Platform trustworthy, but we do not guarantee the quality, safety or legality of any event or service.</p>

<h2>4. Buying tickets</h2>
<h3>4.1 Prices and fees</h3>
<p>Ticket prices are set by organisers. A service fee may be added at checkout; the total you will pay is always shown before you confirm. Prices are in Nigerian naira unless stated otherwise.</p>
<h3>4.2 Payment</h3>
<p>Payments are processed by our licensed payment partners or from your Wedpluz wallet. A ticket is only issued once the payment partner confirms your payment. We never store your full card details.</p>
<h3>4.3 Using your ticket</h3>
<p>Each ticket has a unique QR code that can be scanned once. Do not share, copy or resell your QR code outside the Platform; a duplicated ticket may be refused at the door. Where an organiser allows it, you can transfer a ticket through the Platform before the event starts, which cancels the original code.</p>
<h3>4.4 Entry</h3>
<p>Organisers set and enforce their own entry conditions, such as age limits, dress codes, approval of guests and security checks. Organisers may refuse entry or remove guests who break those conditions or the law.</p>

<h2>5. Cancellations and refunds</h2>
<ul>
<li><strong>Your cancellation:</strong> you can cancel an order from My Tickets until it has been checked in. Cancelling applies to all tickets in that order.</li>
<li><strong>More than 48 hours before the event:</strong> we refund the ticket price and any food add-ons. The service fee is not refundable.</li>
<li><strong>Within 48 hours of the event:</strong> cancellation releases your place but is not refunded, unless the organiser has made the event always refundable.</li>
<li><strong>Free tickets:</strong> cancelling releases your place; there is nothing to refund.</li>
<li><strong>Cancelled events:</strong> if an organiser or Wedpluz cancels an event, you receive a full refund including the service fee, automatically.</li>
</ul>
<p>Refunds are returned to the original payment method or to your wallet if you paid with it. Bank processing times vary. The amount you will receive is always shown before you confirm a cancellation.</p>

<h2>6. Organising events</h2>
<p>If you publish an event you confirm that you have the right to hold it, that its details are accurate, and that you will comply with all laws, permits and safety requirements that apply. New events are reviewed before going live, and we may reject, suspend or remove events that are misleading, unsafe or unlawful.</p>
<p>You are responsible for delivering the event as described, for your refund promises to guests, and for anyone you add as a manager. If you cancel an event, your guests are refunded in full and the related fees may be deducted from your settlement.</p>
<h3>6.1 Settlements and payouts</h3>
<p>Ticket revenue is held until your event ends. A settlement becomes ready 3 days after the event ends if there are no open disputes or chargebacks, and is then paid to your verified bank account. Our commission, payment fees you chose to absorb, promoter commissions and any refunds are deducted and shown in your settlement statement. We may hold a settlement while we investigate complaints, chargebacks or suspected fraud.</p>

<h2>7. Vendors</h2>
<p>Vendors must give accurate information about their business, services, prices and availability, and only upload work they created or have permission to use. Agreements, payments and deliverables for vendor services are between you and the vendor unless the Platform states otherwise. Vendor profiles are verified before they appear in search, and we may remove profiles that receive credible complaints.</p>

<h2>8. Promotion and earnings</h2>
<p>When an organiser enables promotion, approved users may share the event and earn a commission on paid tickets sold through their link. Commissions stay pending until the event settles and are reversed if the order is refunded. Misleading promotion, spam or self-referral can lead to earnings being withheld.</p>

<h2>9. Wallet</h2>
<p>Your wallet can hold refunds, promotion earnings and top-ups, and can be used to pay on the Platform or withdrawn to a bank account in your name. Withdrawals are subject to minimum and maximum limits shown in the app. The wallet is not a bank account and does not earn interest. We may ask you to verify your identity before you can withdraw.</p>

<h2>10. Subscriptions</h2>
<p>Premium plans are billed in advance for the selected period and renew automatically unless you cancel before the renewal date. Cancelling stops future renewals; you keep the plan’s features until the end of the period you paid for. Plan prices and features are shown on the <a href="/pricing">Pricing</a> page.</p>

<h2>11. Your content and community rules</h2>
<p>You keep ownership of the photos, videos, messages, reviews and other content you post, and you give Wedpluz a non-exclusive, royalty-free licence to host, display and share it to operate and promote the Platform. You must not post content that is unlawful, hateful, harassing, sexually explicit, violent, fraudulent, infringes someone else’s rights, or contains malware or spam.</p>
<p>Anyone can report content or accounts from the app. We review reports and may remove content, warn users or suspend accounts. Removed content may be kept for 90 days so that decisions can be appealed.</p>

<h2>12. Prohibited use</h2>
<ul>
<li>Selling or advertising tickets for events outside the Platform’s checkout, or reselling tickets for profit where the organiser forbids it.</li>
<li>Asking other users to pay you directly to avoid the Platform’s payment protections.</li>
<li>Creating fake events, profiles or reviews, or impersonating anyone.</li>
<li>Scraping, reverse engineering or interfering with the Platform or its security.</li>
</ul>

<h2>13. Suspension and closing your account</h2>
<p>We may suspend or close accounts that break these Terms, put other users at risk, or where the law requires it. You can delete your account at any time from Settings; it is permanently deleted after a 30-day grace period. You may need to withdraw your wallet balance and complete events you organise before deletion can proceed.</p>

<h2>14. Liability</h2>
<p>The Platform is provided “as is”. To the extent permitted by law, Wedpluz is not liable for indirect or consequential losses, or for the acts, omissions, events or services of organisers, vendors or other users. Our total liability to you for any claim is limited to the fees you paid to Wedpluz in the 12 months before the claim. Nothing in these Terms limits liability that cannot be limited by law, including your rights under the Federal Competition and Consumer Protection Act.</p>

<h2>15. Governing law and disputes</h2>
<p>These Terms are governed by the laws of the Federal Republic of Nigeria. If you have a complaint, please contact us first at {{supportEmail}} so we can try to resolve it. Disputes that cannot be resolved informally will be settled by the courts of Nigeria.</p>

<h2>16. Contact</h2>
<p>Questions about these Terms? Email {{supportEmail}} or visit the <a href="/help">Help center</a>.</p>
`,
}

export const PRIVACY: LegalDocumentContent = {
  title: 'Privacy policy',
  updatedAt: '2026-11-20',
  summary: [
    'We collect what we need to run your account, sell and verify tickets, pay organisers and keep the Platform safe.',
    'We never sell your personal data, and we never see or store your full card number.',
    'Trusted providers process data for us, such as payments, email, SMS and media storage, under contract.',
    'You can access, correct, export or delete your data, and control notifications and privacy in Settings.',
    'We follow the Nigeria Data Protection Act 2023.',
  ],
  html: `
<h2>1. Who we are</h2>
<p>This policy explains how Wedpluz (“we”, “us”) collects, uses and protects personal data when you use the Wedpluz website, mobile apps and related services (the “Platform”). We are the data controller for the personal data described here. We process personal data in line with the Nigeria Data Protection Act 2023 (NDPA) and related regulations.</p>

<h2>2. Data we collect</h2>
<h3>2.1 Information you give us</h3>
<ul>
<li><strong>Account details:</strong> name, email address, phone number, date of birth, city, profile photo, username and interests.</li>
<li><strong>Event and ticket information:</strong> events you create, tickets you buy, guest details you add, requests to attend and check-ins.</li>
<li><strong>Vendor and business information:</strong> business name, category, location, contact details, portfolio and promotions.</li>
<li><strong>Payments and payouts:</strong> transaction references, amounts and status; for withdrawals, the bank account you add (the account name is confirmed with your bank).</li>
<li><strong>Identity verification:</strong> if you verify, your ID type and number and a selfie, used to confirm who you are.</li>
<li><strong>Messages and content:</strong> chats, community posts, statuses, reviews, reports and support requests.</li>
</ul>
<h3>2.2 Information collected automatically</h3>
<ul>
<li><strong>Device and usage data:</strong> device type, browser, app version, IP address, pages viewed and actions taken, used for security and to improve the Platform.</li>
<li><strong>Location:</strong> only if you allow it, to show events near you. You can also type a location instead.</li>
<li><strong>Error reports:</strong> technical diagnostics when something goes wrong, with personal identifiers removed where possible.</li>
</ul>
<h3>2.3 Information from others</h3>
<p>We receive payment confirmations from payment partners, sign-in details from Google if you choose Google Sign-In, results from identity verification providers, and information other users share about you (for example when an organiser adds you as a guest or manager).</p>

<h2>3. How we use your data</h2>
<ul>
<li>To create and secure your account, including verification codes and fraud prevention.</li>
<li>To sell, deliver, verify and refund tickets, and to settle payments to organisers, vendors and promoters.</li>
<li>To show relevant events and vendors based on your location and interests.</li>
<li>To send transactional messages such as receipts, tickets and reminders, and, if you agree, news and offers.</li>
<li>To provide messaging, communities and live features.</li>
<li>To review reports, enforce our <a href="/terms">Terms</a> and keep users safe.</li>
<li>To meet legal, tax and regulatory obligations.</li>
</ul>

<h2>4. Legal bases</h2>
<p>We process personal data because it is necessary to provide the services you request (performance of a contract), to comply with the law, for our legitimate interests in running a safe and reliable marketplace, or with your consent, for example for marketing messages and precise location. You can withdraw consent at any time in Settings.</p>

<h2>5. Who we share data with</h2>
<p>We do not sell your personal data. We share it only where needed:</p>
<ul>
<li><strong>Organisers</strong> receive the name, contact and ticket details of guests for their events, so they can manage entry.</li>
<li><strong>Vendors</strong> receive the details you share when you contact them.</li>
<li><strong>Service providers</strong> that process data on our behalf under contract: payment processing (such as Paystack and Monnify), email and SMS delivery, push notifications, media and file storage, identity verification and error monitoring.</li>
<li><strong>Authorities</strong> when required by law, or to protect the rights, property or safety of our users and the public.</li>
<li><strong>A buyer or successor</strong> if Wedpluz is involved in a merger or acquisition, with this policy continuing to apply.</li>
</ul>

<h2>6. Payments</h2>
<p>Card and bank details are entered directly with our payment partners. Wedpluz never receives or stores your full card number. We keep transaction records needed for receipts, refunds, settlements and accounting.</p>

<h2>7. International transfers</h2>
<p>Some of our service providers store or process data outside Nigeria. When that happens we rely on safeguards permitted under the NDPA, such as adequacy decisions or contractual protections, so your data stays protected.</p>

<h2>8. How long we keep data</h2>
<ul>
<li>Account data is kept while your account is active. When you delete your account it is deactivated immediately and permanently deleted or anonymised after 30 days.</li>
<li>Transaction and tax records are kept for as long as the law requires, even after account deletion.</li>
<li>Content removed for breaking our rules may be kept for up to 90 days to handle appeals.</li>
<li>Identity verification media is deleted once it is no longer needed; we keep only the result and a provider reference.</li>
</ul>

<h2>9. Security</h2>
<p>We protect data with encryption in transit, access controls, encryption of sensitive fields such as ID numbers, private storage for documents with short-lived links, and monitoring. No system is perfectly secure, so please use a strong password and never share your PIN or one-time codes. Wedpluz staff will never ask for them.</p>

<h2>10. Your rights</h2>
<p>Under the NDPA you have the right to:</p>
<ul>
<li>access the personal data we hold about you and receive a copy;</li>
<li>correct inaccurate data (most details can be edited in Settings);</li>
<li>delete your data, subject to legal retention requirements;</li>
<li>object to or restrict certain processing, including direct marketing;</li>
<li>data portability, receiving your data in a common format;</li>
<li>withdraw consent at any time.</li>
</ul>
<p>To exercise these rights, email {{supportEmail}}. We may need to confirm your identity first and will respond within the time required by law. If you are unhappy with our response, you can complain to the Nigeria Data Protection Commission.</p>

<h2>11. Your choices</h2>
<ul>
<li><strong>Privacy settings:</strong> control who can message you and what appears on your profile.</li>
<li><strong>Notifications:</strong> choose which updates you receive by email, SMS, WhatsApp and push. Security and transactional messages, such as codes and receipts, are always sent.</li>
<li><strong>Location:</strong> turn location access off in your browser or device settings.</li>
</ul>

<h2>12. Cookies and local storage</h2>
<p>The website uses your browser’s storage to keep you signed in, remember your preferences (such as language and the “For Individuals / For Businesses” switch) and your recent searches. We do not use advertising cookies. Clearing your browser data removes these settings.</p>

<h2>13. Children</h2>
<p>The Platform is not intended for anyone under 18, and we do not knowingly collect their personal data. If you believe a child has given us personal data, contact us and we will delete it.</p>

<h2>14. Changes to this policy</h2>
<p>We will post any changes on this page and update the date at the top. If changes are significant, we will notify you by email or in the app before they take effect.</p>

<h2>15. Contact us</h2>
<p>Questions or requests about your privacy? Email {{supportEmail}} or visit the <a href="/help">Help center</a>.</p>
`,
}
