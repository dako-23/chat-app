# Realtime Chat

A small 1-on-1 realtime chat I built with React and Supabase. Sign in with just a name, get a password for next time, and start chatting. Hosted on Vercel.

## Features

- Sign in with a name — you get a password to log back in later
- Realtime messaging over WebSockets (no polling, no refresh)
- Sent / delivered / read receipts (✓ / ✓✓)
- Typing indicator, online status, last seen
- Reply, edit, delete (for me / for everyone), copy
- Emoji reactions ❤️ 😂 👍 😮 😢
- Image sharing with preview, drag & drop, and auto-compression
- Date separators, auto-scroll, infinite scroll for older messages
- Find people by name, or join a conversation with a code
- Works on mobile and desktop

## Tech

- React + Vite
- Supabase (Postgres, Realtime, Storage, Auth)
- Deployed on Vercel

## Setup

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor**, paste the contents of `supabase-setup.sql`, and run it. This creates all tables, RLS policies, RPC functions, and the storage bucket.
3. Go to **Authentication → Sign In / Providers → Email** and turn **Confirm email** off. Login uses name-based accounts with internal emails, so email confirmation has to be disabled.
4. Grab your **Project URL** and **anon/publishable key** from **Project Settings → API**.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run locally

```bash
npm install
npm run dev
```

### 4. Deploy

Push to GitHub, import the repo on Vercel, add the same two environment variables, and deploy. Vercel auto-detects Vite.

## Notes

Security is intentionally light — this is meant for a small, trusted group, not public use. Passwords are shown on screen, emails are synthetic, and any signed-in user can search for any other. Don't ship this as-is to the open internet.

## Roadmap

Next up: group chats, global search, offline mode, reconnection handling, multi-device sync, and block/report.
