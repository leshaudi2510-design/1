<!--
Template: orders/<id>/proposal.md, English. Written by /order --propose from the concept-panel result
(three directions, each a schemas/direction.schema.json object with its uniqueness --pre output and the judges'
scores). The client approves on the private proposal page (artifacts/proposal.template.html), not in this file;
this file is the record. {{...}} are filled by the skill; repeat the direction block per direction.
Do not name the studio's other brands here (siblings and antiReferences stay internal).
-->
# Proposal: {{brand.name}}

Order `{{orderId}}` · type {{type}} ({{variant}}) · prepared {{date}}

We prepared three directions for the site. Each one is a complete world: concept, colours, type, names, page structure and the voice of the copy. Pick one direction, then approve or ask for changes on each item on the proposal page: {{proposalUrl}}

## How the directions compare

| | Direction A | Direction B | Direction C |
|---|---|---|---|
| Concept | {{A.concept.title}} | {{B.concept.title}} | {{C.concept.title}} |
| Era, place, craft | {{A.concept.era}}, {{A.concept.place}}, {{A.concept.craft}} | {{B.concept.era}}, {{B.concept.place}}, {{B.concept.craft}} | {{C.concept.era}}, {{C.concept.place}}, {{C.concept.craft}} |
| Type pairing | {{A.typography.display.family}} / {{A.typography.body.family}} | {{B.typography.display.family}} / {{B.typography.body.family}} | {{C.typography.display.family}} / {{C.typography.body.family}} |
| Compliance score | {{A.scores.compliance}} | {{B.scores.compliance}} | {{C.scores.compliance}} |
| Distinctness score | {{A.scores.uniqueness}} | {{B.scores.uniqueness}} | {{C.scores.uniqueness}} |

{{#requiresSignoff}}
> Note for the operator: direction {{id}} shares a concept family with another site of ours; it is distinct by era, place and craft. Please acknowledge before approving.
{{/requiresSignoff}}

## Direction {{id}}: {{concept.title}}

**The world.** {{concept.world}}

**The bold move.** {{concept.boldMove}}

**Words of this world.** {{concept.vocabulary[].term}} (each used in names, navigation and copy).

**Artwork.** Objects and places only: {{concept.artwork.subjects}}. Never: {{concept.artwork.avoid}}.

**Colours.**

| Role | Name | Colour |
|---|---|---|
| {{palette.colours[].role}} | {{palette.colours[].name}} | {{palette.colours[].hex}} |

Light and dark themes are designed separately: light background {{palette.themes.light.background}}, dark background {{palette.themes.dark.background}}.

**Type.** Headings in {{typography.display.family}}, text in {{typography.body.family}}{{#typography.numeric}}, numbers in {{typography.numeric.family}}{{/typography.numeric}}. All fonts are open-licence and served from the site itself.

**Structure.** Home page sections in order: {{structure.homeSections}}. Navigation: {{structure.navLabels}}.

**Voice.** {{copy.register}}. Headline: "{{copy.heroH1}}" Tagline: "{{copy.tagline}}"

{{#type=social-casino}}
**Virtual currency.** {{currency.singular}} / {{currency.plural}}: {{currency.startingBalance}} to start, {{currency.topUpAmount}} more when you drop below {{currency.topUpBelow}}. Nothing is bought and nothing is paid out.

**Games.** {{games.house[].name}} ({{games.house[].engine}}).
{{/type=social-casino}}

## What happens next

1. You choose a direction and approve each item (concept, palette, typography, structure, plus {{typeApprovalItems}}) on the proposal page, or ask for changes with a note.
2. We reserve the names and the structure so no other site of ours can use them, and start building.
3. You receive a preview link and the Evidence page with every check before launch; the launch itself needs your approval there.
