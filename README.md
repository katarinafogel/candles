# Мастерская свечей — трекер производства (MVP)

Производственный журнал мастерской свечей в гипсовых подсвечниках: замесы гипса, этапы подсвечников, заливки воска, склад материалов, выдача свечей по QR и отзывы получателей.

- **React + Redux Toolkit + TypeScript + Vite**, интерфейс на **Chakra UI** (тёмная тема, изумрудный акцент).
- **PWA**: устанавливается на телефон и компьютер, работает офлайн.
- Данные хранятся в **Supabase** (Postgres): у каждого мастера свой аккаунт, вход через **Google**. Правила доступа в базе (RLS) не дают видеть чужие данные.
- Копия данных лежит на устройстве (IndexedDB): без интернета записи можно смотреть, а изменения уходят на сервер, когда связь вернётся.
- Отзывы получатели оставляют без входа — через функцию базы `submit_review` с проверкой ответов и лимитом частоты.
- Хостинг — **GitHub Pages**, автодеплой из ветки `main`.

## Запуск

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # расчёты, этапы, импорт таблиц, гримуар
npm run build
```

## Публикация на GitHub Pages

1. **Settings → Pages → Source: GitHub Actions**.
2. Пуш в `main` запускает `.github/workflows/deploy.yml`.
3. Переменные репозитория (**Settings → Secrets and variables → Actions → Variables**): `SUPABASE_URL` и `SUPABASE_ANON_KEY` (публичный ключ проекта). Их же для локального запуска — в `.env.local` как `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.
4. Workflow `keepalive.yml` раз в 3 дня обращается к базе, чтобы бесплатный проект Supabase не засыпал.

Ссылки в QR имеют вид `https://<логин>.github.io/<репозиторий>/#/c/<мастер>/S-0042` (HashRouter, чтобы Pages не отдавал 404).

## Supabase

1. Создать проект, выполнить [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) в SQL Editor.
2. **Authentication → URL Configuration:** Site URL — адрес сайта, в Redirect URLs — `https://<логин>.github.io/<репозиторий>/**`.
3. **Authentication → Sign In / Providers → Google:** Client ID и Client Secret из OAuth-клиента Google Cloud (тип Web application, redirect URI — `https://<проект>.supabase.co/auth/v1/callback`).

## Гримуар дел

Личный планировщик внутри мастерской (адреса `/g/...`): свиток дня, книга дел, монеты, ритуалы, колесо года, зеркало, сундук желаний. Открывается только мастерам с ролью `witch`; роль `admin` раздаёт роли в настройках.

1. Выполнить [`supabase/migrations/0002_grimoire.sql`](supabase/migrations/0002_grimoire.sql) в SQL Editor. Если мастер в проекте один, он сразу получает обе роли; иначе — `insert` из комментария в миграции.
2. Перезайти в приложение: роли загружаются вместе с аккаунтом, появится переключатель «Мастерская / Гримуар».

Без роли строки гримуара в базе не видны и не пишутся (RLS), но не удаляются: роль вернули — всё на месте.

Быстрое добавление одной строкой: `помыть окна **☠☠ #дом !пт` — 2 звезды, нехотение 2, тег, срок в пятницу; `кино с @аня +радость`; `+главное`, `+доп`, `+необяз`, `+завтра`.

Монеты: `10 · сложность · (1 + 0,5 · нехотение) + бонусы`, баланс — сумма журнала `coin_tx`. Формула настраивается в «Ещё».

Для ассистента в базе есть сводки (только чтение, только для `witch`): `grimoire_plan(day)`, `grimoire_day_summary(day)`, `grimoire_backlog()`, `grimoire_stuck()`, `grimoire_joys(day)`, `grimoire_balance()`, `grimoire_nav()`.

### Агент (MCP)

Ассистент Claude может читать и менять гримуар через свой коннектор — сервер MCP на Supabase Edge Function `grimoire-mcp`. Он выполняет те же правила, что и приложение (код ядра копируется из `src/grimoire` скриптом `node scripts/sync-agent-core.mjs`), и видит только гримуар.

1. Выполнить [`supabase/migrations/0003_agent.sql`](supabase/migrations/0003_agent.sql).
2. Развернуть функцию: `supabase functions deploy grimoire-mcp --no-verify-jwt` (или через коннектор Supabase).
3. В гримуаре: «Ещё» → «Доступ для агента» → «Выпустить ключ». Адрес вида `https://<проект>.functions.supabase.co/grimoire-mcp/gk_…` показывается один раз.
4. В claude.ai: Settings → Connectors → добавить свой коннектор с этим адресом.

Инструменты: `grimoire_today`, `grimoire_day_summary`, `grimoire_list_tasks`, `grimoire_get_task`, `grimoire_add_task`, `grimoire_update_task`, `grimoire_complete_task`, `grimoire_reopen_task`, `grimoire_start_task`, `grimoire_plan_task`, `grimoire_postpone_task`, `grimoire_to_backlog`, `grimoire_finish_morning_review`, `grimoire_cancel_task`, `grimoire_set_waiting`, `grimoire_spawn_task`, `grimoire_split_task`, `grimoire_habits`, `grimoire_mark_habit`, `grimoire_add_journal`, `grimoire_set_nav`, `grimoire_wheel`, `grimoire_practice_to_task`.

## Где что

| Путь | Что |
|---|---|
| `src/types.ts` | модель данных (формы, замесы, подсвечники, свечи, заливки, материалы, люди, отзывы) |
| `src/store/dataSlice.ts` | все операции: замес, этапы, откат, заливка, списание, брак |
| `src/lib/calc.ts` | формулы замеса и заливки, порог «заканчивается», себестоимость |
| `src/lib/importSheets.ts` | первичный импорт листов «Формы», «Свечи», «Отдушки» из CSV |
| `src/pages/PublicCandle.tsx` | страница получателя: инструкция, трекер горения, отзыв |
| `supabase/migrations/0001_init.sql` | схема базы, правила доступа, функции `apply_changes`, `candle_public`, `submit_review` |
| `src/lib/sync.ts` | синхронизация с сервером: очередь изменений, загрузка аккаунта |
| `public/privacy.html` | политика конфиденциальности (нужна Google для входа) |
| `src/grimoire/` | модель гримуара, монеты, разбор строки, даты, привычки, колесо года |
| `src/store/grimoireSlice.ts` | все операции гримуара |
| `src/pages/grimoire/` | свиток, книга дел, ритуалы, колесо, зеркало, хотелки, «ещё» |
| `supabase/tests/` | проверка миграций и правил доступа на чистом Postgres (CI) |
| `src/grimoire/agent.ts` | инструменты агента поверх логики гримуара |
| `supabase/functions/grimoire-mcp/` | MCP-сервер агента (Deno), `core/` — копия ядра |

Проверка расчётов: «Книжка» (250 мл, 35% воды) → вода 159,25 г, гипс 295,75 г; «Шкатулка овал горшочек» (90 г, 7%) → воск 83,7 г, отдушка 6,3 г.
