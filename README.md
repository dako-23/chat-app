# Чат приложение — реален чат между двама души

React + Supabase (realtime, база, снимки) + Vercel (хостинг).

Твоята работа е ~10 минути еднократно. Целият код е готов. Следвай стъпките по ред.

---

## Какво умее

- Регистрация само с име → дава ти парола за следващия път
- Реален чат в реално време (WebSocket, без опресняване на страницата)
- Sent / delivered / read (✓ / ✓✓) статуси
- „пише…" индикатор, онлайн статус, last seen
- Reply, edit, delete (за мен / за всички), copy
- Emoji реакции ❤️ 😂 👍 😮 😢
- Снимки: качване, preview, drag & drop, автокомпресиране
- Групиране по дата, автоскрол, infinite scroll за старите съобщения
- Търсене на хора по име + присъединяване по код
- Работи на телефон и десктоп

---

## СТЪПКА 1 — Supabase (базата)

1. Влез в **https://supabase.com** → влез с GitHub → **New project**.
2. Дай име, задай парола за базата (запиши си я някъде), избери регион близо до теб → **Create**. Изчакай ~2 мин да се вдигне.
3. Отляво → **SQL Editor** → **New query**.
4. Отвори файла `supabase-setup.sql` от този проект, копирай **цялото** съдържание, постави го в редактора → натисни **Run** (долу вдясно). Трябва да пише *Success*.
5. **Важно (олекотено логване):** отляво → **Authentication** → **Sign In / Providers** → **Email** → изключи **Confirm email** → Save. Така регистрацията с име работи без реален имейл.
6. Отляво → **Project Settings** → **API**. Копирай две неща (ще ти трябват в Стъпка 3):
   - **Project URL** (напр. `https://abcd.supabase.co`)
   - **anon public** ключа (или „publishable")

---

## СТЪПКА 2 — Качи кода в GitHub

Ако нямаш GitHub — направи безплатен акаунт на **https://github.com**.

Най-лесно през браузъра:
1. **https://github.com/new** → дай име на репото (напр. `chat`) → **Create repository**.
2. На следващата страница → **uploading an existing file** → плъзни всички файлове от тази папка (без `node_modules`, ако го има) → **Commit**.

Или през терминал, ако ти е познат:
```bash
git init
git add .
git commit -m "chat app"
git branch -M main
git remote add origin https://github.com/ТВОЯ-ПОТРЕБИТЕЛ/chat.git
git push -u origin main
```

---

## СТЪПКА 3 — Деплой на Vercel

1. Влез в **https://vercel.com** → влез с GitHub.
2. **Add New → Project** → избери репото от Стъпка 2 → **Import**.
3. Vercel сам разпознава Vite (Framework: Vite). Не пипай build настройките.
4. Разгъни **Environment Variables** и добави двете от Стъпка 1:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | твоят Project URL |
   | `VITE_SUPABASE_ANON_KEY` | твоят anon ключ |

5. **Deploy**. След ~1 мин получаваш линк тип `https://chat-xxx.vercel.app`.

Готово. Отвори линка, регистрирай се с име, прати линка на втория човек — той се регистрира със своето име, търси те по име, отваря разговор.

---

## Локално стартиране (по избор)

```bash
npm install
cp .env.example .env.local   # попълни двете стойности
npm run dev
```

---

## Ако нещо не работи

- **„изисква потвърждение по имейл"** при регистрация → не си изключил Confirm email (Стъпка 1.5).
- **празен екран** → провери дали двете Environment Variables във Vercel са точни, после Redeploy.
- **съобщенията не идват live** → провери в SQL-а, че последните `alter publication ... add table` редове са минали (пусни само тях наново, ако трябва).
- **снимките не се качват** → провери в Supabase → Storage, че bucket `chat-images` съществува и е public.

---

## Следва v2

Групи, глобално търсене, offline режим, reconnection, multi-device sync, block/report — ще ги добавим след теста.
