# Чеклист соответствия: Opal Quest Lounge

Для каждого пункта указано, где он выполнен в коде. Пути даны от папки `opalquestlounge/`.
Отметки: ✅ — выполнено и проверено. ⚠️ — зависит от вас (реквизиты, деплой, проверка в инструментах Google).

## 1. Google Ads: Gambling and games → Social casino games (UK)

| # | Требование | Где | Статус |
|---|---|---|---|
| 1.1 | Минимум 3 настоящие игры прямо на сайте, без iframe | **Без Pragmatic** (`node build.mjs --no-pragmatic`): `src/public/assets/js/games/seven-systems.js`, `lapidary-wheel.js`, `brilliant-21.js` (canvas); в HTML нет ни одного `<iframe>`. **Режим Pragmatic** (по умолчанию): свои Lapidary Wheel и Brilliant Twenty-One плюс 12 демо Pragmatic Play в `<iframe>`, который создаётся только после нажатия Play (`games/pragmatic.js`) | ✅ без Pragmatic · ⚠️ Pragmatic: iframe, см. «Режим Pragmatic» |
| 1.2 | Только виртуальная валюта, без обмена на ценности, не sweepstakes | `src/public/assets/js/lib/wallet.js` (баланс только в localStorage); `src/pages/terms.mjs`, раздел 4; `src/pages/home.mjs`, блок «How Carats work» | ✅ |
| 1.3 | Дисклеймер в первом экране, у каждой игры, в подвале и в Terms | текст — `src/lib/context.mjs:6`; hero — `src/pages/home.mjs:33`; у игры — `src/lib/games-ui.mjs` (`.game__disclaimer` во всех трёх панелях); подвал — `src/lib/layout.mjs:174`; Terms — `src/pages/terms.mjs` (под заголовком и в разделе 3). Сборка падает, если дисклеймера нет хоть на одной странице (`build.mjs`, lint) | ✅ |
| 1.4 | Никаких реальных казино и букмекеров; запрещённые слова | В обоих режимах нет ни одной ссылки на операторов; список `FORBIDDEN` в `build.mjs` проверяет каждую страницу и каждый JS-файл на deposit / withdraw / cash out / bonus code / real money wins / win big / jackpot / hurry / don't miss out, а также на сравнения игр между собой («the highest of the games here»). **Режим Pragmatic:** названия слотов Pragmatic Play — бренды игр реальных казино — стоят в title и H1 двенадцати страниц, на главной, в подвале и в meta description. Это конфликт с правилом Google о «names or marks associated with real-money gambling brands», см. «Режим Pragmatic», решение P2 | ✅ без Pragmatic · ⚠️ Pragmatic |
| 1.5 | 18+: подтверждение при первом входе | `<dialog id="age-gate">` — `src/lib/layout.mjs:239`; логика — `src/public/assets/js/lib/age.js` (Escape не закрывает; если браузер всё же закроет вопрос без ответа — второй Escape в Chromium, жест «Назад» на Android, — ничего не сохраняется, игры остаются закрыты, а кнопка «Confirm my age» на игре спрашивает снова; ответ «нет» блокирует игры на 30 дней); `rg.canPlay()` не даёт ставить без «yes» | ✅ |
| 1.5 | Не привлекать несовершеннолетних (CAP/ASA) | Наша графика в обоих режимах — только предметы и места, без персонажей: карты с буквами вместо портретов (`brilliant-21.js`, `drawCardFace`), обложки — `src/lib/art.mjs`; взрослая типографика; без сленга и мемов. **Режим Pragmatic:** внутри демо — графика Pragmatic Play, и в ней есть персонажи (Зевс, Аид, мадам Дестини). Игры с сильной привлекательностью для детей (The Dog House, Sugar Rush, Starlight Princess) не взяты: поле `appeal` в `src/data/pragmatic-games.json` проверяет сборка | ✅ без Pragmatic · ⚠️ Pragmatic: персонажи внутри демо |
| 1.6 | Responsible gaming: 0808 8020 133, BeGambleAware, GamCare | `src/pages/responsible-gaming.mjs`; номер и ссылки есть в подвале каждой страницы (`src/lib/layout.mjs`, «Need to talk?») | ✅ |
| 1.6 | Таймер сессии | `[data-session]` в шапке; `src/public/assets/js/lib/rg.js` (`tick`), `lib/session.js` | ✅ |
| 1.6 | Напоминание о перерыве каждые 30 минут | `rg.js:11` `REMINDER_EVERY`; `<dialog id="reality-check">` показывает время, ставки и возврат за сессию; кнопка «Take a 5-minute break» | ✅ |
| 1.6 | Лимит времени по желанию | `rg.js` `setLimit`: снижение действует сразу, повышение — с завтрашнего дня. Плюс паузы на 24 ч, 7 и 30 дней (`startPause`), досрочно не отменяются | ✅ |
| 1.7 | Покупки раскрыты, если есть | `purchases: false` в конфиге. Если включить, `purchasesNote()` в `src/lib/games-ui.mjs` и тексты на главной, в Terms и About переключатся автоматически | ✅ |
| 1.8 | Прозрачность оператора: компания, номер, адрес, email на About, Contact и в подвале | `operatorCard()` в `src/pages/about.mjs` (About и Contact); подвал — `src/lib/layout.mjs`; JSON-LD `Organization` с `identifier` | ⚠️ впишите реквизиты в `site.config.json` и соберите с `--strict` |
| 1.8 | Страницы Terms, Privacy, Cookies, Responsible gaming | `src/pages/terms.mjs`, `privacy.mjs`, `cookies.mjs`, `responsible-gaming.mjs` | ✅ |
| 1.9 | Никакого клоакинга | статический HTML, одинаковый для всех; нет проверок User-Agent, гео или реферера и нет редиректов (поиск по коду: `navigator.userAgent` нигде не используется); age gate — оверлей поверх того же HTML | ✅ |
| 1.10 | Готовность к сертификации | см. раздел «Форма сертификации» ниже | ⚠️ после деплоя |

**Честность механики** (сверх требований, но важно для проверяющих):

- Результат определяется до анимации: `crypto.getRandomValues` с rejection sampling — `lib/rng.js:7`.
- Ничего не подстраивается под баланс или время игры.
- RTP опубликован и посчитан кодом игры:
  - слот — точно, перебором всех 39 304 комбинаций (`seven-systems.math.js:92`, 96.02%);
  - рулетка — 36/37 (`lapidary-wheel.math.js:66`);
  - блэкджек — симуляция 20 млн раздач (`tools/simulate-21.mjs`, ≈ 99.6%).
- Нет «проигрышей под видом выигрышей». Если возврат меньше ставки, текст пишет «N down», опал не вспыхивает, звука нет (`games/common.js`, `settled` и `celebrate`).
- Бесплатное пополнение без таймеров и давления: «Claim 1,000 Carats» при балансе ниже 100.

## Режим Pragmatic: открытые решения

Сборка по умолчанию (`"pragmatic.enabled": true` в `site.config.json`) показывает 12 демо слотов Pragmatic Play. `node build.mjs --no-pragmatic` (или `"enabled": false`) собирает сайт без них: вместо демо — наш слот Seven Systems, и в сборке нет ни страниц Pragmatic, ни их скриптов (`pragmatic.js`, `pragmatic-url.js`), ни их OG-картинок, ни адреса `pragmaticplay.net`. Это проверяет lint сборки.

| # | Решение владельца | Статус | Дата и ответ |
|---|---|---|---|
| P1 | **Письменное согласие Pragmatic Play** (или B2B-лицензия, как у социальных казино-партнёров Pragmatic). Их Terms of Use дают лицензию только «for your own non-commercial entertainment purposes» и запрещают использовать игры или их названия «in conjunction with any other games, products, services or software without Pragmatic Play's express written consent». Номер и дату согласия впишите в `pragmatic.writtenConsent`: пока поле пустое, сборка предупреждает, а `--strict` (деплой) падает | ⚠️ открыто | — |
| P2 | **Google Ads или названия Pragmatic: выбрать одно.** Правило Google для social casino: «Ads, sites, or apps must not use logos, names, or marks associated with real-money gambling brands», а продвижение агрегаторов запрещено. Названия слотов Pragmatic — это игры реальных казино; они в title и H1 12 страниц, на главной, в подвале и в meta description. Это вывод из цитаты, а не решение Google; цитату надо проверить на живой странице https://support.google.com/adspolicy/answer/15132179 | ⚠️ открыто | — |
| P3 | **Факты из `verify`** в `src/data/pragmatic-games.json` (RTP, максимальная выплата, волатильность, сетка, дата выхода, бонус — у всех 12 игр) сверить с экраном «i» в каждом демо. Данные собраны из пресс-релизов и обзоров, сайт pragmaticplay.com из среды сборки недоступен. Пока RTP игры в `verify`, страница называет его «Default reported at launch and in reviews», а не цифрой Pragmatic. Сборка печатает список непроверенных полей | ⚠️ до запуска | — |

