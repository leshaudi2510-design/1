<!--
Template: questions for a hotel-casino order (variants single-hotel, integrated-resort, resort-group), English.
Same block rules as questions.social-casino.en.md. Client-supplied facts (SITE-TYPES 6.3) are never invented:
hotel facts, prices and mandatory fees, offer conditions, booking engine URLs and the affiliate paid-search clause,
photo rights and model ages, licences, the venue map, Google's written confirmation for Mode B.
-->
# Questions for {{brand.name}}

Thank you for the brief. We need the answers below before we can start ({{beforeBuildCount}} questions) and before the site can go live ({{beforeLaunchCount}} questions). Reply under each `answer:` line.

## Before we build

### Landing mode
field: casinoMode
why: Google treats promotion of a land-based casino as offline gambling, restricted in many countries. Mode A is a casino-free domain (no casino mention anywhere); Mode B is a separate domain that presents the casino and needs Google's written confirmation first (and, for Great Britain, a Gambling Act opinion).
question: Should this domain be casino-free (Mode A, our default), or is it the separate casino-referenced site (Mode B)?
answer:

### Property type
field: variant
why: One hotel, one integrated resort with many venues, or a group of properties have different page sets.
question: Is this one hotel, one resort with several venues, or a group of hotels?
answer:

### Venue map
field: typeOptions.venues
why: An event in a venue that is the casino, casino-branded or inside the casino counts as casino promotion, so we need to know which venues are casino-linked.
question: Please list the restaurants, bars, theatres and other venues, and mark any that are the casino, casino-branded or inside the casino.
answer:

### Booking
field: typeOptions.booking.provider
why: The booking button hands off to your booking engine or an OTA affiliate link; we need the exact URL format.
question: Which booking engine do you use (vendor, URL format), or do bookings go through an OTA affiliate link (whose account)?
answer:

### Affiliate paid search
field: typeOptions.booking.affiliatePaidSearch
why: Some affiliate programmes forbid paid search traffic to their links; campaigns would breach the programme.
question: If bookings go through an affiliate link, does the programme allow Google Ads traffic? Please quote the clause.
answer:

### Languages
field: locales
why: Each language gets its own pages and translated copy; prices and dates are formatted per language.
question: Which languages should the site have, and which is the default?
answer:

### Target markets
field: markets
why: Markets decide the advertising rules, the consent regime and the price presentation.
question: Which countries will you advertise in?
answer:

## Before launch

### Hotel facts
field: typeOptions.hotelFacts
why: We publish only facts you supply: star rating with the awarding body, check-in and check-out times, amenities, prices and mandatory fees.
question: Please send the hotel facts sheet (stars and who awarded them, check-in/out times, amenities, room types, prices with all mandatory fees).
answer:

### Photographs
field: legal.notes
why: We publish only photographs you own or have a licence for, with credits.
question: Please send the photo originals with rights and credits.
answer:

### Operator company
field: operator.name
why: The operator is named in the footer, the terms, the structured data and the Google Ads advertiser verification.
question: What is the full legal name of the company that operates the hotel, and in which registry is it registered?
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

### Legal review
field: legal.reviewer
why: The legal pages and booking terms need a named reviewer before launch.
question: Who reviews the legal pages (name, firm), and by when?
answer:

### Primary conversion
field: ppc.primaryConversion
why: Advertising needs one primary conversion: a click on the booking button (book_click) or a completed booking measured on the engine (purchase).
question: Which action counts as the primary conversion?
answer:
