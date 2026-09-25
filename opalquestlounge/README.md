# Opal Quest Lounge

Сайт бесплатного социального казино для **opalquestlounge.com** (аудитория — Великобритания).
Три собственные игры на виртуальные **Carats**. Реальных денег, призов и покупок нет. Только 18+.

> Free-to-play social casino game. No real-money gambling and no prizes of real-world value. For adults 18+.

## Концепция

**Викторианский минералогический кабинет.** Из неё выведено всё остальное:

| Что | Как |
|---|---|
| Палитра (OKLCH) | Whitby jet (сине-чёрный), бумага этикеток, potch (серый опал), garnet, malachite, lapis |
| Две темы | *Daylight label*: чернила на бумаге. *Velvet tray*: этикетки на ювелирном бархате, камни «под лампой». Каждая тема собрана отдельно, это не инверсия |
| Шрифты | Bodoni Moda (opsz + wght): заголовки. Geologica (wght + SHRP): текст, у кнопок при наведении растёт ось «острота граней». Martian Mono (wdth + wght): цифры |
| Валюта | **Carats**. Карат — ювелирная мера веса, 1/5 грамма |
| Игры | **Seven Systems**: слот из рисунков кристаллов семи сингоний, опал аморфен и потому wild. **Lapidary Wheel**: европейская рулетка, колесо нарисовано как огранённый камень сверху; garnet = красное, jet = чёрное, malachite = зеро. **Brilliant Twenty-One**: блэкджек, натуральные 21 называются Brilliant (по бриллиантовой огранке) |
| Термины | specimen No., crystal system, Mohs hardness, cabochon, lapidary, play-of-colour, harlequin |
| Звук (по включению) | Web Audio: удар камня о камень, «хрустальный» аккорд из негармонических обертонов, шорох карты |

**Одно смелое решение.** Весь сайт — только jet и бумага. Единственный полноцветный элемент — **опал**: живой WebGL-шейдер
с мозаикой play-of-colour (harlequin). Он реагирует на указатель, наклон телефона и прокрутку.
На свету это белый опал, на бархате — чёрный. Когда игра возвращает **больше** поставленного, опал вспыхивает.
Конфетти нет. Если возврат меньше ставки, праздника нет: результат честно пишет «N down».

## Дерево файлов

```
opalquestlounge/
├── site.config.json          ← бренд, домен, оператор, аналитика, дата обновления
├── build.mjs                 ← сборка без зависимостей: dist/ + линт соответствия
├── package.json              ← скрипты; playwright и sharp нужны только инструментам
├── README.md, COMPLIANCE.md
├── src/
│   ├── lib/                  ← шаблоны: layout (head, JSON-LD, CSP, диалоги), панели игр, иконки
│   ├── pages/                ← по файлу на страницу (главная, 3 игры, /games/, about, RG, terms, privacy, cookies, contact, 404, offline)
│   ├── sw.template.js        ← service worker (офлайн), список файлов подставляет сборка
│   └── public/               ← копируется в dist как есть
│       ├── favicon.svg, favicon.ico
│       └── assets/
│           ├── css/site.css  ← вся дизайн-система
│           ├── fonts/        ← 4 woff2, subset латиницы, ~108 KB всего
│           ├── icons/, img/  ← иконки PWA, OG 1200×630, превью игр AVIF/WebP
│           └── js/
│               ├── app.js    ← точка входа
│               ├── lib/      ← store, rng, wallet, session, rg (лимиты), age, consent, settings, sound, haptics, opal (WebGL), crystals
│               └── games/    ← *.math.js — чистая математика (её же импортирует сборка), *.js — canvas-интерфейс
└── tools/
    ├── check.mjs             ← e2e: 3 ширины, клавиатура, согласие, сторонние запросы
    ├── make-images.mjs       ← иконки, OG, превью из настоящих игр
    ├── simulate-21.mjs       ← Монте-Карло RTP блэкджека
    ├── subset-fonts.py       ← subset и обрезка осей шрифтов
    └── serve.mjs             ← локальный сервер как у хостинга (gzip, 404)
```

## Перед запуском: заполнить `site.config.json`

```jsonc
"operator": {
  "companyName": "…Ltd",                 // как в Companies House
  "companyNumber": "12345678",
  "registeredIn": "England and Wales",
  "address": "…, United Kingdom",
  "email": "hello@opalquestlounge.com"   // ящик должен реально принимать почту
},
"analytics": { "ga4": "", "adsConversionId": "" },  // пусто — баннера нет, сторонних запросов нет
"contactEndpoint": "",                               // пусто — форма открывает почтовый клиент (mailto)
"lastUpdated": "2026-09-25"                          // дата в подвале, Terms, Privacy и sitemap
```

Пока в полях оператора стоят `[…]`, сборка печатает предупреждения. `node build.mjs --strict` превращает их в ошибки: используйте его при деплое.

Юридические тексты (Terms, Privacy, Cookies) написаны под текущую конфигурацию, но это не юридическая консультация. Перед запуском их должен посмотреть юрист.

## Команды

```bash
cd opalquestlounge
node build.mjs            # собрать dist/ и проверить (Node 20+, без npm install)
node tools/serve.mjs      # http://localhost:8080

npm install               # только для инструментов ниже (playwright, sharp)
npm run check             # e2e-проверки в Chromium
npm run images            # перегенерировать иконки, OG и превью (затем снова build)
npm run simulate:21       # 20 млн раздач блэкджека
```

Сборка сама проверяет: один `h1` на страницу, title ≤ 60 и description ≤ 155 символов, `lang="en-GB"`, canonical,
дисклеймер на каждой странице, валидность JSON-LD (VideoGame, BreadcrumbList), битые ссылки, запрещённые слова
(deposit, withdraw, cash out, bonus code, real money wins, win big, jackpot, hurry, don't miss out),
американскую орфографию, бюджет первого экрана (HTML + CSS + JS < 150 KB gzip).

## Деплой

### Вариант 1. Cloudflare Pages (рекомендую)

Он отдаёт заголовки безопасности из `dist/_headers`: CSP, HSTS, `frame-ancestors`, кэш шрифтов на год.

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

В этом репозитории GitHub Pages уже раздаёт Pixel Crown Club из корня ветки. На один репозиторий GitHub Pages даёт один сайт,
поэтому для GitHub Pages вынесите `opalquestlounge/` в отдельный репозиторий. Либо переключите Pages этого репозитория на GitHub Actions: тогда Pixel Crown Club перестанет публиковаться отсюда.

1. Settings → Pages → Source: **GitHub Actions**.
2. Actions → **Deploy Opal Quest Lounge to GitHub Pages** → Run workflow (файл `.github/workflows/opalquestlounge-pages.yml`).
   Сборка кладёт в `dist/` файл `CNAME` с доменом.
3. DNS у регистратора:

| Тип | Имя | Значение |
|---|---|---|
| A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| CNAME | `www` | `<ваш-логин>.github.io` |

4. После проверки DNS включить **Enforce HTTPS**.

GitHub Pages не умеет свои заголовки. CSP работает через `<meta http-equiv>` в каждой странице, но HSTS и `frame-ancestors` там недоступны.

### После деплоя

- [Rich Results Test](https://search.google.com/test/rich-results) для `/` и страниц игр. Из этой среды Google-инструменты недоступны; локально сборка проверяет структуру JSON-LD.
  Замечание: Google показывает rich result «Software App» только при наличии `aggregateRating` или `review`. Мы их **не выдумываем**
  (это был бы фейковый social proof), поэтому тест покажет VideoGame как валидную разметку без этого расширенного сниппета.
  BreadcrumbList, Organization и WebSite от этого не зависят.
- Search Console: добавить домен, отправить `https://opalquestlounge.com/sitemap.xml`.
- PageSpeed Insights по живому домену, чтобы увидеть полевые данные CWV.
- Google Ads → сертификация **Social casino games** для UK: что вписать в форму, см. `COMPLIANCE.md`.

## Проверки, которые уже пройдены

Все проверки выполнены на `dist/` через `tools/serve.mjs` (gzip, как на хостинге), Chromium 141, 25 September 2026.

| Проверка | Результат |
|---|---|
| Lighthouse, mobile (slow 4G, 4× CPU) | Performance 99–100, Accessibility 100, Best Practices 100, SEO 100 на всех 11 страницах. Страницу 404 Lighthouse не проверяет, потому что она отдаёт HTTP 404; её проверяют axe и `check.mjs` |
| Lighthouse, desktop | 100 / 100 / 100 / 100 на всех 11 страницах |
| Лабораторные CWV на мобильном | LCP 1.5–1.9 s, CLS 0–0.001, TBT 0–20 ms |
| Бюджет первого экрана | ~49 KB gzip (HTML + CSS + 19 JS-модулей) из 150 KB |
| axe-core, WCAG 2.2 AA + best practices | 0 нарушений на всех 12 страницах, в обеих темах, с открытыми меню, таблицей выплат, настройками, cookie-диалогом, age gate |
| `tools/check.mjs` | 360 / 768 / 1440 px без горизонтальной прокрутки; все игры пройдены только с клавиатуры; фокус не теряется; до согласия нет ни одного запроса к третьим сторонам и ни одной cookie; Consent Mode v2 — все 7 сигналов `denied`; «Reject all» и «Accept all» визуально равны; gtag.js грузится только после «Accept all» |

Эти цифры лабораторные. Реальный INP и полевые CWV покажут PageSpeed Insights и Search Console после запуска.

## Обновления

- Поменяли тексты → обновите `lastUpdated` и пересоберите.
- Версия service worker считается из содержимого файлов, поэтому установленное приложение обновится само.
- Поменяли игру или бренд → `npm run images`, затем `node build.mjs`.
