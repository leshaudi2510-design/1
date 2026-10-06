<!--
Шаблон sites/<slug>/docs/README.md (русский). Заполняет tools/docs.mjs (Phase 3); образец — opalquestlounge/README.md.
Грамматика (contract-change request 30): {{path}} — значение из контекста; {{table:<name>}} — сгенерированная таблица;
{{list:<name>}} — сгенерированный список; {{include:<name>}} — фрагмент, который находит контекст (сначала папка docs пакета
типа, затем engine/docs/templates/fragments/ — эта папка появится вместе с tools/docs.mjs в Phase 3). Незаполненный плейсхолдер — ошибка `tools/docs.mjs --validate`.
Ключи контекста: те же, что в README.en.md (brand, domain, slug, type, typeLabel, variant, market, locales, generatedAt, commit,
  engineVersion, buildVersion, concept.title, concept.summary, operator.name, hosting, deploy.provider, deploy.project).
Таблицы: concept, configTodo, results. Списки: lintRules, caching, ownerTodo. Фрагменты: intro, modes, hosting, afterDeploy
(в русской версии контекст подставляет фрагменты *.ru.md).
Правило: ни бренды, ни палитры, ни описания других сайтов студии (concept.json.siblings/antiReferences) сюда не попадают.
-->
# {{brand}}

{{typeLabel}} для **{{domain}}** (рынок: {{market}}; языки: {{locales}}). Собран фабрикой сайтов студии на движке {{engineVersion}}; файл сгенерирован {{generatedAt}} из коммита `{{commit}}`. Не правьте его руками: поменяйте сайт и сгенерируйте заново.

{{include:intro}}

{{include:modes}}

## Концепция: {{concept.title}}

{{concept.summary}}

{{table:concept}}

## Файлы

```
sites/{{slug}}/
├── site.config.json      ← бренд, домен, оператор, аналитика, даты, параметры типа
├── concept.json          ← концепция: мир, словарь, палитра, шрифты, голос
├── content/              ← тексты страниц (JSON на страницу; по языкам, если их несколько)
├── theme/                ← tokens.css, concept.css, fonts.json
├── art/                  ← обложки и рисунки (где тип требует — только предметы и места)
├── media/                ← оригиналы фото и манифест (у типов с фотографиями)
├── data/                 ← данные сайта (покрытие шрифтов, подборка каталога провайдера)
├── public/               ← favicon, иконки, share-картинки
├── docs/                 ← README.md, COMPLIANCE.md (этот файл и его пара, генерируются)
└── checks.json           ← селекторы сайта для браузерных проверок
```

Общий движок лежит в `engine/`, правила этого типа сайтов — в `types/{{type}}/`. Сайт не правит ни то, ни другое.

## Перед запуском: что можете дать только вы

{{table:configTodo}}

{{list:ownerTodo}}

Пока в полях оператора стоят заглушки, сборка печатает предупреждения, а `--strict` превращает их в ошибки. Юридические тексты (Terms, Privacy, Cookies) написаны под эту конфигурацию, но это не юридическая консультация: перед запуском их смотрит юрист.

## Команды

Из корня репозитория (Node 22; браузерным инструментам нужен `npm ci` в корне).

```bash
node engine/build.mjs sites/{{slug}}                    # собрать dist/ и проверить
node engine/build.mjs sites/{{slug}} --strict           # сборка для запуска: ноль проблем
node engine/build.mjs sites/{{slug}} --json             # одна строка JSON: страницы, бюджеты, предупреждения, проблемы
CHECK_TIMEOUT_MIN=15 node engine/tools/check.mjs --site sites/{{slug}} --report reports/{{slug}}/check.json
node engine/tools/check.mjs --site sites/{{slug}} --only=pages,offline --workers 2 --report reports/{{slug}}/partial.json
node engine/tools/lighthouse.mjs sites/{{slug}}/dist --out reports/{{slug}}/lighthouse
node engine/tools/make-images.mjs --site sites/{{slug}}  # иконки и share-картинки, затем снова сборка
node engine/tools/serve.mjs sites/{{slug}}/dist --port=0
```

## Что проверяет сборка

Сборка заканчивается без проблем или падает. Для этого типа сайта она проверяет:

{{list:lintRules}}

Правила, которые опираются на ещё не сверенную цитату из правил Google, ASA или ICO, работают как предупреждения; правила самой студии всегда роняют сборку. Полный список с номерами и доказательствами — в `COMPLIANCE.md`.

## Кэш и обновления

{{list:caching}}

## Деплой

{{include:hosting}}

### После деплоя

{{include:afterDeploy}}

## Проверки, которые уже пройдены

Цифры ниже взяты из сборки, браузерных проверок и Lighthouse для коммита `{{commit}}` ({{generatedAt}}). Не переписывайте их руками: запустите команды заново и сгенерируйте файл.

{{table:results}}

Реальный INP и полевые Core Web Vitals покажут PageSpeed Insights и Search Console после запуска.
