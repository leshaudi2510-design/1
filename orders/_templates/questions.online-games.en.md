<!--
Template: questions for an online-games order (variants portal, single-game, kids), English.
Same block rules as questions.social-casino.en.md (field: / question / empty answer:). Client-supplied facts
(SITE-TYPES 6.3) are never invented: publisher agreements and their paid-traffic clauses, game licences,
developer attribution, screenshot and video rights, the signed audience assessment.
-->
# Questions for {{brand.name}}

Thank you for the brief. We need the answers below before we can start ({{beforeBuildCount}} questions) and before the site can go live ({{beforeLaunchCount}} questions). Reply under each `answer:` line.

## Before we build

### Kind of site
field: variant
why: A portal (many games from distributor feeds), a single-game landing page and a site for children have different pages, consent and advertising rules.
question: Is this a portal with many games, a landing page for one game, or a site aimed at children?
answer:

### Where the games come from
field: typeOptions.providers
why: Each distributor (GameDistribution, GamePix, GameMonetize, Playgama) needs a publisher account. Embedding games scraped from Poki or CrazyGames is not possible: they are site-locked.
question: Which games will the site carry: your own, licensed titles, or distributor feeds? For feeds, which distributors and which publisher account IDs?
answer:

### Paid traffic permission
field: typeOptions.providers[0].paidSearchPermitted
why: Some publisher agreements forbid paid search traffic to their games; a campaign landing on those pages would breach the agreement.
question: Does each publisher agreement allow Google Ads traffic to the game pages? Please quote the clause.
answer:

### Advertising inside the site
field: typeOptions.adsInside
why: Display ads (AdSense, Ad Manager) change the consent set-up and add an ad-density cap.
question: Will the site show display ads? If yes, which account?
answer:

### Social features
field: typeOptions.socialFeatures
why: Chat, multiplayer lobbies or user-made levels bring the Online Safety Act and the Children's Code into scope.
question: Should the site have any chat, multiplayer or user-generated content? (Default: none.)
answer:

### Domain
field: domain
why: The domain must be registered to you (the advertiser).
question: Which domain will the site use, and is it registered in your name?
answer:

### Launch date
field: dates.launchTarget
why: The launch date fixes the content freeze and the review slots.
question: When should the site be live (date)?
answer:

## Before launch

### Audience assessment
field: audienceAssessment.signedBy
why: Whether the site is "likely to be accessed by children" decides the consent, analytics and ad-tag set-up; we draft the assessment, you sign it.
question: Who will sign the audience assessment (name and role)?
answer:

### Operator company
field: operator.name
why: The operator is named in the footer, the terms, the structured data and the Google Ads advertiser verification.
question: What is the full legal name of the company that operates the site, and in which registry is it registered?
answer:

### Registration number
field: operator.registrationNumber
why: We check the number in the registry before launch.
question: What is the company registration number?
answer:

### Registered office
field: operator.address
why: The registered office appears in the terms and the privacy notice.
question: What is the registered office address?
answer:

### Attribution
field: typeOptions.providers
why: Distributors and licensors often require developer attribution text on each game page.
question: What attribution text does each game or provider require?
answer:

### Screenshots and video
field: legal.notes
why: We only publish screenshots and gameplay video you have the rights to.
question: Do you hold the rights to the screenshots and gameplay video we will use?
answer:

### Legal review
field: legal.reviewer
why: The legal pages need a named reviewer before launch.
question: Who reviews the legal pages (name, firm), and by when?
answer:

### Primary conversion
field: ppc.primaryConversion
why: Advertising needs one primary conversion: starting a game (play_start) or 30 seconds of play (game_session_30s).
question: Which action counts as the primary conversion?
answer:
