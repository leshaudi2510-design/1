# Opal Quest Lounge

Сайт бесплатного социального казино для **opalquestlounge.com** (аудитория — Великобритания). Реальных денег, призов и покупок нет. Только 18+.

У сайта два режима, их переключает `pragmatic.enabled` в `site.config.json`:

| Режим | Что на сайте |
|---|---|
| **Pragmatic** (`true`, сейчас в конфиге) | 12 демо-слотов Pragmatic Play. Каждое демо открывается во фрейме, который создаётся только после нажатия кнопки «Play … demo»; до этого браузер ничего не запрашивает у Pragmatic. Демо играют на демо-кредитах Pragmatic, у которых нет ценности. Плюс две наши игры на виртуальные **Carats**: рулетка Lapidary Wheel и блэкджек Brilliant Twenty-One. |
| **Запасной** (`false`) | Три наши игры на Carats: слот Seven Systems, Lapidary Wheel и Brilliant Twenty-One. Сайт не обращается ни к одному чужому серверу. |

> ⚠️ **Режим Pragmatic пока нельзя запускать.** Нет письменного согласия Pragmatic Play, а правила Google Ads о брендах реальных казино почти наверняка не позволят сертифицировать такое лобби. Все блокеры перечислены в начале `COMPLIANCE.md`. Пока они не закрыты, запускайте сайт с `"pragmatic": { "enabled": false }`.

Дисклеймер стоит на каждой странице дословно:

> Free-to-play social casino game. No real-money gambling and no prizes of real-world value. For adults 18+.

## Концепция: Ben-Day Brights

Поп-арт печать, которая играет как лобби слотов. Из этой идеи выведено всё остальное:

| Что | Как |
|---|---|
| Палитра | Триадные краски печати (process yellow, cyan, magenta, red) и чёрный «типографский» контур. Растровые точки Бен-Дэй, «звёзды»-вспышки и объёмные буквы. Две темы: Day и Night (Settings → Theme: Match device, Day, Night) |
| Рисунки | **Только предметы и места, никаких персонажей**: ни маскотов, ни мультяшных зверей, ни принцесс (CAP 16.3.12, см. `COMPLIANCE.md`). Обложки всех игр, включая демо Pragmatic, — наши рисунки (`COVERS` в `src/lib/art.mjs`), а не логотипы или арт Pragmatic |
| Шрифты | **Archivo** (заголовки, интерфейс, цифры; оси wght 500–900 и wdth 100–125) и **Radio Canada** (текст; wght 400–700). Свои subset-файлы woff2, вместе около 48 KB |
| Валюта | **Carats**. Карат — ювелирная мера веса, 1/5 грамма. Демо Pragmatic играют на своих демо-кредитах, это не Carats |
| Наши игры | **Lapidary Wheel**: европейская рулетка с одним зеро, колесо нарисовано как огранённый камень. **Brilliant Twenty-One**: блэкджек на шесть колод, натуральные 21 называются Brilliant и платят 3 к 2, есть подсказка по basic strategy. **Seven Systems** (только запасной режим): слот на три барабана и пять линий из рисунков кристаллов семи сингоний, опал — wild |
| Звук | Web Audio, только после включения в настройках |

## Дерево файлов

```
opalquestlounge/
├── site.config.json          ← бренд, домен, оператор, аналитика, даты, режим Pragmatic
├── build.mjs                 ← сборка без зависимостей: dist/ + линт
├── package.json              ← скрипты; playwright, axe-core и sharp нужны только инструментам
├── README.md, COMPLIANCE.md
├── src/
│   ├── data/
│   │   ├── pragmatic-games.json   ← 12 демо Pragmatic: факты, "verify", "checked"
│   │   └── font-coverage.json     ← символы, которые есть в наших шрифтах (пишет subset-fonts.py)
│   ├── lib/                  ← context (игры, режимы), layout (head, JSON-LD, CSP, шапка, подвал,
│   │                            диалоги), art (обложки и спрайт), icons, html, ui/ (stage, tables, tiles)
│   ├── pages/                ← по файлу на страницу: главная, /games/, pragmatic-game (шаблон 12 страниц
│   │                            демо), 3 наши игры, about, responsible-gaming, terms, privacy, cookies,
│   │                            contact, misc (404 и offline)
│   ├── styles/               ← CSS частями (00-tokens … 95-prefs); сборка склеивает их в один site.css
│   ├── sw.template.js        ← service worker (офлайн); список файлов подставляет сборка
│   └── public/               ← копируется в dist/
│       ├── favicon.svg, favicon.ico
│       └── assets/
│           ├── fonts/        ← archivo.woff2, radio-canada.woff2, OFL.txt
│           ├── icons/, img/  ← иконки PWA и OG-картинки 1200×630 (своя у каждой игры)
│           └── js/
│               ├── app.js    ← точка входа; contact.js — форма
│               ├── lib/      ← store, rng, wallet, session, rg (лимиты, перерывы, reality check), age,
│               │                consent, settings, sound, haptics, format, ui, lobby (фильтры),
│               │                pragmatic-url, crystals
│               └── games/    ← pragmatic.js (сцена демо); *.math.js — чистая математика (её же
│                                импортирует сборка); *.js — интерфейс на canvas; common.js
└── tools/
    ├── check.mjs             ← e2e-проверки в Chromium (разделы ниже)
    ├── lib/                  ← harness (сборки, сервер, браузер), headers (_headers как у Cloudflare),
    │                            glyphs (какие символы рисует сайт)
    ├── make-images.mjs       ← иконки и OG-картинки из собранного сайта
    ├── simulate-21.mjs       ← Монте-Карло RTP блэкджека
    ├── subset-fonts.py       ← subset шрифтов и font-coverage.json
    └── serve.mjs             ← локальный сервер с тем же Cache-Control, что у хостинга
```

## Перед запуском: `site.config.json`

```jsonc
"operator": {
  "companyName": "…Ltd",                 // как в Companies House
  "companyNumber": "12345678",
  "registeredIn": "England and Wales",
  "address": "…, United Kingdom",
  "email": "hello@opalquestlounge.com"   // ящик должен реально принимать почту
},
"analytics": { "ga4": "", "adsConversionId": "" },  // пусто — нет баннера и нет запросов к Google
"contactEndpoint": "",                  // пусто — форма открывает почтовый клиент (mailto)
"lastUpdated": "2026-09-26",            // «Page last updated» в подвале, About, JSON-LD, sitemap
"legalUpdated": {                       // своя дата «Updated» у Terms, Privacy и Cookies
  "terms": "2026-09-26", "privacy": "2026-09-26", "cookies": "2026-09-26"
},
"pragmatic": {
  "enabled": true,                      // false — запасной режим (наш слот Seven Systems вместо демо)
  "featured": "gates-of-olympus",       // необязательно: демо на главной
  "demoUrl": "https://demogamesfree.pragmaticplay.net/gs2c/openGame.do",
  "params": { "lang": "en", "cur": "FUN", "jurisdiction": "UK",
              "websiteUrl": "https://demogamesfree.pragmaticplay.net" },
  "frameHosts": ["https://demogamesfree.pragmaticplay.net"]   // уходит в CSP frame-src
}
```

- Пока в полях оператора стоят `[…]`, сборка печатает предупреждения. `node build.mjs --strict` превращает их в ошибки.
- В режиме Pragmatic `--strict` ещё и падает, пока хоть у одного демо нет даты `"checked"` в `src/data/pragmatic-games.json` (см. «Сверка демо Pragmatic» ниже). Так и задумано: непроверенные цифры не должны уйти в прод.
- Поменяли тексты страниц → обновите `lastUpdated`. Поменяли Terms, Privacy или Cookies → обновите их дату в `legalUpdated`. Даты нужны и тогда, когда тексты меняются от конфига: включили или выключили `pragmatic.enabled`, добавили `analytics.ga4`. Если по истории git страница менялась позже своей даты, сборка напишет предупреждение.

