# Чеклист соответствия: Opal Quest Lounge

Для каждого пункта указано, где он выполнен в коде. Пути даны от папки `opalquestlounge/`.
Отметки: ✅ — выполнено и проверено. ⚠️ — зависит от вас (реквизиты, деплой, проверка в инструментах Google).

## 1. Google Ads: Gambling and games → Social casino games (UK)

| # | Требование | Где | Статус |
|---|---|---|---|
| 1.1 | Минимум 3 настоящие игры прямо на сайте, без iframe | `src/public/assets/js/games/seven-systems.js`, `lapidary-wheel.js`, `brilliant-21.js` (canvas); в HTML нет ни одного `<iframe>` | ✅ |
| 1.2 | Только виртуальная валюта, без обмена на ценности, не sweepstakes | `src/public/assets/js/lib/wallet.js` (баланс только в localStorage); `src/pages/terms.mjs`, раздел 4; `src/pages/home.mjs`, блок «How Carats work» | ✅ |
| 1.3 | Дисклеймер в первом экране, у каждой игры, в подвале и в Terms | текст — `src/lib/context.mjs:6`; hero — `src/pages/home.mjs:33`; у игры — `src/lib/games-ui.mjs` (`.game__disclaimer` во всех трёх панелях); подвал — `src/lib/layout.mjs:174`; Terms — `src/pages/terms.mjs` (под заголовком и в разделе 3). Сборка падает, если дисклеймера нет хоть на одной странице (`build.mjs`, lint) | ✅ |
| 1.4 | Никаких реальных казино и букмекеров; запрещённые слова | нет ни одной ссылки на операторов; `build.mjs:202` проверяет каждую страницу и каждый JS-файл на deposit / withdraw / cash out / bonus code / real money wins / win big / jackpot / hurry / don't miss out | ✅ |
| 1.5 | 18+: подтверждение при первом входе | `<dialog id="age-gate">` — `src/lib/layout.mjs:239`; логика — `src/public/assets/js/lib/age.js` (Escape не закрывает; ответ «нет» блокирует игры на 30 дней); `rg.canPlay()` не даёт ставить без «yes» | ✅ |
| 1.5 | Не привлекать несовершеннолетних (CAP/ASA) | нет персонажей: карты с буквами вместо портретов (`brilliant-21.js`, `drawCardFace`), символы — научные рисунки кристаллов (`lib/crystals.js`); взрослая типографика; без сленга и мемов | ✅ |
| 1.6 | Responsible gaming: 0808 8020 133 (GamCare), GamCare, NHS | `src/pages/responsible-gaming.mjs`; номер и ссылки есть в подвале каждой страницы (`src/lib/layout.mjs`, «Need to talk?»). GambleAware (BeGambleAware.org) закрылась 31 марта 2026 г., её работу приняли NHS England, OHID и UKRI; поэтому вместо неё — GamCare (его самооценка) и страница NHS о помощи при игровой зависимости. Линию 0808 8020 133 по-прежнему ведёт GamCare. Сборка падает на ссылке на (be)gambleaware.org (`build.mjs`, lint). Это отход от п. 6 брифа, где назван BeGambleAware: нужно согласие владельца | ✅ / ⚠️ согласовать с владельцем |
| 1.6 | Таймер сессии | `[data-session]` в шапке; `src/public/assets/js/lib/rg.js` (`tick`), `lib/session.js` | ✅ |
| 1.6 | Напоминание о перерыве каждые 30 минут | `rg.js:11` `REMINDER_EVERY`; `<dialog id="reality-check">` показывает время, ставки и возврат за сессию; кнопка «Take a 5-minute break» | ✅ |
| 1.6 | Лимит времени по желанию | `rg.js` `setLimit`: снижение действует сразу, повышение — с завтрашнего дня; сохраняется только кнопкой (в Settings — «Save limit», подпись которой говорит, что произойдёт), а не при выборе в списке. Плюс паузы на 24 ч, 7 и 30 дней (`startPause`), досрочно не отменяются. Окончание перерыва, достижение лимита и полночь в открытой вкладке сразу обновляют игры и демо (`tick()` сравнивает ответ `canPlay()` каждую секунду) | ✅ |
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

## 2. UK GDPR и PECR

