<!--
Template: questions for a social-casino order (type social-casino; variants own-games, demo-lobby), Russian.
Same rules as questions.social-casino.en.md: one block per question, a `field:` line with the order.json path,
the question in the client's language, an empty `answer:` line. Only blocks whose field is missing, a
"[placeholder]" or has confidence < 0.8 are kept. Legal facts are never guessed. A re-answered question keeps its
block and gains "[revised]" after the heading.
-->
# Вопросы по сайту {{brand.name}}

Спасибо за бриф. Ниже вопросы, без ответов на которые мы не можем начать работу ({{beforeBuildCount}}) и запустить сайт ({{beforeLaunchCount}}). Пишите ответ под строкой `answer:`; «как у остальных сайтов» тоже подходит, где это уместно.

## До начала работы

### Только бесплатная игра
field: typeOptions.purchases.enabled
why: Сайт — бесплатное социальное казино. Любые покупки за деньги, призы или вывод средств выводят его из этого типа и из правил Google для social casino.
question: Нужны ли покупки за реальные деньги (например, дополнительные монеты)? Мы рекомендуем запуск без покупок.
answer:

### Демо провайдеров
field: typeOptions.games.mode
why: Наши собственные игры есть всегда (не меньше трёх). Демо сторонних провайдеров (например, Pragmatic Play) делают сайт непригодным для Google Ads и требуют письменного согласия провайдера до запуска.
question: Только наши игры или ещё и лобби с бесплатными демо провайдера? Если лобби: есть ли письменное согласие провайдера (номер и дата)?
answer:

### Google Ads
field: analytics.adsConversionId
why: Лобби с демо не может иметь аккаунт или ID конверсий Google Ads; такой заказ отклоняется на приёме.
question: Будет ли сайт рекламироваться в Google Ads? Если да: чей аккаунт (ваш собственный, под нашим управляющим аккаунтом) и чей платёжный профиль его оплачивает?
answer:

### Аналитика
field: analytics.ga4
why: У каждого сайта свой ресурс GA4; идентификаторы между сайтами не делятся.
question: Есть ли идентификатор GA4 для этого сайта (G-...) или запускаем без аналитики?
answer:

### Домен
field: domain
why: Домен должен быть зарегистрирован на вас (рекламодателя). Бесплатные поддомены не принимаются.
question: Какой домен будет у сайта и зарегистрирован ли он на вас?
answer:

### Доступ к домену
field: dns.accessConfirmed
why: Мы направляем домен на хостинг; без доступа к регистратору или Cloudflare запуск ждёт.
question: Где зарегистрирован домен и можете ли вы дать доступ к его DNS (или перенести NS на Cloudflare)?
answer:

### Дата запуска
field: dates.launchTarget
why: Дата запуска определяет заморозку текстов и слоты проверки.
question: К какой дате сайт должен работать?
answer:

### Хостинг
field: hosting.provider
why: По умолчанию сайты размещаются на Cloudflare Pages, один проект на сайт.
question: Размещаем как остальные сайты (Cloudflare Pages) или передаём в ваш репозиторий?
answer:

## До запуска

### Название компании-оператора
field: operator.name
why: Оператор указывается в подвале, условиях, структурированных данных и верификации рекламодателя Google Ads; всё должно совпадать с реестром.
question: Полное юридическое название компании, которая управляет сайтом?
answer:

### Номер компании
field: operator.registrationNumber
why: Перед запуском мы проверяем номер в Companies House.
question: Номер компании в Companies House?
answer:

### Юридический адрес
field: operator.address
why: Адрес указывается в условиях и политике конфиденциальности.
question: Юридический адрес компании?
answer:

### Почта для связи
field: operator.email
why: Ящик должен существовать и принимать письма до запуска (мы отправим тестовое письмо).
question: Какой адрес почты указать для игроков (на домене сайта или вашем)?
answer:

### Проверка возраста
field: typeOptions.ageVerification.method
why: Только для взрослых (18+). Способ проверки — решение оператора: самоподтверждение или сторонний сервис проверки возраста.
question: Самоподтверждение 18+ или сторонний сервис проверки возраста (какой)?
answer:

### Оценка аудитории
field: audienceAssessment.signedBy
why: Кто-то с вашей стороны подписывает оценку того, могут ли сайт посещать дети; мы готовим черновик, вы подписываете.
question: Кто подпишет оценку аудитории (имя и должность)?
answer:

### Юридическая проверка
field: legal.reviewer
why: Условия, политика конфиденциальности и cookies формируются из ваших данных; до запуска нужен названный проверяющий.
question: Кто проверяет юридические страницы (имя, фирма) и к какому сроку?
answer:

### Проверка товарного знака
field: brand.trademarkSearch.done
why: Название не должно совпадать с зарегистрированным знаком или брендом азартных игр на деньги.
question: Проводился ли поиск по товарным знакам для названия? Кто и когда?
answer:

### Форма обратной связи
field: contactEndpoint
why: Страница контактов может отправлять форму в ваш сервис; без него показывается только адрес почты.
question: Есть ли адрес (URL) обработчика формы или показываем только почту?
answer:

### Основная конверсия
field: ppc.primaryConversion
why: Для рекламы нужна одна основная конверсия. Для social casino обычно это play_start или level_end.
question: Что считать основной конверсией: начало игры (play_start) или завершение уровня (level_end)?
answer:
