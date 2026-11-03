# Князев Wall — установка и запуск

Этот файл — пошаговая инструкция для ручных действий. Код уже лежит в репозитории:

- фронтенд: `css/wall.css`, `js/views/wall.js`, вкладка `#t6` в `index.html`;
- бэкенд: папка `worker/` (Cloudflare Worker + D1);
- миграция: `worker/migrations/0001_init.sql`.

Ничего из секретного в репозиторий не записано. Все токены, ID и соли добавляются только через `wrangler secret` или локальный `.dev.vars`.

## Текущий тестовый деплой

- Worker: `https://knyazev-wall.lev20112010.workers.dev`
- Бот: `@approved2007_bot`
- Webhook уже зарегистрирован, секрет совпадает с Worker.
- Фронтенд уже настроен на этот Worker.
- Turnstile сейчас использует **официальные тестовые ключи** Cloudflare:
  - site key: `1x00000000000000000000AA`
  - secret: `1x0000000000000000000000000000000AA`
  - виджет будет показывать красную плашку «Только для тестирования». После теста создайте реальный виджет и замените оба ключа.
- Каждый админ должен открыть `@approved2007_bot` и нажать `/start`. Без этого Telegram отвечает `chat not found` и уведомления не доходят.


---

## 0. Что нужно заменить в файлах

Перед публикацией обязательно замените три плейсхолдера:

| Файл | Что заменить |
|---|---|
| `worker/wrangler.toml` | `database_id = "00000000-0000-0000-0000-000000000000"` на реальный ID базы D1 |
| `js/views/wall.js` | `WALL_API_BASE = 'https://REPLACE_WITH_WORKER_URL'` на URL Worker |
| `js/views/wall.js` | `TURNSTILE_SITE_KEY = 'REPLACE_WITH_TURNSTILE_SITE_KEY'` на публичный site key Turnstile |

`ALLOWED_ORIGIN` уже стоит правильный:

```toml
ALLOWED_ORIGIN = "https://aladushkies.github.io"
```

Это **origin**, а не полный адрес сайта. GitHub Pages пришлёт именно `https://aladushkies.github.io`, без `/knyazev-drop/`. Если поставить путь, CORS перестанет работать.

---

## 1. Telegram-бот

### 1.1. Токен

Если бот уже есть:

1. Откройте `@BotFather`.
2. `/mybots` → выберите бота → `API Token`.
3. Скопируйте токен. **Не присылайте его в чат и не вставляйте в файлы репозитория.**

Если бота нет:

1. `@BotFather` → `/newbot`.
2. Задайте имя и username.
3. Скопируйте токен.

### 1.2. Telegram ID админов

ID — это число, не username.

- Напишите `@userinfobot` или `@getmyid_bot`.
- Либо перешлите боту любое сообщение от нужного аккаунта.

У вас четыре админа. Впишите их ID через запятую без пробелов, например:

```text
<ADMIN_ID_1>,<ADMIN_ID_2>,<ADMIN_ID_3>,<ADMIN_ID_4>
```

Реальные ID храните только в секрете `ADMIN_IDS`. В коде и документации их быть не должно.

### 1.3. Обязательный `/start`

С **каждого** админского аккаунта отправьте боту `/start`. Пока админ не начал диалог, Telegram не даст боту написать ему первым.

Бот не отвечает на `/start` — это нормально. Он обрабатывает только кнопки под сообщениями.

---

## 2. Cloudflare