| Требование | Где | Статус |
|---|---|---|
| До согласия нет необязательных cookies и сторонних скриптов | `lib/consent.js`: `gtag.js` вставляется только в `loadTag()` после согласия. Проверено `tools/check.mjs`: 0 сторонних запросов и 0 cookies до выбора | ✅ |
| «Reject all» и «Accept all» одинаково заметны, есть «Manage» | баннер и диалог — `src/lib/layout.mjs` (обе кнопки `btn--secondary`, одинакового размера); `check.mjs` сравнивает их стили | ✅ |
| Google Consent Mode v2, все сигналы по умолчанию `denied` | `lib/consent.js:22`: `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`, `functionality_storage`, `personalization_storage`, `security_storage` = `denied`; плюс `ads_data_redaction` | ✅ |
| Политики перечисляют всё хранилище, включая localStorage | единый список `STORAGE` в `src/pages/cookies.mjs` выводится и в Cookies, и в Privacy; ключи совпадают с кодом (`lib/store.js`, префикс `oql.`) | ✅ |
| Отзыв согласия так же прост | «Cookie settings» в подвале каждой страницы; при отказе cookies `_ga*` и `_gcl_*` удаляются | ✅ |
| Согласие не вечное | повторный запрос через 12 месяцев (`MAX_AGE` в `consent.js`) | ✅ |
| Без аналитики — без баннера | если `ga4` и `adsConversionId` пусты, баннер не рендерится и страницы не обращаются ни к одному внешнему домену. CSP тоже закрывает Google (`csp()` в `src/lib/layout.mjs:7`) | ✅ |
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
| Контраст (1.4.3, 1.4.11) | токены в `src/styles/00-tokens.css` подобраны для обеих тем; axe: 0 нарушений на 12 страницах × 2 темы × 7 состояний | ✅ |
| Видимый фокус (2.4.7, 2.4.11) | `:focus-visible` — обводка 3px `--focus`; радиокнопки показывают фокус на сегменте. На телефонах `scroll-padding-bottom` (`--dock-clear`, `src/styles/10-base.css`) не даёт фиксированному доку закрыть элемент в фокусе; баннер cookies стоит первым в разметке и держит такой же отступ, пока виден (`lib/consent.js`) | ✅ |
| Игры полностью с клавиатуры (2.1.1) | кнопки, радиогруппы ставок; стол рулетки — стрелки (roving focus, `lapidary-wheel.js:262`), Enter/Backspace; горячие клавиши работают только при фокусе внутри игры (2.1.4) — `games/common.js:122` | ✅ проверено `check.mjs` |
| Фокус не теряется во время раунда | кнопки используют `aria-disabled`, а не `disabled` (`games/common.js:13`) | ✅ |
| Результаты через `aria-live` (4.1.3) | `.game__result` с `aria-live="polite"`; canvas с `role="img"` и описанием каждой клетки, карманов и карт | ✅ |
| Цели ≥ 24×24 (2.5.8) | кнопки ≥ 44 px, ячейки стола ≥ 44×44 px (на телефоне 40 px); axe `target-size` проходит | ✅ |
| `prefers-reduced-motion` | `src/styles/95-prefs.css` отключает переходы и анимации; игры показывают результат без анимации; опал неподвижен | ✅ |
| `prefers-contrast: more` и forced colors | `src/styles/95-prefs.css`: без полупрозрачности, линии цвета текста, толще рамки; `forced-colors` | ✅ |
| Диалоги | нативный `<dialog>`, фокус внутри, подписи через `aria-labelledby`; в каждом диалоге своя строка `role="status"`, куда `toast()` пишет, пока диалог открыт (снаружи всё inert) | ✅ |
| Прокручиваемые таблицы | `role="region"`, `tabindex="0"`, имя из `<caption>` (добавляет `build.mjs`) | ✅ |
| Ничего не мигает чаще 3 раз в секунду (2.3.1) | вспышка опала — затухающая пульсация ≈ 2.2 Гц за 1.6 s, на небольшой площади; при reduced motion — одно ровное свечение | ✅ |

## 5. Core Web Vitals и бюджет