Юридические тексты (Terms, Privacy, Cookies) написаны под текущую конфигурацию, но это не юридическая консультация. Перед запуском их должен посмотреть юрист.

## Команды

```bash
cd opalquestlounge
node build.mjs                    # собрать dist/ и проверить (Node 20+, без npm install)
node build.mjs --no-pragmatic     # то же в запасном режиме
SITE_CONFIG=path/to/config.json OUT_DIR=/tmp/out node build.mjs   # другой конфиг и папка
node build.mjs --strict           # сборка для запуска (см. выше)
node tools/serve.mjs dist 8080    # http://localhost:8080

npm install                       # только для инструментов ниже (playwright, axe-core, sharp)
npm run check                     # e2e-проверки в Chromium (все разделы, около 3 минут)
npm run check -- --only=offline,deploy   # только часть разделов (список — SECTIONS в check.mjs)
npm run images                    # перерисовать иконки и OG-картинки (затем снова build)
npm run simulate:21               # 20 млн раздач блэкджека

pip install fonttools brotli      # только для шрифтов
python3 tools/subset-fonts.py path/to/folder-with-ttf   # см. начало скрипта
```

CI (`.github/workflows/opalquestlounge-ci.yml`) собирает три варианта: конфиг как есть, запасной режим и копию с тестовым GA4 ID. Любая ошибка линта роняет сборку.

## Что проверяет сборка

`build.mjs` заканчивается строкой `Lint: no problems found.` или падает. Проверяются:

- один `h1` на страницу, title ≤ 60 и description ≤ 155 символов, `lang="en-GB"`, canonical, валидный JSON-LD (VideoGame, BreadcrumbList);
- дисклеймер дословно на каждой странице и в ленте `.age-notice` над шапкой;
- битые ссылки и якоря, повторяющиеся id, ссылки `aria-*` на несуществующие id;
- разметка под CSP: ни одного `style="…"`, `<style>`, inline-скрипта или обработчика `on…`; ничего не грузится с чужого домена до действия посетителя;
- запрещённые слова (deposit, withdraw, cash out, bonus code, real money wins, win big, jackpot, hurry, don't miss out) и американская орфография;
- **символы**: всё, что сайт рисует (текст страниц, строки в скриптах, CSS), должно быть в наших шрифтах (`src/data/font-coverage.json`), иначе браузер нарисует символ чужим шрифтом;
- CSP `frame-src` в каждом режиме, разметка сцены демо, данные `pragmatic-games.json` (включая поля `verify` и `checked`);
- фильтры лобби у наших игр: только настоящие признаки (у наших игр нет free spins, tumble и Megaways);
- даты `lastUpdated` и `legalUpdated`;
- версии в адресах скриптов и стилей, заголовки `_headers` (ровно один `max-age` на файл);
- бюджеты: первый экран главной ≤ 150 KB gzip, предзагрузка service worker ≤ 220 KB gzip.

## Кэш, офлайн и обновления

- Скрипты и стили публикуются в папке `/assets/v<хэш>/`. Хэш считается по всем скриптам, стилям и `config.js`, поэтому любое изменение, включая смену аналитики или адреса формы, даёт новые адреса. Шрифты получают хэш в имени (`archivo.<хэш>.woff2`). Такие файлы кэшируются на год (`immutable`): вернувшийся посетитель никогда не получит старый скрипт к новой странице.
- В исходниках пути обычные (`/assets/js/app.js`), папку с версией подставляет сборка.
- Service worker (`sw.js`, всегда `no-cache`) заранее сохраняет то, что обещает страница offline: главную, наши игры, Responsible gaming и саму offline-страницу со всеми их скриптами, стилями и шрифтами. Остальные страницы сохраняются при посещении, страница входа — сразу после установки. Страницы демо Pragmatic без сети всё равно не работают, их нет в предзагрузке.
- Версия service worker — хэш всех файлов, которые он сохраняет, поэтому после любого изменения он обновится сам. Предыдущий кэш он хранит одно поколение: вкладка, открытая до деплоя, догрузит свои старые скрипты оттуда.
- Поменяли игру или бренд → `npm run images`, затем `node build.mjs`.
- Перегенерировали шрифты → просто пересоберите: новое имя файла сборка даст сама.

## Сверка демо Pragmatic перед запуском

Факты о демо (RTP, максимальная выплата, волатильность, раскладка, бонус) собраны из вторичных источников: pragmaticplay.com из среды сборки был недоступен. Поле `verify` у игры перечисляет факты, которые подтвердить не удалось. На странице они помечены атрибутом `data-verify`, но посетитель этой пометки не видит. Поэтому перед запуском режима Pragmatic нужно пройти эти шаги, минут десять на игру, из браузера в Великобритании:

1. Открыть страницу демо и нажать «Play … demo». Демо должно загрузиться во фрейме.
2. Во вкладке Network посмотреть цепочку редиректов, заголовки `X-Frame-Options` и `frame-ancestors`, а также `Set-Cookie` у `openGame.do` и `html5Game.do`.
3. Проверить, что `cur=FUN` отображается нормально. Если нет, поставить `GBP` в `pragmatic.params.cur`.
4. Проверить, что с `jurisdiction=UK` нет turbo и autoplay, а спин длится не меньше 2,5 секунды.
5. Проверить, что делает кнопка Home в демо и приходит ли сообщение `omni-api.goTo`.
6. Открыть i-экран игры и сверить с ним **все** цифры на нашей странице, начиная с полей из `verify`, и таблицу на `/games/`.
7. Если всё сошлось, записать дату в поле игры: `"checked": "2026-10-01"`. Цифру, которую подтвердить нельзя, поставить в `null` (строка в таблице фактов пропадёт, а в лобби будет написано «Not listed»). Не угадывать.

Пока у какой-либо игры нет `"checked"`, `node build.mjs --strict` падает в режиме Pragmatic. Другой выход — запускаться в запасном режиме.

## Деплой

### Вариант 1. Cloudflare Pages (рекомендую)

Он отдаёт заголовки из `dist/_headers`: CSP, HSTS, `frame-ancestors`, год кэша для файлов с версией и шрифтов, час — для остального в `/assets/`, `no-cache` для `sw.js`. Cloudflare применяет все подходящие правила сразу и склеивает одинаковые заголовки через запятую. Поэтому в `_headers` общее правило `/assets/*` стоит первым, а у частных правил перед своим значением стоит строка `! Cache-Control`. Сборка проверяет, что у каждого файла ровно один `max-age`.

1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → этот репозиторий.
2. Настройки сборки:
   - **Root directory:** `opalquestlounge`
   - **Build command:** `node build.mjs --strict`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION = 22`
3. Custom domains → добавить `opalquestlounge.com` и `www.opalquestlounge.com`.

**DNS.** Проще всего перенести домен в Cloudflare: у регистратора поменять NS на те два, что выдаст Cloudflare. Записи для Pages он создаст сам.
Если DNS остаётся у регистратора:

| Тип | Имя | Значение |
|---|---|---|
| CNAME | `www` | `<проект>.pages.dev` |
| CNAME / ALIAS / ANAME | `@` | `<проект>.pages.dev` (если регистратор не умеет CNAME на корень, переносите NS в Cloudflare) |

Редирект `www → opalquestlounge.com`: Rules → Redirect Rules → «Redirect from WWW to root». Это редирект для всех, по хосту, не по гео и не по User-Agent.

### Вариант 2. GitHub Pages

Корень этого репозитория занят сайтом Pixel Crown Club (его README предлагает публиковать корень ветки через GitHub Pages).
GitHub Pages даёт один сайт на репозиторий. Поэтому либо публикуйте отсюда Opal Quest Lounge через GitHub Actions (тогда Pixel Crown Club
нужно будет публиковать где-то ещё), либо вынесите `opalquestlounge/` в отдельный репозиторий.

1. Settings → Pages → Source: **GitHub Actions**.
2. Actions → **Deploy Opal Quest Lounge to GitHub Pages** → Run workflow (файл `.github/workflows/opalquestlounge-pages.yml`, собирает с `--strict`).
   Сборка кладёт в `dist/` файл `CNAME` с доменом.
3. DNS у регистратора:

| Тип | Имя | Значение |
|---|---|---|
| A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| CNAME | `www` | `<ваш-логин>.github.io` |

4. После проверки DNS включить **Enforce HTTPS**.

GitHub Pages не умеет свои заголовки. CSP работает через `<meta http-equiv>` в каждой странице, но HSTS и `frame-ancestors` там недоступны, а все файлы кэшируются на 10 минут. Адреса с версией всё равно не дают смешать старое и новое.

### После деплоя

- [Rich Results Test](https://search.google.com/test/rich-results) для `/` и страниц игр. Из этой среды Google-инструменты недоступны; локально сборка проверяет структуру JSON-LD.
  Замечание: Google показывает rich result «Software App» только при наличии `aggregateRating` или `review`. Мы их **не выдумываем**
  (это был бы фейковый social proof), поэтому тест покажет VideoGame как валидную разметку без этого расширенного сниппета.
  BreadcrumbList, Organization и WebSite от этого не зависят.
- Search Console: добавить домен, отправить `https://opalquestlounge.com/sitemap.xml`.
- PageSpeed Insights и Lighthouse по живому домену (см. ниже: после редизайна они ещё не перемерены).
- Google Ads → сертификация **Social casino games** для UK: что вписать в форму и какой режим сертифицировать, см. `COMPLIANCE.md`.

## Проверки, которые уже пройдены

Цифры ниже взяты из вывода `node build.mjs` и `node tools/check.mjs` на 26 September 2026 (Chromium из Playwright 1.56). Не переписывайте их руками: после изменений запустите обе команды заново и возьмите цифры из вывода.

| Проверка | Результат |
|---|---|
| Сборка, режим Pragmatic | 24 страницы; первый экран главной 59,3 KB gzip (HTML + CSS + 16 JS-модулей) из 150 KB; предзагрузка service worker 34 файла, 180,0 KB gzip из 220 KB |
| Сборка, запасной режим | 13 страниц; первый экран 66,5 KB gzip (19 JS-модулей); предзагрузка 36 файлов, 195,9 KB gzip |
| `tools/check.mjs` | 167 проверок, 0 ошибок. Разделы: все страницы на 360, 768 и 1440 px в обоих режимах (без горизонтальной прокрутки, без ошибок, без запросов к чужим доменам, ничего от pragmaticplay.net до Play); сцена демо с заглушкой вместо сервера Pragmatic; все наши игры только с клавиатуры; фильтры лобби; согласие на cookies с тестовым GA4 ID (Consent Mode v2, «Reject all» и «Accept all» равны, gtag.js только после «Accept all»); диалоги; reduced motion и тёмная тема; офлайн; деплой (вернувшийся посетитель с первого просмотра получает новые скрипты и стили, с service worker и без него) |
| axe-core, WCAG 2.2 AA + best practices | 0 нарушений в 172 прогонах: все страницы обоих режимов, обе темы, 1440 и 390 px, с открытыми диалогами, age gate, cookie-баннером и запущенным демо |
| Lighthouse и лабораторные CWV | **Не перемерены после редизайна Ben-Day Brights.** Прежние цифры относились к старому дизайну. Прогоните Lighthouse (mobile и desktop) по `dist/` через `tools/serve.mjs` или по живому домену и впишите сюда. Цели брифа: LCP < 2,0 s, INP < 150 ms, CLS < 0,05, Lighthouse ≥ 95 |

Реальный INP и полевые CWV покажут PageSpeed Insights и Search Console после запуска.