1. Зарегистрируйтесь на [dash.cloudflare.com](https://dash.cloudflare.com/) (бесплатный план подходит).
2. В PowerShell перейдите в папку Worker:

```powershell
cd "C:\Users\lev20\Downloads\Telegram Desktop\knyazevdrop_2026-10-22_2214\worker"
```

3. Войдите:

```powershell
npx wrangler login
```

Откроется браузер. Подтвердите доступ.

4. Проверьте, что CLI видит аккаунт:

```powershell
npx wrangler whoami
```

---

## 3. База D1

### 3.1. Создать базу

```powershell
npx wrangler d1 create knyazev-wall-db
```

В выводе будет `database_id`. Скопируйте его в `worker/wrangler.toml` вместо:

```toml
database_id = "00000000-0000-0000-0000-000000000000"
```

Должно получиться примерно так:

```toml
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 3.2. Применить миграцию к удалённой базе

```powershell
npx wrangler d1 migrations apply knyazev-wall-db --remote
```

Подтвердите применение (`y`). Wrangler выполнит `0001_init.sql`.

### 3.3. Проверить таблицы (по желанию)

```powershell
npx wrangler d1 execute knyazev-wall-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Должны быть таблицы `messages`, `notifications`, `rate_limits` и служебные таблицы миграций.

### 3.4. Локальная база

Для локальной разработки:

```powershell
npx wrangler d1 migrations apply knyazev-wall-db --local
```

---

## 4. Cloudflare Turnstile

1. В Cloudflare Dashboard откройте **Turnstile** → **Add widget**.
2. Название: `Knyazev Wall`.
3. Hostnames: `aladushkies.github.io` (без пути).
   - Для локальной разработки можно добавить `localhost`, но с тестовыми ключами это не обязательно.
4. Widget mode: **Managed**.
5. Theme: **Light**.
6. Сохраните и скопируйте:
   - **Site Key** — публичный, пойдёт в `js/views/wall.js`;
   - **Secret Key** — приватный, пойдёт в `wrangler secret put TURNSTILE_SECRET`.

Не перепутайте: site key можно показывать в браузере, secret key — нельзя.

---

## 5. Секреты Worker

Все команды выполняются из папки `worker/`.

Сгенерируйте два случайных значения:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Первое используйте как `TELEGRAM_WEBHOOK_SECRET`, второе — как `IP_HASH_SALT`.

Добавьте секреты по одному (каждая команда попросит вставить значение):

```powershell
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put ADMIN_IDS
npx wrangler secret put IP_HASH_SALT
```

Значения:

| Секрет | Значение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен от `@BotFather` |
| `TELEGRAM_WEBHOOK_SECRET` | случайная строка из генератора; тот же текст потом в `setWebhook` |
| `TURNSTILE_SECRET` | Secret Key из Turnstile |
| `ADMIN_IDS` | `<ADMIN_ID_1>,<ADMIN_ID_2>,<ADMIN_ID_3>,<ADMIN_ID_4>` |
| `IP_HASH_SALT` | вторая случайная строка |

`wrangler secret put` создаёт новую версию Worker и сразу её публикует. Если Wrangler скажет, что Worker ещё не существует, сначала выполните `npx wrangler deploy` (шаг 6), затем повторите команды секретов.

### Как обновить список админов

```powershell
npx wrangler secret put ADMIN_IDS
```

Введите новый список через запятую. Новый админ всё равно должен нажать `/start`.

---

## 6. Деплой Worker

```powershell
npx wrangler deploy
```

В выводе будет URL вида:

```text
https://knyazev-wall.<YOUR_WORKERS_SUBDOMAIN>.workers.dev
```

Скопируйте его. Это `WALL_API_BASE` для фронтенда.

Если Wrangler просит выбрать workers.dev subdomain — задайте его в Dashboard: **Workers & Pages → Settings → Subdomain**.

Проверка, что Worker отвечает:

```powershell
curl.exe "https://knyazev-wall.<YOUR_WORKERS_SUBDOMAIN>.workers.dev/api/messages"
```

Ожидаемый ответ — `[]` (пустой массив) или уже существующие одобренные сообщения.

---

## 7. Webhook Telegram

Замените три плейсхолдера:

- `<TELEGRAM_BOT_TOKEN>` — токен бота;
- `<TELEGRAM_WEBHOOK_SECRET>` — тот же секрет, что в `wrangler secret put TELEGRAM_WEBHOOK_SECRET`;
- `<YOUR_WORKERS_SUBDOMAIN>` — ваш поддомен.

### PowerShell

```powershell
$token = "<TELEGRAM_BOT_TOKEN>"
$body = @{
  url = "https://knyazev-wall.<YOUR_WORKERS_SUBDOMAIN>.workers.dev/telegram"
  secret_token = "<TELEGRAM_WEBHOOK_SECRET>"
  allowed_updates = @("callback_query")
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "https://api.telegram.org/bot$token/setWebhook" `
  -ContentType "application/json" `
  -Body $body
```

### Проверка

```powershell
Invoke-RestMethod "https://api.telegram.org/bot$token/getWebhookInfo" | ConvertTo-Json -Depth 5
```

Проверьте:

- `url` совпадает с адресом `/telegram`;
- `last_error_message` пустой;
- `allowed_updates` содержит `callback_query`.

`allowed_updates = ["callback_query"]` означает, что `/start` не доставляется боту. Это нормально: `/start` нужен только чтобы открыть диалог, а бот обрабатывает только кнопки. Если позже захотите приветствие на `/start`, добавьте `"message"` и обработчик в Worker.

### Если у бота уже был другой webhook

`setWebhook` перезаписывает его. Старая интеграция перестанет получать обновления. Отменить можно так:

```powershell
Invoke-RestMethod "https://api.telegram.org/bot$token/deleteWebhook"
```

Но тогда стена перестанет получать кнопки.

---

## 8. Фронтенд

Откройте `js/views/wall.js` и замените в самом начале:

```js
const WALL_API_BASE = 'https://knyazev-wall.<YOUR_WORKERS_SUBDOMAIN>.workers.dev';
const TURNSTILE_SITE_KEY = '<TURNSTILE_SITE_KEY>';
```

`WALL_API_BASE` — без `/api/messages` и без слэша на конце. Код сам добавит путь.

После изменения файлов поднимите версию в `index.html`, чтобы GitHub Pages и браузеры не отдали старый кэш:

```html
<link rel="stylesheet" href="css/wall.css?v=1.0.1" />
...
<script src="js/views/wall.js?v=1.0.1"></script>
```

Закоммитьте изменения и запушьте в ветку GitHub Pages (`main`, если у вас Deploy from branch). Публикацию делаете вы; агент `git push` не выполняет.

Проверьте, что сайт открывается:

```text
https://aladushkies.github.io/knyazev-drop/
```

В шапке должна появиться пятая вкладка **Князев Wall**. На главной — баннер, который исчезнет после первого захода на стену.

---

## 9. Локальная разработка (необязательно)

1. Скопируйте `worker/.dev.vars.example` в `worker/.dev.vars`.
2. Заполните:

```dotenv
TELEGRAM_BOT_TOKEN=<токен тестового бота>
TELEGRAM_WEBHOOK_SECRET=<local-random-secret>
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
ADMIN_IDS=<ваш Telegram ID>
IP_HASH_SALT=<любая случайная строка>
ALLOWED_ORIGIN=http://localhost:8080
```

`TURNSTILE_SECRET` и site key выше — официальные тестовые ключи Cloudflare, которые всегда пропускают. Они работают на `localhost` и не требуют реального виджета.

3. В `js/views/wall.js` временно поставьте:

```js
const WALL_API_BASE = 'http://127.0.0.1:8787';
const TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
```

4. Примените локальную миграцию:

```powershell
cd worker
npx wrangler d1 migrations apply knyazev-wall-db --local
```

5. Запустите Worker:

```powershell
npx wrangler dev --port 8787
```

6. Во втором терминале запустите статический сервер из корня проекта:

```powershell
cd "C:\Users\lev20\Downloads\Telegram Desktop\knyazevdrop_2026-10-22_2214"
python -m http.server 8080
```

Если Python нет, подойдёт любой статический сервер. Откройте `http://localhost:8080`.

7. Для полной проверки Telegram локально нужен туннель (`cloudflared`/`ngrok`) и реальный токен. Для проверки стены и Turnstile достаточно тестовых ключей.

**Не коммитьте `.dev.vars`.** Он уже в `.gitignore`.

---

## 10. Чек-лист проверки

1. Отправьте сообщение на сайте.
   - На сайте оно **не появилось**.
   - В Telegram пришло сообщение с именем, текстом, временем, ID и двумя кнопками.
2. Нажмите «Одобрить».
   - В течение 20 секунд сообщение появилось на стене.
   - В боте у этого сообщения осталась одна кнопка «Удалить», текст помечен «Опубликовано».
3. Нажмите «Удалить» у одобренного сообщения.
   - Оно исчезло с сайта в течение 20 секунд.
   - В боте текст заменился на «Удалено», кнопки исчезли.
4. Отправьте второе сообщение и нажмите «Удалить» **до** одобрения.
   - На сайте оно так и не появилось.
   - В боте оно помечено «Удалено».
5. Несколько админов.
   - После действия одного админа у остальных копии обновились: кнопки исчезли/заменились.
6. Чужой Telegram-аккаунт.
   - Нажимает кнопку → получает «Нет доступа», сообщение не меняется.
7. Спам.
   - Второе сообщение раньше чем через 20 секунд → «Слишком часто».
   - 11-е сообщение за час → «Слишком часто».
   - Без Turnstile отправить нельзя.
8. HTML-теги.
   - Сообщение `<b>привет</b>` на сайте показывается как текст `<b>привет</b>`, а не жирным.
   - В Telegram теги тоже видны как текст, без поломки разметки.
9. Пустая стена.
   - Пока нет одобренных сообщений — «Пока никто ничего не написал».
10. «Показать ещё».
    - После 50 сообщений появляется кнопка; она грузит следующие 50.
11. Телефон.
    - Пять вкладок помещаются, форма и лента не вылезают за экран.
12. Автообновление.
    - Переключитесь на другую вкладку браузера на минуту: опрос не должен идти.
    - Вернитесь: лента обновится, текст в форме сохранится.
13. Ошибка сети.
    - Отключите сеть, нажмите «Обновить»/перезагрузите: должно быть понятное сообщение, а не пустой экран.

Для диагностики:

```powershell
cd worker
npx wrangler tail
```

В логах будут ID сообщений, ошибки Telegram и D1, но не токены и не тексты сообщений.

---

## 11. Если что-то не работает

### «Стена ещё не настроена»

В `js/views/wall.js` остались `REPLACE_WITH_WORKER_URL` или `REPLACE_WITH_TURNSTILE_SITE_KEY`. Замените и обновите версию в `index.html`.

### CORS-ошибка в консоли браузера

- В `worker/wrangler.toml` должно быть `ALLOWED_ORIGIN = "https://aladushkies.github.io"`.
- Без `/knyazev-drop/` и без слэша на конце.
- После изменения выполните `npx wrangler deploy`.

### Telegram не получает сообщения

- Каждый админ нажал `/start`?
- `ADMIN_IDS` содержит числовые ID через запятую?
- `TELEGRAM_BOT_TOKEN` правильный?
- `getWebhookInfo` показывает ошибку?
- `npx wrangler tail` показывает `telegram sendMessage failed`?

### Webhook отвечает 401

`TELEGRAM_WEBHOOK_SECRET` в секретах Worker и `secret_token` в `setWebhook` должны совпадать **посимвольно**. После смены секрета вызовите `setWebhook` заново.

### Turnstile не проходит

- Site key и secret key — из одного виджета.
- Hostname виджета — `aladushkies.github.io`.
- Для локальной разработки используйте пару `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`.
- Если виджет не загрузился, проверьте блокировщики рекламы и доступ к `challenges.cloudflare.com`.

### D1: «no such table»

Миграция применена не к той базе или не к тому окружению. Проверьте `database_id` и выполните:

```powershell
npx wrangler d1 migrations apply knyazev-wall-db --remote
```

### Слишком часто

Лимит: 1 сообщение в 20 секунд и 10 в час с одного IP. Если вы тестируете с одного IP, подождите или временно измените константы в `worker/src/config.ts`:

```ts
export const SHORT_WINDOW_SECONDS = 20;
export const LONG_WINDOW_LIMIT = 10;
```

После изменения — `npx wrangler deploy`.

---

## 12. Ограничения и важные оговорки

- **Удаление окончательное.** `DELETE FROM messages WHERE id = ?`, без корзины и флагов. Восстановить из интерфейса нельзя.
- **D1 Time Travel/бэкапы.** Cloudflare может хранить резервные копии базы вне приложения. Полное удаление из всех бэкапов интерфейсом не гарантируется.
- **10 сообщений в час на IP.** Если сайтом пользуется класс за одним школьным NAT, лимит может сработать раньше. Значения вынесены в `worker/src/config.ts`.
- **CORS — origin, а не путь.** `https://aladushkies.github.io` общий для всех project pages этого аккаунта. Это не авторизация; защита — Turnstile и лимиты.
- **Лимит ленты — 500 сообщений (10 страниц).** Дальше кнопка «Показать ещё» скрывается, чтобы автоопрос не делал десятки запросов каждые 20 секунд.
- **Сортировка по времени отправки (`id`), не по времени одобрения.** Старое pending-сообщение после одобрения встанет в свою хронологическую позицию и может не попасть на первую страницу.
- **Если Telegram недоступен всем админам**, сообщение остаётся `pending`, ошибка пишется в лог. Автоматического повторного уведомления нет.
- **Правки копий в Telegram — best effort.** Если админ удалил сообщение или заблокировал бота, ошибка логируется, остальные копии обновляются.
- **Cron чистит до 5 сообщений за запуск.** Это связано с бесплатным лимитом Cloudflare: 50 подзапросов на invocation. Если pending накопится, следующие запуски добьют остаток.
- **`wrangler secret put` сразу публикует новую версию Worker.** Отдельный `wrangler deploy` после секретов не обязателен, но и не вреден.
- **Секреты не в git.** `.dev.vars`, `node_modules`, `.wrangler` уже в `.gitignore`. Не добавляйте реальные ID и токены в README, коммиты и скриншоты.

---

## 13. Быстрые команды (шпаргалка)

```powershell
# из корня проекта
cd "C:\Users\lev20\Downloads\Telegram Desktop\knyazevdrop_2026-10-22_2214\worker"

npx wrangler login
npx wrangler d1 create knyazev-wall-db
npx wrangler d1 migrations apply knyazev-wall-db --remote
npx wrangler deploy

npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put ADMIN_IDS
npx wrangler secret put IP_HASH_SALT

npx wrangler tail
```

```powershell
# локально
npx wrangler d1 migrations apply knyazev-wall-db --local
npx wrangler dev --port 8787
```