| Требование | Где | Результат |
|---|---|---|
| LCP < 2.0 s (мобильный 4G) | при первом визите (так приходят все из Google Ads) LCP-элемент — текст вопроса о возрасте: его открывает крошечный `assets/js/age-boot.js` до загрузки модулей `app.js`, так что LCP ≈ FCP; после ответа — текст страницы (`h1` или лид). Preload двух шрифтов (Archivo, Radio Canada); тема применяется встроенным скриптом по хешу CSP, без блокирующего запроса; `site.css` минифицируется при сборке | ≈ 1.7–1.8 s (Lighthouse, slow 4G) |
| INP < 150 ms | игры рисуют на canvas через rAF; WebGL стартует после первого взаимодействия; тяжёлое откладывается | TBT 0–20 ms (INP — только по полевым данным после запуска) |
| CLS < 0.05 | у canvas и картинок заданы `width`/`height`; фолбэк-шрифты с `size-adjust` и `ascent`/`descent-override`, разбитые по насыщенности и ширине (`src/styles/00-tokens.css`, генерирует `tools/font-fallbacks.mjs`); резерв строки результата | 0–0.03 (шрифты задержаны на 1,2 s) |
| HTML + CSS + JS < 150 KB gzip | считает `build.mjs` (раздел «First-view budget») | ~58 KB |
| Шрифты: свои woff2, subset, swap, preload 1–2 | `src/public/assets/fonts/`, `tools/subset-fonts.py` (из полных файлов google/fonts, чтобы были ≈, ç, ÷ и ›; скрипт падает, если символа нет), `font-display: swap` | ✅ |
| Картинки AVIF/WebP с `width`/`height`, lazy ниже первого экрана | `<picture>` в `gameList()` (`src/lib/games-ui.mjs`) | ✅ |
| Speculation Rules | `src/lib/layout.mjs:409`: prerender `/games/*` (moderate), prefetch остального; таймеры и age gate ждут `prerenderingchange` (`whenActivated` в `lib/ui.js`) | ✅ |

## 6. Дизайн: что сделано из списка «конец 2026»

> Таблица ниже описывает прошлый дизайн. После редизайна «Ben-Day Brights» часть приёмов убрана, а ссылки вида `site.css:NNN` больше не действуют: стили лежат в `src/styles/*.css`, и `site.css` собирается из них минифицированным.

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

## 7. Привлекательность для детей (CAP 16.3.12): какие демо попадают в лобби

Правило CAP 16.3.12 (с 1 октября 2022): реклама азартных игр не должна сильно привлекать детей и подростков. Для ASA обложки, названия и описания игр на сайте тоже реклама. Поэтому каждая демо-игра Pragmatic Play проходит отбор.

| Что | Где | Статус |
|---|---|---|
| Обложки только из предметов и мест: без персонажей, лиц, животных и частей тела | `COVERS` в `src/lib/art.mjs`; сборка падает, если у игры нет обложки (`build.mjs`, lint) | ✅ |
| У каждой игры оценка `appeal`: только `low` или `medium`, с пояснением в `appealNote` | `src/data/pragmatic-games.json`; `build.mjs` отклоняет любое другое значение | ✅ |
| Игры, чей собственный арт строится на персонажах или сладостях, в лобби не попадают: The Dog House, Starlight Princess, Sugar Rush, Sweet Bonanza | список в `_about` файла `pragmatic-games.json` | ✅ |

**Sweet Bonanza убрана 26 сентября 2026.** Исследование оценило её риск как высокий (конфеты и леденцы, самый рискованный арт из проверенных). Наша обложка рисовала мультяшную конфету и бомбу с фитилём «100×», а спецификация дизайна (раздел 12) прямо исключает конфетную тематику. Решение ASA 2026 года по Videoslots / Mr Vegas признало её рекламу допустимой (там был только текст, без персонажей), но это снижает риск, а не снимает его. Вернуть игру можно только после юридической консультации. Для этого нужно записать решение здесь, изменить раздел 12 спецификации, перерисовать обложку и share-картинку без сладостей, бомбы и «100×» и заново собрать `og-sweet-bonanza.png` через `tools/make-images.mjs`.

Возможная замена — Mustang Gold (`vs25mustang`, риск низкий). Перед добавлением проверьте в самом демо максимальную выплату, волатильность и арт. Обложку рисуйте только из предметов (подкова и золотые монеты над столовыми горами, без лошади).

## Форма сертификации Google Ads: Social casino games (UK)

При подаче понадобятся:

1. **Домен:** `opalquestlounge.com` (все страницы доступны без входа).
2. **Страна:** United Kingdom.
3. **Юрлицо:** название, номер Companies House и адрес — точно как в подвале сайта (`site.config.json`).
4. **Описание продукта:** «Free-to-play social casino games (slot, European roulette, blackjack) played with a virtual currency (Carats) that has no monetary value, cannot be purchased, and cannot be exchanged for money, prizes or anything of value. Adults 18+ only. No sweepstakes or prize draws.»
5. **Где это видно проверяющему:** дисклеймер в первом экране главной; раздел «How Carats work»; Terms, раздел 4; каждая страница игры.
6. **18+:** age gate при первом визите; Responsible gaming — `/responsible-gaming/`.
7. **Покупки:** нет (при `purchases: true` тексты на сайте изменятся автоматически, это нужно отразить и в форме).
8. **Таргетинг:** в кампаниях исключить аудитории младше 18 и ставить объявления только на UK.
