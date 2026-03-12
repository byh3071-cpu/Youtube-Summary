# bookmarks 테이블 (Phase 7)

Supabase SQL Editor에서 아래 DDL을 실행하세요.

```sql
-- 유저별 북마크 (video_id, video_title, highlight)
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  video_title text not null,
  highlight text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_bookmarks_user_id on public.bookmarks(user_id);

alter table public.bookmarks enable row level security;

create policy "Users can read own bookmarks"
  on public.bookmarks for select
  using (auth.uid() = user_id);

create policy "Users can insert own bookmarks"
  on public.bookmarks for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
  on public.bookmarks for delete
  using (auth.uid() = user_id);
```