**Если реклама в Google Ads будет:**

- рекламируйте домен, который **всем** посетителям отдаёт сборку `node build.mjs --no-pragmatic` (не старый `config-nopragmatic.json` из черновиков: там прежняя концепция и цвета);
- не показывайте проверяющим другую сборку по User-Agent, гео или рефереру: это клоакинг (пункт 1.9);
- не ставьте с этого домена ссылок на сайт в режиме Pragmatic;
- иначе получите письменное подтверждение Google при сертификации (она обязательна с 14 сентября 2026).

Сборка предупреждает, а `--strict` падает, если при включённых демо задан `analytics.adsConversionId`.

## 2. UK GDPR и PECR

| Требование | Где | Статус |
|---|---|---|
| До согласия нет необязательных cookies и сторонних скриптов | `lib/consent.js`: `gtag.js` вставляется только в `loadTag()` после согласия. Проверено `tools/check.mjs`: 0 сторонних запросов и 0 cookies до выбора | ✅ |
| Режим Pragmatic: демо ставит свои cookies (Pragmatic Play и Google Analytics внутри демо) | Ничего не грузится до нажатия Play. Подпись у кнопки (`src/lib/ui/stage.mjs`, она же `aria-describedby` кнопки) говорит, что демо и Google Analytics в нём могут поставить cookies, со ссылкой на `/cookies/#third-party`. Cookie settings описывают демо отдельной строкой. После «Reject all» каждая кнопка Play сначала спрашивает («Load demo and allow its cookies» / «Don't load it»). Проверено `tools/check.mjs` | ✅ |
| «Reject all» и «Accept all» одинаково заметны, есть «Manage» | баннер и диалог — `src/lib/layout.mjs` (обе кнопки `btn--secondary`, одинакового размера); `check.mjs` сравнивает их стили | ✅ |
| Google Consent Mode v2, все сигналы по умолчанию `denied` | `lib/consent.js:22`: `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`, `functionality_storage`, `personalization_storage`, `security_storage` = `denied`; плюс `ads_data_redaction` | ✅ |
| Политики перечисляют всё хранилище, включая localStorage | единый список `STORAGE` в `src/pages/cookies.mjs` выводится и в Cookies, и в Privacy; ключи совпадают с кодом (`lib/store.js`, префикс `oql.`) | ✅ |
| Отзыв согласия так же прост | «Cookie settings» в подвале каждой страницы; при отказе cookies `_ga*` и `_gcl_*` удаляются | ✅ |
| Согласие не вечное | повторный запрос через 12 месяцев (`MAX_AGE` в `consent.js`) | ✅ |
| Без аналитики — без баннера | если `ga4` и `adsConversionId` пусты, баннер не рендерится и страницы не обращаются ни к одному внешнему домену (в режиме Pragmatic — до нажатия Play). CSP тоже закрывает Google (`csp()` в `src/lib/layout.mjs`) | ✅ |
| Контактная форма без стороннего обработчика | по умолчанию `mailto:`, данные на сайте не хранятся (`assets/js/contact.js`) | ✅ |
| ICO и права субъекта | `src/pages/privacy.mjs`, раздел «Your rights» | ✅ |

## 3. Google Search: spam policies и helpful content

| Требование | Где | Статус |
|---|---|---|
| Полезный контент: правила, выплаты, RTP и как он считается, порядок чисел на колесе, история | страницы игр `src/pages/seven-systems.mjs`, `lapidary-wheel.mjs`, `brilliant-twenty-one.mjs`: How to play, Paytable (с вероятностями), RTP-вывод, полные правила, минералы и сингонии, порядок 37 карманов, таблицы basic strategy (генерируются из той же функции, что подсказка в игре), история, FAQ | ✅ |
| Уникальность при нескольких сайтах | своя концепция, свои игры (слот сингоний с wild-опалом, колесо-огранка, Brilliant), свои тексты; ничего не общего с Pixel Crown Club в этом же репозитории | ✅ |
| Без keyword stuffing | тексты написаны для людей; в title одна формулировка на страницу | ✅ |
| Семантика, один `h1`, логичные заголовки, хлебные крошки | lint в `build.mjs` падает, если `h1` ≠ 1; хлебные крошки `<nav aria-label="Breadcrumb">` на всех внутренних страницах (`src/lib/layout.mjs`) | ✅ |
| JSON-LD: Organization, WebSite, VideoGame (`isAccessibleForFree: true`, `offers.price: 0`, `gamePlatform: "Web browser"`), BreadcrumbList | `src/lib/layout.mjs:33`, `:66`, `:78`; сборка проверяет обязательные поля и позиции крошек | ✅ / ⚠️ Rich Results Test после деплоя |
| `lang="en-GB"`, британская орфография, даты вида «25 September 2026» | `layout()`; `longDate()` в `src/lib/html.mjs`; lint ищет американские написания (color, center, license, jewelry…) | ✅ |
| Title ≤ 60, description ≤ 155, canonical, OG и Twitter 1200×630 | `layout()`; lint проверяет длины; OG-картинки в `assets/img/og-*.png` (своя на каждую игру) | ✅ |
| robots.txt, sitemap.xml, своя 404, favicon, manifest | генерирует `build.mjs`; `src/pages/misc.mjs` (404 с `noindex`); `favicon.svg` и `.ico`; `manifest.webmanifest` | ✅ |
| URL игры: `/games/{slug}/` | `/games/seven-systems/`, `/games/lapidary-wheel/`, `/games/brilliant-twenty-one/` + индекс `/games/` | ✅ |
| Интерстишиалы | age gate — юридически обязательный, это исключение в правилах Google; контент под ним тот же | ✅ |

## 4. WCAG 2.2 AA

| Критерий | Где | Статус |
|---|---|---|
| Контраст (1.4.3, 1.4.11) | токены в `site.css` подобраны для обеих тем; axe: 0 нарушений на 12 страницах × 2 темы × 7 состояний | ✅ |
| Видимый фокус (2.4.7, 2.4.11) | `:focus-visible` — обводка 3px `--focus`; радиокнопки показывают фокус на сегменте | ✅ |
| Игры полностью с клавиатуры (2.1.1) | кнопки, радиогруппы ставок; стол рулетки — стрелки (roving focus, `lapidary-wheel.js:262`), Enter/Backspace; горячие клавиши работают только при фокусе внутри игры (2.1.4) — `games/common.js:122` | ✅ проверено `check.mjs` |
| Фокус не теряется во время раунда | кнопки используют `aria-disabled`, а не `disabled` (`games/common.js:13`) | ✅ |
| Результаты через `aria-live` (4.1.3) | `.game__result` с `aria-live="polite"`; canvas с `role="img"` и описанием каждой клетки, карманов и карт | ✅ |
| Цели ≥ 24×24 (2.5.8) | кнопки ≥ 44 px, ячейки стола ≥ 44×44 px (на телефоне 40 px); axe `target-size` проходит | ✅ |
| `prefers-reduced-motion` | `site.css:1063` отключает переходы и view transitions; игры показывают результат без анимации; опал неподвижен | ✅ |
| `prefers-contrast: more` и forced colors | `site.css:1067`: без полупрозрачности, линии цвета текста, толще рамки; `forced-colors` | ✅ |
| Диалоги | нативный `<dialog>`, фокус внутри, подписи через `aria-labelledby` | ✅ |
| Прокручиваемые таблицы | `role="region"`, `tabindex="0"`, имя из `<caption>` (добавляет `build.mjs`) | ✅ |
| Ничего не мигает чаще 3 раз в секунду (2.3.1) | вспышка опала — затухающая пульсация ≈ 2.2 Гц за 1.6 s, на небольшой площади; при reduced motion — одно ровное свечение | ✅ |

## 5. Core Web Vitals и бюджет

| Требование | Где | Результат |
|---|---|---|
| LCP < 2.0 s (мобильный 4G) | LCP-элемент — текст `h1`; preload двух шрифтов Bodoni на главной; фолбэк-шрифты с `size-adjust` | 1.5–1.9 s (Lighthouse, slow 4G) |
| INP < 150 ms | игры рисуют на canvas через rAF; WebGL стартует после первого взаимодействия; тяжёлое откладывается | TBT 0–20 ms (INP — только по полевым данным после запуска) |
| CLS < 0.05 | у canvas и картинок заданы `width`/`height`; метрики фолбэк-шрифтов (`site.css:62`); резерв строки результата | 0–0.001 |
| HTML + CSS + JS < 150 KB gzip | считает `build.mjs:278` | ~49 KB |
| Шрифты: свои woff2, subset, swap, preload 1–2 | `src/public/assets/fonts/`, `tools/subset-fonts.py`, `font-display: swap` | ✅ |
| Картинки AVIF/WebP с `width`/`height`, lazy ниже первого экрана | `<picture>` в `gameList()` (`src/lib/games-ui.mjs`) | ✅ |
| Speculation Rules | `src/lib/layout.mjs:409`: prerender `/games/*` (moderate), prefetch остального; таймеры и age gate ждут `prerenderingchange` (`whenActivated` в `lib/ui.js`) | ✅ |

## 6. Дизайн: что сделано из списка «конец 2026»

| Приём | Где |
|---|---|
| OKLCH-палитра из 6 цветов, relative color syntax, `color-mix()` | `site.css:93–125` (`oklch(from var(--accent) l c h / 0.14)`, `color-mix(in oklch, …)`) |
| `light-dark()`, две отдельно продуманные темы | `site.css:107` и далее: «Daylight label» и «Velvet tray»; в тёмной теме кристаллы рисуются мелом, опал становится чёрным |
| Вариативные оси `wght`, `wdth`, `opsz` (+ `SHRP`) | Bodoni `opsz`, Martian Mono `font-stretch`, Geologica `SHRP` на кнопках |
| Живая играбельная сцена в hero | слот в первом экране (`src/pages/home.mjs`) |
| Асимметричная сетка, subgrid, `text-wrap: balance`/`pretty` | hero на 12 колонках; ящики игр — `grid-template-columns: subgrid` (`site.css:676`) |
| Cross-document View Transitions | `site.css:1016`: превью игры в ящике «перетекает» в сцену на странице игры |
| Scroll-driven animations | ящики «выдвигаются» (`animation-timeline: view()`), прогресс чтения на юридических страницах (`scroll()`) |
| `@starting-style`, `interpolate-size`, Popover API + anchor positioning, `<dialog>` | `site.css`: появление поповеров и диалогов; плавные `<details>`; меню игр и таблица выплат привязаны к кнопкам |
| Container и style queries, `:has()`, `@scope`, nesting | `@container game`, `@container table` (стол рулетки встаёт вертикально), `@container style(--variant: hero)`, `@scope (.prose)` |
| Пружины через `linear()` | `--spring` и `--settle` (`site.css:146`) рассчитаны из уравнения затухающей пружины; в JS та же физика (`spring()` в `lib/ui.js`, остановка барабанов) |
| Вибрация, звук только по включению | `lib/haptics.js`, `lib/sound.js` (Web Audio, синтез, по умолчанию выключен) |
| WebGL с fallback | `lib/opal.js`: WebGL-шейдер и CPU-версия на Canvas 2D |
| Мобильный док, safe areas, `dvh`/`svh`, PWA офлайн | `.dock` (`site.css:400`), `env(safe-area-inset-*)`, `100svh`, `92dvh`; `manifest.webmanifest`, `sw.js` |

Чего **нет** по брифу: фиолетового неона, золота на чёрном, 3D-монет, блобов, glassmorphism, bento, `rounded-2xl`, Inter, Poppins, Montserrat, Space Grotesk, эмодзи (масти карт нарисованы векторами), фейкового social proof, таймеров срочности и конфетти.

## Форма сертификации Google Ads: Social casino games (UK)

При подаче понадобятся:

1. **Домен:** `opalquestlounge.com` (все страницы доступны без входа).
2. **Страна:** United Kingdom.
3. **Юрлицо:** название, номер Companies House и адрес — точно как в подвале сайта (`site.config.json`).
4. **Описание продукта** зависит от сборки на рекламируемом домене:
   - **без Pragmatic** (`--no-pragmatic`, рекомендуемый вариант для рекламы): «Free-to-play social casino games (slot, European roulette, blackjack) played with a virtual currency (Carats) that has no monetary value, cannot be purchased, and cannot be exchanged for money, prizes or anything of value. Adults 18+ only. No sweepstakes or prize draws.»
   - **режим Pragmatic** (только после решений P1 и P2 выше): «Free-to-play social casino site: our own European roulette and blackjack, played with a virtual currency (Carats) that has no monetary value, cannot be purchased, and cannot be exchanged for money, prizes or anything of value, plus free demos of third-party slot games by Pragmatic Play. The demos load from pragmaticplay.net in a frame only when the visitor presses Play, and play with demo credits that have no value. Adults 18+ only. No sweepstakes or prize draws.»
5. **Где это видно проверяющему:** дисклеймер в первом экране главной; раздел «How Carats work»; Terms, раздел 4; каждая страница игры.
6. **18+:** age gate при первом визите; Responsible gaming — `/responsible-gaming/`.
7. **Покупки:** нет (при `purchases: true` тексты на сайте изменятся автоматически, это нужно отразить и в форме).
8. **Таргетинг:** в кампаниях исключить аудитории младше 18 и ставить объявления только на UK.
