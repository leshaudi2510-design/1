<!--
Template: questions for a social-casino order (type social-casino; variants own-games, demo-lobby), English.
Used by /order (intake-analyst) to write orders/<id>/questions.md. Rules (SPEC 4.1, 5.1; ECC A-14):
- One block per question. Each block has a `field:` line with the order.json path the answer goes to, the
  question in the client's language, and an empty `answer:` line. `/order --answers` merges answers by `field:`
  path with provenance { source: 'asked', answeredOn }.
- Keep only the blocks whose field is missing, a "[placeholder]", or has provenance confidence < 0.8.
  validate-order --json prints the missing paths with a `question` text; use it verbatim when present.
- Legal facts are never guessed: operator, domain ownership, DNS, GA4/Ads, purchases, provider consent,
  age verification, legal reviewer, hosting account, launch date, trademark.
- `why:` lines state the scenario and what goes wrong without the answer; no vague words ("correctly", "fast").
- A re-answered question keeps its block and gains "[revised]" after the heading.
-->
# Questions for {{brand.name}}

Thank you for the brief. We need the answers below before we can start ({{beforeBuildCount}} questions) and before the site can go live ({{beforeLaunchCount}} questions). Reply under each `answer:` line; "same as the other sites" is a valid answer where it applies.

## Before we build

### Free-to-play confirmation
field: typeOptions.purchases.enabled
why: The site is a free-to-play social casino. Anything bought with money, any prize and any cash-out moves it out of this type and out of Google's social casino policy.
question: Should players be able to buy anything with real money (for example extra coins)? We recommend no purchases at launch.
answer:

### Provider demos
field: typeOptions.games.mode
why: Our own house games are always included (at least three). Third-party demos (for example Pragmatic Play) make the site non-advertisable on Google Ads and need the provider's written consent before launch.
question: House games only, or a demo lobby with a provider's free demos as well? If a demo lobby: do you have the provider's written consent (reference and date)?
answer:

### Google Ads
field: analytics.adsConversionId
why: A demo lobby can never carry a Google Ads account or conversion ID; the order is rejected at intake if both are present.
question: Will this site be advertised on Google Ads? If yes, whose Google Ads account (the client's own, under our manager account) and whose payment profile funds it?
answer:

### Analytics
field: analytics.ga4
why: Each site has its own GA4 property; IDs are never shared between sites.
question: Do you have a GA4 measurement ID for this site (G-...), or should we launch without analytics?
answer:

### Domain
field: domain
why: The domain must be registered to you (the advertiser). Free subdomains are not accepted.
question: Which domain will the site use, and is it registered in your name?
answer:

### Domain access
field: dns.accessConfirmed
why: We point the domain at hosting; without registrar or Cloudflare access the launch waits.
question: Where is the domain registered, and can you give us access to its DNS (or move the nameservers to Cloudflare)?
answer:

### Launch date
field: dates.launchTarget
why: The launch date fixes the content freeze and the review slots.
question: When should the site be live (date)?
answer:

### Hosting
field: hosting.provider
why: Sites are hosted on Cloudflare Pages by default, one project per site.
question: Should we host it like the other sites (Cloudflare Pages), or deliver it to your own repository?
answer:

## Before launch

### Operator company name
field: operator.name
why: The operator is named in the footer, the terms, the structured data and the Google Ads advertiser verification; all four must match the register.
question: What is the full legal name of the company that operates the site?
answer:

### Company number
field: operator.registrationNumber
why: We check the number on Companies House before launch.
question: What is the company's Companies House number?
answer:

### Registered office
field: operator.address
why: The registered office appears in the terms and the privacy notice.
question: What is the registered office address?
answer:

### Contact mailbox
field: operator.email
why: The mailbox must exist and receive mail before launch (we send a test message).
question: Which email address should players use (it must be on the site's domain or yours)?
answer:

### Age verification
field: typeOptions.ageVerification.method
why: Adults only (18+). The method is a decision the operator records: self-declaration, or third-party age verification.
question: Self-declared 18+ gate, or a third-party age-verification provider (which one)?
answer:

### Audience assessment
field: audienceAssessment.signedBy
why: Someone on your side signs the assessment of whether the site is likely to be accessed by children; we draft it, you sign it.
question: Who will sign the audience assessment (name and role)?
answer:

### Legal review
field: legal.reviewer
why: Terms, privacy and cookies are generated from your details and need a named reviewer before launch.
question: Who reviews the legal pages (name, firm), and by when?
answer:

### Trademark search
field: brand.trademarkSearch.done
why: The brand name must not clash with a registered trademark or a real-money gambling brand.
question: Has a trademark search been done for the brand name? Who did it and when?
answer:

### Contact form endpoint
field: contactEndpoint
why: The contact page can post to a form service you control; without one it shows the email address only.
question: Do you have a form endpoint (URL) for the contact page, or should the page show the email address only?
answer:

### Primary conversion
field: ppc.primaryConversion
why: Advertising needs one primary conversion. For social casino the default candidates are play_start or level_end.
question: Which action counts as the primary conversion: starting a game (play_start) or finishing a level (level_end)?
answer:
