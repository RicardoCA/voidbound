create table public.voidbound_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision uuid not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.voidbound_saves enable row level security;

revoke all on public.voidbound_saves from anon, authenticated;
grant select, insert, update on public.voidbound_saves to authenticated;

create policy "Read own save" on public.voidbound_saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own save" on public.voidbound_saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own save" on public.voidbound_saves
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.stamp_voidbound_save() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stamp_voidbound_save before update on public.voidbound_saves
  for each row execute function public.stamp_voidbound_save();
