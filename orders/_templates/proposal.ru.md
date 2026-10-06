<!--
Template: orders/<id>/proposal.md, Russian. Same rules as proposal.en.md: written by /order --propose from the
concept-panel result; approvals happen on the private proposal page; {{...}} are filled by the skill; the
direction block repeats per direction; the studio's other brands are never named here.
-->
# Предложение: {{brand.name}}

Заказ `{{orderId}}` · тип {{type}} ({{variant}}) · подготовлено {{date}}

Мы подготовили три направления сайта. Каждое — цельный мир: концепция, цвета, шрифты, названия, структура страниц и голос текстов. Выберите одно направление, затем утвердите каждый пункт или попросите изменения на странице предложения: {{proposalUrl}}

## Сравнение направлений

| | Направление A | Направление B | Направление C |
|---|---|---|---|
| Концепция | {{A.concept.title}} | {{B.concept.title}} | {{C.concept.title}} |
| Эпоха, место, ремесло | {{A.concept.era}}, {{A.concept.place}}, {{A.concept.craft}} | {{B.concept.era}}, {{B.concept.place}}, {{B.concept.craft}} | {{C.concept.era}}, {{C.concept.place}}, {{C.concept.craft}} |
| Шрифты | {{A.typography.display.family}} / {{A.typography.body.family}} | {{B.typography.display.family}} / {{B.typography.body.family}} | {{C.typography.display.family}} / {{C.typography.body.family}} |
| Оценка соответствия правилам | {{A.scores.compliance}} | {{B.scores.compliance}} | {{C.scores.compliance}} |
| Оценка уникальности | {{A.scores.uniqueness}} | {{B.scores.uniqueness}} | {{C.scores.uniqueness}} |

{{#requiresSignoff}}
> Для оператора: направление {{id}} относится к тому же семейству концепций, что и другой наш сайт; отличается эпохой, местом и ремеслом. Подтвердите перед утверждением.
{{/requiresSignoff}}

## Направление {{id}}: {{concept.title}}

**Мир.** {{concept.world}}

**Смелый ход.** {{concept.boldMove}}

**Словарь мира.** {{concept.vocabulary[].term}} (используются в названиях, навигации и текстах).

**Иллюстрации.** Только предметы и места: {{concept.artwork.subjects}}. Никогда: {{concept.artwork.avoid}}.

**Цвета.**

| Роль | Название | Цвет |
|---|---|---|
| {{palette.colours[].role}} | {{palette.colours[].name}} | {{palette.colours[].hex}} |

Светлая и тёмная темы проектируются отдельно: светлый фон {{palette.themes.light.background}}, тёмный фон {{palette.themes.dark.background}}.

**Шрифты.** Заголовки — {{typography.display.family}}, текст — {{typography.body.family}}{{#typography.numeric}}, цифры — {{typography.numeric.family}}{{/typography.numeric}}. Все шрифты с открытой лицензией и раздаются с самого сайта.

**Структура.** Разделы главной по порядку: {{structure.homeSections}}. Навигация: {{structure.navLabels}}.

**Голос.** {{copy.register}}. Заголовок: «{{copy.heroH1}}» Подзаголовок: «{{copy.tagline}}»

{{#type=social-casino}}
**Виртуальная валюта.** {{currency.singular}} / {{currency.plural}}: {{currency.startingBalance}} на старте, ещё {{currency.topUpAmount}}, когда остаётся меньше {{currency.topUpBelow}}. Ничего не покупается и ничего не выплачивается.

**Игры.** {{games.house[].name}} ({{games.house[].engine}}).
{{/type=social-casino}}

## Что дальше

1. Вы выбираете направление и утверждаете каждый пункт (концепция, палитра, шрифты, структура и {{typeApprovalItems}}) на странице предложения или просите изменения с комментарием.
2. Мы резервируем названия и структуру, чтобы ни один другой наш сайт их не использовал, и начинаем сборку.
3. Вы получаете ссылку на предпросмотр и страницу Evidence со всеми проверками перед запуском; сам запуск требует вашего утверждения там.
