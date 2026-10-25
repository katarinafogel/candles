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
npm test         # расчёты, этапы, импорт таблиц
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

Проверка расчётов: «Книжка» (250 мл, 35% воды) → вода 159,25 г, гипс 295,75 г; «Шкатулка овал горшочек» (90 г, 7%) → воск 83,7 г, отдушка 6,3 г.
