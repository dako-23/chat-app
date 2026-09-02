
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  last_seen timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles readable by authed"
  on public.profiles for select to authenticated using (true);

create policy "insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

-- ── Разговори ───────────────────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean default false,
  title text,
  join_code text unique,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversations enable row level security;
alter table public.participants enable row level security;

-- Помощна функция: член ли съм на разговора (SECURITY DEFINER заобикаля RLS рекурсия)
create or replace function public.is_member(conv uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.participants
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

create policy "see my conversations"
  on public.conversations for select to authenticated
  using (public.is_member(id));

create policy "create conversations"
  on public.conversations for insert to authenticated
  with check (auth.uid() = created_by);

create policy "see my participation"
  on public.participants for select to authenticated
  using (public.is_member(conversation_id));

create policy "add participants to my convs"
  on public.participants for insert to authenticated
  with check (true);

-- ── Съобщения ───────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id),
  body text,
  image_url text,
  reply_to uuid references public.messages(id),
  edited_at timestamptz,
  deleted boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_messages_conv on public.messages(conversation_id, created_at);

alter table public.messages enable row level security;

create policy "read messages in my convs"
  on public.messages for select to authenticated
  using (public.is_member(conversation_id));

create policy "send messages to my convs"
  on public.messages for insert to authenticated
  with check (public.is_member(conversation_id) and sender_id = auth.uid());

create policy "edit/delete own messages"
  on public.messages for update to authenticated
  using (sender_id = auth.uid());

-- ── Скрити съобщения (delete-за-мен) ────────────────────
create table if not exists public.message_hidden (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (message_id, user_id)
);
alter table public.message_hidden enable row level security;
create policy "manage own hidden"
  on public.message_hidden for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Реакции ─────────────────────────────────────────────
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique (message_id, user_id, emoji)
);
alter table public.reactions enable row level security;

create policy "read reactions"
  on public.reactions for select to authenticated using (true);
create policy "manage own reactions"
  on public.reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Прочетено ───────────────────────────────────────────
create table if not exists public.read_state (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  last_read_at timestamptz default now(),
  primary key (conversation_id, user_id)
);
alter table public.read_state enable row level security;

create policy "read all read_state in my convs"
  on public.read_state for select to authenticated
  using (public.is_member(conversation_id));
create policy "upsert own read_state"
  on public.read_state for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
--  RPC функции
-- ============================================================

-- Намери или създай 1-на-1 разговор с друг потребител
create or replace function public.get_or_create_direct(other_user uuid)
returns uuid language plpgsql security definer as $$
declare
  conv uuid;
  code text;
begin
  -- търси съществуващ директен разговор с точно тези двама
  select c.id into conv
  from public.conversations c
  join public.participants p1 on p1.conversation_id = c.id and p1.user_id = auth.uid()
  join public.participants p2 on p2.conversation_id = c.id and p2.user_id = other_user
  where c.is_group = false
  limit 1;

  if conv is not null then
    return conv;
  end if;

  code := upper(substr(md5(random()::text), 1, 6));
  insert into public.conversations (is_group, join_code, created_by)
  values (false, code, auth.uid())
  returning id into conv;

  insert into public.participants (conversation_id, user_id)
  values (conv, auth.uid()), (conv, other_user);

  return conv;
end;
$$;

-- Присъединяване към разговор по код
create or replace function public.join_by_code(p_code text)
returns uuid language plpgsql security definer as $$
declare
  conv uuid;
begin
  select id into conv from public.conversations where join_code = p_code;
  if conv is null then
    raise exception 'no such code';
  end if;
  insert into public.participants (conversation_id, user_id)
  values (conv, auth.uid())
  on conflict do nothing;
  return conv;
end;
$$;

-- ============================================================
--  Изглед: преглед на разговори (другият участник, последно съобщение, unread)
-- ============================================================
create or replace view public.conversation_overview
with (security_invoker = true) as
select
  c.id as conversation_id,
  c.is_group,
  c.title,
  c.join_code,
  other.display_name as other_name,
  other.username as other_username,
  other.last_seen as other_last_seen,
  lm.body as last_body,
  lm.image_url as last_image,
  lm.created_at as last_message_at,
  coalesce(unread.cnt, 0) as unread
from public.conversations c
join public.participants me on me.conversation_id = c.id and me.user_id = auth.uid()
left join lateral (
  select pr.display_name, pr.username, pr.last_seen
  from public.participants p
  join public.profiles pr on pr.id = p.user_id
  where p.conversation_id = c.id and p.user_id <> auth.uid()
  limit 1
) other on true
left join lateral (
  select body, image_url, created_at
  from public.messages m
  where m.conversation_id = c.id and m.deleted = false
  order by created_at desc
  limit 1
) lm on true
left join lateral (
  select count(*) as cnt
  from public.messages m
  left join public.read_state rs
    on rs.conversation_id = c.id and rs.user_id = auth.uid()
  where m.conversation_id = c.id
    and m.sender_id <> auth.uid()
    and (rs.last_read_at is null or m.created_at > rs.last_read_at)
) unread on true;

-- ============================================================
--  Realtime — включи таблиците за live обновяване
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.read_state;

-- ============================================================
--  Storage — bucket за снимки
-- ============================================================
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

create policy "authed upload images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images');

create policy "public read images"
  on storage.objects for select to public
  using (bucket_id = 'chat-images');

-- Готово.
