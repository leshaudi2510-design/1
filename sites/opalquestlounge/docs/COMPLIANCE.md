# Чеклист соответствия: Opal Quest Lounge

Для каждого пункта указано, где он выполнен. Пути даны от папки `opalquestlounge/`. Ссылки ведут на функции, id и селекторы, а не на номера строк, чтобы документ не устаревал при каждой правке кода.

Отметки:

- ✅ — выполнено и проверяется сборкой (`node build.mjs`) или `tools/check.mjs`.
- ⚠️ — зависит от вас: реквизиты, решение владельца, проверка юристом или в инструментах Google.
- ❌ — не выполнено и блокирует запуск.

У сайта два режима (`pragmatic.enabled` в `site.config.json`, см. `README.md`). Где ответ зависит от режима, он дан для обоих:

- **Pragmatic** (`true`): 11 демо Pragmatic Play во фрейме плюс две наши игры на Carats.
- **Запасной** (`false` или `node build.mjs --no-pragmatic`): три наши игры на Carats (Seven Systems, Lapidary Wheel, Brilliant Twenty-One), ни одного чужого сервера. В сборке нет ни страниц Pragmatic, ни их скриптов (`pragmatic.js`, `pragmatic-url.js`), ни их share-картинок, ни адреса `pragmaticplay.net`: это проверяет lint сборки.

Это не юридическая консультация. Цитаты из правил ниже взяты из поисковых выдержек первоисточников: сами страницы Google, UKGC, ASA и pragmaticplay.com из среды разработки были недоступны. Перед тем как на них опираться, сверьте каждую цитату со страницей по ссылке.

## 0. Режим Pragmatic: блокеры до запуска

Пока пункты (a), (b) и (e) не закрыты, запускайте сайт с `"pragmatic": { "enabled": false }`. Ни один пункт этого раздела не считается выполненным, пока вы сами не впишете решение.

