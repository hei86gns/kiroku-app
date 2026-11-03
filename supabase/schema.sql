-- kiroku-app: database + storage schema
-- Run this once in the Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- Safe to re-run: every statement is idempotent.

-- ========== collections: レシピ / 買ったもの / 読書記録 / … ==========
create table if not exists public.kiroku_collections (
  id               uuid primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  en_name          text not null default '',
  theme            text not null default 'all',      -- color key (recipe / goods / books / all / amber / pink)
  icon             text not null default 'recipe',
  title_label      text not null default 'タイトル',
  sub_field_key    text,                              -- shown under the title (e.g. 著者)
  fields           jsonb not null default '[]'::jsonb, -- field definitions, in display order
  cover_field_key  text,
  default_view     text not null default 'gallery',
  saved_view       jsonb not null default '{}'::jsonb, -- { view, sort, filter, tag }
  meta             jsonb not null default '{}'::jsonb, -- e.g. { duration: { start, finish } }
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists kiroku_collections_user_idx on public.kiroku_collections(user_id);

alter table public.kiroku_collections enable row level security;

drop policy if exists "select own collections" on public.kiroku_collections;
create policy "select own collections" on public.kiroku_collections
  for select using (auth.uid() = user_id);

drop policy if exists "insert own collections" on public.kiroku_collections;
create policy "insert own collections" on public.kiroku_collections
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own collections" on public.kiroku_collections;
create policy "update own collections" on public.kiroku_collections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own collections" on public.kiroku_collections;
create policy "delete own collections" on public.kiroku_collections
  for delete using (auth.uid() = user_id);

-- ========== records: one row per recipe / item / book ==========
create table if not exists public.kiroku_records (
  id               uuid primary key,                  -- generated on the device (safe to re-send)
  user_id          uuid not null references auth.users(id) on delete cascade,
  collection_id    uuid not null references public.kiroku_collections(id) on delete cascade,
  title            text not null default '',
  data             jsonb not null default '{}'::jsonb, -- field key → value
  cover_image_key  text,
  notion_page_id   text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists kiroku_records_user_collection_idx on public.kiroku_records(user_id, collection_id);
create index if not exists kiroku_records_data_gin on public.kiroku_records using gin (data);

alter table public.kiroku_records enable row level security;

drop policy if exists "select own records" on public.kiroku_records;
create policy "select own records" on public.kiroku_records
  for select using (auth.uid() = user_id);

drop policy if exists "insert own records" on public.kiroku_records;
create policy "insert own records" on public.kiroku_records
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own records" on public.kiroku_records;
create policy "update own records" on public.kiroku_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own records" on public.kiroku_records;
create policy "delete own records" on public.kiroku_records
  for delete using (auth.uid() = user_id);

-- ========== storage: resized photos ==========
-- Path: {user_id}/{collection_id}/{record_id}/{uuid}.jpg (thumbnails end in .thumb.jpg)
insert into storage.buckets (id, name, public)
values ('kiroku-photos', 'kiroku-photos', false)
on conflict (id) do nothing;

drop policy if exists "kiroku photos select own" on storage.objects;
create policy "kiroku photos select own" on storage.objects
  for select using (bucket_id = 'kiroku-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kiroku photos insert own" on storage.objects;
create policy "kiroku photos insert own" on storage.objects
  for insert with check (bucket_id = 'kiroku-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kiroku photos update own" on storage.objects;
create policy "kiroku photos update own" on storage.objects
  for update using (bucket_id = 'kiroku-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kiroku photos delete own" on storage.objects;
create policy "kiroku photos delete own" on storage.objects
  for delete using (bucket_id = 'kiroku-photos' and (storage.foldername(name))[1] = auth.uid()::text);