| # | Вопрос | Что известно | Что сделать | Статус |
|---|---|---|---|---|
| a | **Письменное согласие Pragmatic Play** | Terms of Use Pragmatic (редакция от 22 Apr 2026, https://www.pragmaticplay.com/en/terms-of-use/) дают лицензию только «for your own non-commercial entertainment purposes» и запрещают: «shall not use the Service or any portion thereof (including but in no way limited to any image, graphic, title) in conjunction with any other games, products, services or software without Pragmatic Play's express written consent». Публичной лицензии на встраивание демо нет. Лицензированный путь существует: B2B-договор (так Pragmatic работает с социальными платформами) или лицензированный агрегатор. | Получить письменное согласие Pragmatic или заключить B2B-договор. Записать сюда: **согласие получено: нет; от кого: —; дата: —; номер письма или договора: —**, а номер и дату — ещё и в `pragmatic.writtenConsent` в `site.config.json`: пока поле пустое, сборка в режиме Pragmatic предупреждает, а `node build.mjs --strict` падает. До этого — только `pragmatic.enabled: false`. | ❌ |
| b | **Google Ads: бренды реальных казино** | Политика «Gambling and games» (https://support.google.com/adspolicy/answer/15132179): «Ads, sites, or apps must not use logos, names, or marks associated with real-money gambling brands» и «Promotion of content which itself directly promotes engagement in social casino games, such as aggregators or affiliates, is not allowed». Названия игр Pragmatic — это бренды слотов реальных казино, а лобби из 11 чужих демо похоже на агрегатор. Прямого решения Google по такому сайту нет, но конфликт почти наверняка есть. С 14 Sep 2026 сертификация нужна во всех категориях gambling and games (https://support.google.com/adspolicy/answer/17199930). | Сертифицировать и рекламировать **только сборку с `pragmatic.enabled: false`** (см. ниже «Если реклама в Google Ads будет»). Либо не запускать Google Ads, пока включён режим Pragmatic. Мы **не заявляем**, что лобби Pragmatic соответствует этим правилам. С включёнными демо и заданным `analytics.adsConversionId` сборка предупреждает, а `--strict` падает. | ❌ для режима Pragmatic |
| c | **Проверка возраста** | На сайте самостоятельное подтверждение 18+: `<dialog id="age-gate">`, ответ «No» блокирует игры на устройстве на 30 дней. UKGC social responsibility code 3.2.11 с 7 May 2019 требует от лицензиатов проверять возраст до доступа к free-to-play версиям азартных игр (https://www.gamblingcommission.gov.uk/licensees-and-businesses/lccp/condition/3-2-11-remote-sr-code). В July 2019 UKGC напомнил лицензиатам, что они отвечают за free-to-play у аффилиатов. Эти условия обязывают лицензиата (Pragmatic Play (Gibraltar) Ltd), а не нас напрямую, но у Pragmatic может быть своя причина запретить непроверенный доступ к демо из UK. | Решение владельца, запишите его сюда: ☐ оставить самостоятельное подтверждение; ☐ подключить проверку возраста (например, AgeChecked). Решение: —, дата: —. Уточнить у юриста. | ⚠️ |
| d | **Какие игры исключены и почему** | Исключены **The Dog House**, **Sugar Rush** и **Starlight Princess**: их персонажи (мультяшные собаки, сладости в мультяшном стиле, аниме-принцесса) скорее всего сильно привлекают несовершеннолетних, что запрещает CAP 16.3.12 (с 1 Oct 2022). Ориентиры — решения ASA: Play'n GO (16 Jul 2025, жалоба удовлетворена: супергеройский пасхальный кролик, робот-диджей, аниме-принцессы) и Videoslots / Mr Vegas (2026: Pink Elephants 2 и Razor Returns нарушают правила). **Sweet Bonanza убрана 26 September 2026**: конфеты и леденцы, а строка спецификации о «candy themes» её исключает. В решении Videoslots / Mr Vegas ASA признала её рекламу приемлемой (конфетный текст, без персонажей), как и Big Bass Bonanza (реалистичный рыбак), но это снижает риск, а не снимает его. Подробно и что нужно для возврата — раздел 7. У каждой игры в `src/data/pragmatic-games.json` есть поле `appeal`; сборка отклоняет игру, если оно не `low` и не `medium`. | При добавлении игры оценивать её по тем же решениям ASA. Пересмотреть список при новых решениях ASA. | ⚠️ решение принято |
| e | **Факты о демо не сверены** | RTP, максимальная выплата, волатильность, раскладка и бонус собраны из вторичных источников. В `pragmatic-games.json` у каждой игры поле `verify` перечисляет неподтверждённые факты; на странице они помечены невидимым для посетителя `data-verify`; пока RTP игры в `verify`, страница называет его «Default reported at launch and in reviews», а не цифрой Pragmatic. Таблица на `/games/` повторяет раскладку, максимальную выплату и RTP без пометок. Сборка перечисляет непроверенные поля. | Пройти «Сверку демо Pragmatic» из `README.md` для всех 11 игр, записать дату в `"checked"` и убрать подтверждённые факты из `verify`. Цифру, которую подтвердить нельзя, поставить в `null`. `node build.mjs --strict` в режиме Pragmatic падает, пока хоть у одной игры нет `"checked"`. Сверено: **0 из 11**. | ❌ |
| f | **Хранилище после Play** | До нажатия Play браузер ничего не запрашивает у Pragmatic (проверяет `check.mjs`). После Play демо грузится с `demogamesfree.pragmaticplay.net`; Pragmatic и Google Analytics внутри демо могут ставить свои cookies и писать в хранилище под доменом Pragmatic. Сайт не может это контролировать или перечислить. На сайте это раскрыто: подпись у кнопки Play (`src/lib/ui/stage.mjs`, она же `aria-describedby` кнопки) говорит, что Pragmatic Play и Google Analytics внутри демо могут поставить cookies, со ссылкой на `/cookies/#third-party`; Cookie settings описывают демо отдельной строкой; Privacy, раздел `#demos`; Cookies, раздел `#third-party`; Terms, раздел `#demos`. Сохранённый выбор в cookie-баннере или в Cookie settings помнит и демо (`demos` в `lib/consent.js`): после «Reject all» каждая кнопка Play сначала спрашивает («Load demo and allow its cookies» / «Don't load it», `demosRefused()` в `games/pragmatic.js`); после «Accept all» и без выбора нажатие Play после уведомления считается просьбой о сервисе. Проверяет `check.mjs`. | Пункт PECR для юриста: достаточно ли уведомления и кнопки Play, или нужен отдельный запрос согласия до загрузки фрейма. | ⚠️ |
| g | **Товарные знаки** | В подвале каждой страницы: «Pragmatic Play and game names are trademarks of their owners; we are not affiliated. Megaways is a trademark of Big Time Gaming. Nobody named here endorses this site.» (сборка проверяет эту строку). В Terms (`#demos`): «We are not affiliated with or endorsed by Pragmatic Play.» Логотипов Pragmatic нет, обложки — наши рисунки. Названия игр написаны без ®/™, хотя у Pragmatic некоторые помечены (например, Sweet Bonanza®). | Спросить юриста, нужно ли ставить ®/™ так, как это делает Pragmatic. Не использовать названия Pragmatic в домене, бренде и ключевых словах рекламы. | ⚠️ |
| h | **Правила UK внутри демо** | Демо открывается с `jurisdiction=UK` и `cur=FUN` (`pragmatic.params` в конфиге). Что профиль UK на общем демо-хосте действительно убирает turbo и autoplay и держит спин не меньше 2,5 s (RTS 14), не проверено. Что `FUN` отображается нормально, тоже не проверено. | Проверить при сверке (README, шаги 3 и 4). | ⚠️ |

**Если реклама в Google Ads будет** (0(b)):

- рекламируйте домен, который **всем** посетителям отдаёт сборку `node build.mjs --no-pragmatic` (не старый `config-nopragmatic.json` из черновиков: там прежняя концепция и цвета);
- не показывайте проверяющим другую сборку по User-Agent, гео или рефереру: это клоакинг (пункт 1.9);
- не ставьте с этого домена ссылок на сайт в режиме Pragmatic;
- иначе получите письменное подтверждение Google при сертификации (она обязательна с 14 September 2026).

## 1. Google Ads: Gambling and games → Social casino games (UK)

| # | Требование | Где | Статус |
|---|---|---|---|
| 1.1 | Минимум 3 настоящие игры прямо на сайте, без iframe | **Запасной режим:** три наши игры на canvas: `src/public/assets/js/games/seven-systems.js`, `lapidary-wheel.js`, `brilliant-21.js`; ни одного `<iframe>`. **Режим Pragmatic:** две наши игры (Lapidary Wheel, Brilliant Twenty-One) плюс 11 сторонних демо. Демо идут во фрейме, который `pragmatic.js` создаёт только после нажатия Play; в самом HTML `<iframe>` нет (это проверяет сборка). Требование «без iframe» здесь не выполнено: владелец сознательно отменил его ради демо Pragmatic | ✅ запасной / ⚠️ Pragmatic |
| 1.2 | Только виртуальная валюта, без обмена на ценности, не sweepstakes | Carats живут только в localStorage (`lib/wallet.js`), их нельзя купить (`purchases: false`), продать или вывести. Terms, раздел `#carats`; главная, блок `#how`. Демо-кредиты Pragmatic тоже без ценности: Terms `#demos`, текст под сценой демо | ✅ |
| 1.3 | Дисклеймер в первом экране, у каждой игры, в подвале и в Terms | Текст — `DISCLAIMER` в `src/lib/context.mjs`. Лента `.age-notice` над шапкой каждой страницы (`ageNotice()` в `src/lib/layout.mjs`), подвал (`.colophon__disclaimer`), age gate, Terms. Сборка падает, если дисклеймера нет дословно хоть на одной странице или в ленте | ✅ |
| 1.4 | Никаких реальных казино и букмекеров; запрещённые слова | Ссылок на операторов нет. Сборка проверяет каждую страницу и каждый файл на deposit / withdraw / cash out / bonus code / real money wins / win big / jackpot / hurry / don't miss out, а также на сравнения игр между собой («the highest of the games here») (`FORBIDDEN` в `build.mjs`). **Режим Pragmatic:** на сайте названия слотов Pragmatic Play, то есть брендов, которые работают в реальных казино (см. 0(b)). Если демо не загрузилось, сцена честно говорит об этом и предлагает «Try again» и «Report a problem», но не ссылку на демо на сайте Pragmatic: там не действовали бы наши таймер сессии, reality check, лимиты и перерывы. Ни одна страница не содержит адреса, по которому демо открывается напрямую (`openGame.do`, проверяет сборка) | ✅ запасной / ⚠️ Pragmatic |
| 1.5 | 18+: подтверждение при первом входе | `<dialog id="age-gate">` в `dialogs()` (`src/lib/layout.mjs`); логика — `lib/age.js`, открывает вопрос маленький `age-boot.js` ещё до загрузки `app.js` (Escape не закрывает; если браузер всё же закроет вопрос без ответа — второй Escape в Chromium, жест «Назад» на Android, — ничего не сохраняется, игры остаются закрыты, а кнопка «Confirm my age» на игре спрашивает снова; ответ «No» блокирует игры на 30 дней). `rg.canPlay()` не даёт ставить без ответа «Yes» и не даёт загрузить демо (`BLOCKED.unconfirmed` в `games/pragmatic.js`). Это самостоятельное подтверждение, не проверка возраста: см. 0(c) | ✅ / ⚠️ 0(c) |
| 1.5 | Не привлекать несовершеннолетних (CAP/ASA) | Правило дизайна Ben-Day Brights: **только предметы и места, никаких персонажей**. Обложки всех игр — наши рисунки (`COVERS` в `src/lib/art.mjs`, у демо — поле `motif`), карты блэкджека с буквами вместо портретов (`drawCardFace` в `brilliant-21.js`), без маскотов, сленга и мемов. Игры с персонажами исключены (0(d)). **Режим Pragmatic:** после Play внутри фрейма показывается собственная графика Pragmatic, в которой есть персонажи (например, Zeus и Hades, Madame Destiny, рыбак в Big Bass). Её мы не контролируем | ✅ запасной / ⚠️ Pragmatic |
| 1.6 | Responsible gaming: 0808 8020 133 (GamCare), GamCare, NHS | `src/pages/responsible-gaming.mjs`; в подвале каждой страницы — GamCare 0808 8020 133 и ссылки (`footer()` в `src/lib/layout.mjs`, «Need to talk?»). GambleAware (BeGambleAware.org) закрылась 31 March 2026, её работу приняли NHS England, OHID и UKRI; поэтому вместо неё — GamCare (его самооценка) и страница NHS о помощи при игровой зависимости. Линию 0808 8020 133 по-прежнему ведёт GamCare. Сборка падает на ссылке на (be)gambleaware.org (`build.mjs`, lint). Это отход от п. 6 брифа, где назван BeGambleAware: нужно согласие владельца | ✅ / ⚠️ согласовать с владельцем |
| 1.6 | Таймер сессии | `[data-session]` в шапке; `lib/rg.js`, `lib/session.js` | ✅ |
| 1.6 | Напоминание о перерыве (reality check) | Каждые 15, 30 или 60 минут на выбор (`realityMinutes()` в `lib/rg.js`, по умолчанию 30). `<dialog id="reality-check-dialog">` показывает время, ставки и возврат за сессию и кнопку «Take a 5-minute break». Ставки и возврат считаются в Carats за наши игры; игра внутри демо Pragmatic в них не входит, и при включённых демо диалог так и говорит | ✅ |
| 1.6 | Лимит времени и перерывы | `rg.setLimit()`: снижение действует сразу, повышение — с завтрашнего дня; сохраняется только кнопкой (в Settings её подпись говорит, что произойдёт, например «Set 2 hours a day from tomorrow»), а не выбором в списке. Перерывы на 5 минут, 24 часа, 7 и 30 дней (`rg.startPause()`), досрочно не отменяются. Окончание перерыва, достижение лимита и полночь в открытой вкладке сразу обновляют игры и демо (`tick()` в `lib/rg.js` каждую секунду сравнивает ответ `canPlay()`). Когда начинается перерыв или срабатывает лимит, открытое демо Pragmatic закрывается (`games/pragmatic.js`) | ✅ |
| 1.7 | Покупки раскрыты, если есть | `purchases: false` в конфиге. Если включить, тексты на главной, в Terms и About переключатся автоматически | ✅ |
| 1.8 | Прозрачность оператора: компания, номер, адрес, email на About, Contact и в подвале | `operatorCard()` в `src/pages/about.mjs` (About и Contact); подвал (`footer()` в `src/lib/layout.mjs`); JSON-LD `Organization` с `identifier` (`organizationLd()`) | ⚠️ впишите реквизиты в `site.config.json` и соберите с `--strict` |
| 1.8 | Страницы Terms, Privacy, Cookies, Responsible gaming | `src/pages/terms.mjs`, `privacy.mjs`, `cookies.mjs`, `responsible-gaming.mjs`. Даты «Updated» — `legalUpdated` в конфиге | ✅ |
| 1.9 | Никакого клоакинга | Статический HTML, одинаковый для всех; нет проверок User-Agent, гео или реферера и нет редиректов; age gate — диалог поверх того же HTML | ✅ |
| 1.10 | Готовность к сертификации | См. «Форму сертификации» ниже и 0(b) | ⚠️ после деплоя |

**Честность механики наших игр** (сверх требований, но важно для проверяющих):

- Результат определяется до анимации: `crypto.getRandomValues` с rejection sampling (`lib/rng.js`).
- Ничего не подстраивается под баланс или время игры.
- RTP опубликован и посчитан кодом игры:
  - слот Seven Systems (запасной режим) — точно, перебором всех 39 304 комбинаций (`exactStats()` в `seven-systems.math.js`, 96.02%);
  - рулетка — 36 ÷ 37 (`rtpOf()` в `lapidary-wheel.math.js`, 97.30%);
  - блэкджек — симуляция 20 млн раздач basic strategy (`tools/simulate-21.mjs`, `TWENTY_ONE_RTP` в `src/lib/context.mjs`, около 99.6%).
- Нет «проигрышей под видом выигрышей»: если возврат меньше ставки, строка результата пишет «N down on this one» (`games/common.js`).
- Бесплатное пополнение без таймеров и давления: кнопка «Claim 1,000 free Carats» появляется при балансе ниже 100.
- Для демо Pragmatic мы RTP не считаем: цифры с их страниц нужно сверить (0(e)).

## 2. UK GDPR и PECR

| Требование | Где | Статус |
|---|---|---|
| До согласия нет необязательных cookies и сторонних скриптов | `lib/consent.js`: `gtag.js` вставляется только в `loadTag()` после согласия. `check.mjs` проверяет на всех страницах обоих режимов: до выбора ни одного запроса к чужим доменам | ✅ |
| До нажатия Play — ни одного запроса к Pragmatic | Сцена демо до Play — наш рисунок; фрейм создаёт `pragmatic.js` по кнопке `[data-action="load"]`. `check.mjs`: на всех страницах ничего не запрашивается у `*.pragmaticplay.net`, пока не нажат Play | ✅ |
| После Play | Браузер соединяется с `demogamesfree.pragmaticplay.net` (IP-адрес, данные браузера, адрес нашего сайта). CSP `frame-src` разрешает только хосты из `pragmatic.frameHosts`, в запасном режиме — `'none'` (проверяет сборка). CSP `connect-src` называет эти хосты только при включённых демо (`pragmatic.js` проверяет, что демо доступно). Раскрыто в подписи у кнопки Play, Privacy `#demos` и Cookies `#third-party`; после «Reject all» каждая кнопка Play сначала спрашивает. Cookies и хранилище Pragmatic и Google Analytics внутри демо — см. 0(f) | ✅ раскрыто / ⚠️ 0(f) |
| «Reject all» и «Accept all» одинаково заметны, есть «Manage» | Баннер `.consent-banner` и диалог `#consent` в `src/lib/layout.mjs` (кнопки одного класса); `check.mjs` сравнивает их стили | ✅ |
| Google Consent Mode v2, все сигналы по умолчанию `denied` | `lib/consent.js`: `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`, `functionality_storage`, `personalization_storage`, `security_storage` = `denied` | ✅ |
| Политики перечисляют всё хранилище, включая localStorage | Единый список `STORAGE` в `src/pages/cookies.mjs` выводится и в Cookies, и в Privacy; ключи совпадают с кодом (`lib/store.js`, префикс `oql.`) | ✅ |
| Отзыв согласия так же прост | «Cookie settings» в подвале каждой страницы (когда аналитика включена); при отказе cookies `_ga*` и `_gcl_*` удаляются | ✅ |
| Согласие не вечное | Повторный запрос через 12 месяцев (`MAX_AGE` в `consent.js`) | ✅ |
| Без аналитики — без баннера | Если `ga4` и `adsConversionId` пусты, баннер не рендерится, а CSP не пускает Google. **Запасной режим:** страницы не обращаются ни к одному чужому домену. **Режим Pragmatic:** ни к одному чужому домену до нажатия Play | ✅ |
| Контактная форма без стороннего обработчика | По умолчанию `mailto:`, на сайте данные не хранятся (`assets/js/contact.js`) | ✅ |
| ICO и права субъекта | `src/pages/privacy.mjs`, раздел `#rights` | ✅ |
| Дата изменения политик честная | Privacy обещает: «If we change this notice, we'll update the date at the top.» Даты — `legalUpdated` в конфиге; сборка предупреждает, если по истории git страница или решающие ключи конфига (`pragmatic.enabled`, `analytics`) менялись позже даты. После запуска о существенном изменении (например, новый сторонний поток данных) нужно ещё и сообщить на сайте, как обещает раздел `#changes` | ✅ / ⚠️ после запуска |

## 3. Google Search: spam policies и helpful content

| Требование | Где | Статус |
|---|---|---|
| Полезный контент | Наши игры (`src/pages/lapidary-wheel.mjs`, `brilliant-twenty-one.mjs`, `seven-systems.mjs`): How to play, таблица выплат с вероятностями, вывод RTP, полные правила, порядок 37 карманов, таблицы basic strategy (из той же функции, что подсказка в игре), история, FAQ. Страницы демо (`src/pages/pragmatic-game.mjs`): правила своими словами из `pragmatic-games.json`, факты — после сверки (0(e)) | ✅ / ⚠️ 0(e) |
| Уникальность при нескольких сайтах | Своя концепция, свои игры и тексты; ничего общего с Pixel Crown Club в этом же репозитории | ✅ |
| Без keyword stuffing | Тексты написаны для людей; одна формулировка title на страницу | ✅ |
| Семантика, один `h1`, логичные заголовки, хлебные крошки | Сборка падает, если `h1` ≠ 1; `<nav class="crumbs" aria-label="Breadcrumb">` на внутренних страницах (`breadcrumbs()` в `src/lib/layout.mjs`) | ✅ |
| JSON-LD: Organization, WebSite, VideoGame (`isAccessibleForFree: true`, `offers.price: 0`, `gamePlatform: "Web browser"`), BreadcrumbList | `organizationLd()`, `websiteLd()`, `videoGameLd()`, `breadcrumbLd()` в `src/lib/layout.mjs`; сборка проверяет обязательные поля и позиции крошек | ✅ / ⚠️ Rich Results Test после деплоя |
| `lang="en-GB"`, британская орфография, даты вида «26 September 2026» | `layout()`; `longDate()` в `src/lib/html.mjs`; сборка ищет американские написания (color, center, license, jewelry…); апострофы типографские (’), прямой ' в скриптах интерфейса роняет сборку, в остальном тексте его считает предупреждение (см. README, «Что проверяет сборка») | ✅ |
| Title ≤ 60, description ≤ 155, canonical, OG и Twitter 1200×630 | `layout()`; сборка проверяет длины и размеры картинок; своя OG-картинка у каждой игры (`assets/img/og-*.png`) | ✅ |
| robots.txt, sitemap.xml, своя 404, favicon, manifest | Генерирует `build.mjs`; 404 и offline — `src/pages/misc.mjs` (`noindex`); `favicon.svg` и `.ico`; `manifest.webmanifest` | ✅ |
| URL игры: `/games/{slug}/` | Режим Pragmatic: 11 демо (например, `/games/gates-of-olympus/`), `/games/lapidary-wheel/`, `/games/brilliant-twenty-one/`. Запасной: `/games/seven-systems/` и две таблицы. Плюс индекс `/games/` | ✅ |
| Интерстишиалы | Age gate юридически обязателен, это исключение в правилах Google; контент под ним тот же | ✅ |

## 4. WCAG 2.2 AA

| Критерий | Где | Статус |
|---|---|---|
| Контраст (1.4.3, 1.4.11) | Токены обеих тем в `src/styles/00-tokens.css`. axe-core: 0 нарушений в 168 прогонах (все страницы обоих режимов, обе темы, 1440 и 390 px, с открытыми диалогами, age gate, cookie-баннером и запущенным демо) | ✅ |
| Видимый фокус (2.4.7, 2.4.11) | `:focus-visible` во всех компонентах; `check.mjs` следит, чтобы фокус не терялся. На телефонах `scroll-padding-bottom` (`--dock-clear`, `src/styles/10-base.css`) не даёт фиксированному доку закрыть элемент в фокусе; cookie-баннер стоит первым в разметке и держит такой же отступ, пока виден (`lib/consent.js`) | ✅ |
| Игры полностью с клавиатуры (2.1.1) | Кнопки и радиогруппы ставок; стол рулетки — стрелки (roving focus), Enter и Backspace; горячие клавиши работают только при фокусе внутри игры (2.1.4). Сцена демо: Play, Close и Fullscreen — кнопки; управлять игрой внутри фрейма — дело Pragmatic | ✅ проверено `check.mjs` |
| Фокус не теряется во время раунда | Кнопки используют `aria-disabled`, а не `disabled` (`games/common.js`) | ✅ |
| Результаты через `aria-live` (4.1.3) | Строка результата с `aria-live="polite"`; canvas с `role="img"` и описанием; у сцены демо — `[data-status]`, у фрейма — `title` | ✅ |
| Цели ≥ 24×24 (2.5.8) | Кнопки ≥ 44 px; axe `target-size` проходит | ✅ |
| `prefers-reduced-motion` | Переходы и анимации отключаются; игры показывают результат без анимации | ✅ проверено `check.mjs` |
| `prefers-contrast: more` и forced colors | Отдельные правила в стилях | ✅ |
| Диалоги | Нативный `<dialog>`, фокус внутри, подписи через `aria-labelledby`; в каждом диалоге своя строка `role="status"`, куда `toast()` пишет, пока диалог открыт (снаружи всё inert) | ✅ |
| Прокручиваемые таблицы | `role="region"`, `tabindex="0"`, имя из `<caption>` (добавляет `build.mjs`) | ✅ |
| Символы в своих шрифтах | Всё, что рисует сайт, есть в наших шрифтах (`src/data/font-coverage.json`, проверяет сборка), поэтому «≈», «÷» или «ç» не выпадают в чужой шрифт. Маркер активной руки в Twenty-One — слова «(playing)», без особого символа | ✅ |

## 5. Core Web Vitals и бюджет

| Требование | Где | Результат |
|---|---|---|
| LCP < 2.0 s (мобильный 4G) | При первом визите (так приходят все из Google Ads) LCP-элемент — текст вопроса о возрасте: его открывает крошечный `age-boot.js` до загрузки модулей `app.js`, так что LCP ≈ FCP; после ответа — текст страницы (`h1` или лид). Preload двух шрифтов, `font-display: swap`; тема применяется встроенным скриптом по хешу CSP, без блокирующего запроса; `site.css` минифицируется при сборке | ✅ Lighthouse mobile (slow 4G, 4× CPU), 26 September 2026: 1.5–1.7 s на `/`, `/games/`, странице демо и Responsible gaming; 2.0 s на `/games/lapidary-wheel/` (самая тяжёлая страница: canvas-колесо) |
| INP < 150 ms | Игры рисуют на canvas через rAF, запуск игры — после первой отрисовки | ⚠️ только по полевым данным после запуска |
| CLS < 0.05 | У canvas заданы размеры (форму стола Twenty-One задаёт CSS до запуска скрипта); резерв строки результата; у сцены демо задана пропорция 16:10; фолбэк-шрифты с `size-adjust` и `ascent`/`descent-override`, разбитые по насыщенности и ширине (`src/styles/00-tokens.css`, генерирует `tools/font-fallbacks.mjs`) | ✅ < 0.05 на трёх страницах при 390 и 1440 px со шрифтами, задержанными на 1,2 s (`check.mjs`, раздел chrome); Lighthouse: 0–0.016 |
| HTML + CSS + JS первого экрана < 150 KB gzip | Считает и проверяет `build.mjs` | Режим Pragmatic: 61,7 KB (23 страницы); запасной: 67,8 KB (13 страниц) ✅ |
| Предзагрузка service worker | Только то, что обещает offline-страница; бюджет 220 KB gzip в `build.mjs` | Pragmatic: 185,5 KB (34 файла); запасной: 199,8 KB (36 файлов) ✅ |
| Шрифты: свои woff2, subset, swap, preload | `src/public/assets/fonts/`, `tools/subset-fonts.py` (из полных variable-шрифтов google/fonts, чтобы были ≈, ç и ÷; скрипт падает, если символа нет), хэш в имени файла; после нового subset — `node tools/font-fallbacks.mjs --measure` | ✅ |
| Кэш | Скрипты и стили в `/assets/v<хэш>/`, шрифты с хэшем — год `immutable`; `check.mjs` (раздел deploy) проверяет, что после деплоя вернувшийся посетитель с первого просмотра получает новые файлы | ✅ |
| Speculation Rules | `SPECULATION` в `src/lib/layout.mjs`: prerender `/games/*` (moderate), prefetch остального; таймеры и age gate ждут `prerenderingchange` (`whenActivated` в `lib/ui.js`) | ✅ |
| Lighthouse ≥ 95 | Lighthouse 12 по `dist/` (gzip), 26 September 2026 | ✅ mobile 99–100, desktop 100 во всех четырёх категориях на `/`, `/games/`, `/games/gates-of-olympus/`, `/games/lapidary-wheel/`, `/responsible-gaming/` |

Цифры бюджета — из вывода `node build.mjs` на 26 September 2026. После изменений берите их из вывода сборки, а не переписывайте руками.

## 6. Дизайн: Ben-Day Brights

| Приём | Где |
|---|---|
| Печатная палитра: process yellow, cyan, magenta, red и чёрный контур; две темы (Day и Night) по `prefers-color-scheme` или выбору в Settings | `src/styles/00-tokens.css` (константы печати, токены тем), встроенный скрипт `THEME_BOOT` в `src/lib/layout.mjs` (разрешён хешем в CSP) |
| Растровые точки Бен-Дэй и лучи | `radial-gradient` (точки) и `repeating-conic-gradient` (лучи) в стилях; CMYK-полоса в шапке (`.cmyk`) |
| «Звёзды»-вспышки | Inline SVG-спрайт (`SPRITE` в `src/lib/art.mjs`), без inline-стилей из-за CSP |
| Объёмные буквы | Archivo 900, расширенный по оси `wdth`, с «выдавленной» цветной подложкой из `text-shadow` (класс `.display`) |
| Обложки игр | Наши рисунки: предметы и места (`COVERS` в `src/lib/art.mjs`); цвета — сгенерированные правила CSS (`coverCss()`), потому что CSP не пускает inline-стили |
| Вариативные шрифты | Archivo (wght, wdth), Radio Canada (wght) |
| Современный CSS | `color-mix()`, `:has()`, `subgrid`, `text-wrap: balance`, Popover API (таблица выплат, уведомления), `<dialog>`, `dvh`, `env(safe-area-inset-*)` |
| Мобильный док, PWA, офлайн | `.dock`, `manifest.webmanifest`, `sw.js` |
| Вибрация и звук только по включению | `lib/haptics.js`, `lib/sound.js` (Web Audio, по умолчанию выключен) |

Чего **нет** по брифу: персонажей и маскотов, фейкового social proof, таймеров срочности и слов давления («hurry», «don't miss out»), эмодзи (масти карт нарисованы векторами).

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

**Сертифицируйте запасной режим.** Сборку с `pragmatic.enabled: true` почти наверняка отклонят по правилу о брендах реальных казино (0(b)), а без письменного согласия Pragmatic её нельзя и запускать (0(a)).

При подаче понадобятся:

1. **Домен:** `opalquestlounge.com` (все страницы доступны без входа).
2. **Страна:** United Kingdom.
3. **Юрлицо:** название, номер Companies House и адрес — точно как в подвале сайта (`site.config.json`).
4. **Описание продукта.**
   - **Запасной режим (подавать этот текст):** «Free-to-play social casino games (a slot, European roulette and blackjack) that we make ourselves, played with a virtual currency (Carats) that has no monetary value, cannot be purchased, and cannot be exchanged for money, prizes or anything of value. Adults 18+ only. No sweepstakes or prize draws.»
   - **Режим Pragmatic (только для справки, если владелец всё же решит подавать; скорее всего будет отклонён по правилу «must not use logos, names, or marks associated with real-money gambling brands»):** «Slot demos by Pragmatic Play, played with demo credits that have no value, plus our own European roulette and blackjack played with a virtual currency (Carats) that has no monetary value, cannot be purchased, and cannot be exchanged for money, prizes or anything of value. Adults 18+ only. No sweepstakes or prize draws.»
5. **Где это видно проверяющему:** дисклеймер в ленте над шапкой каждой страницы; блок «How it works» на главной; Terms, разделы `#carats` и `#who-can-play`; каждая страница игры.
6. **18+:** age gate при первом визите (самостоятельное подтверждение, см. 0(c)); Responsible gaming — `/responsible-gaming/`.
7. **Покупки:** нет (при `purchases: true` тексты на сайте изменятся автоматически, это нужно отразить и в форме).
8. **Таргетинг:** в кампаниях исключить аудитории младше 18 и ставить объявления только на UK.
