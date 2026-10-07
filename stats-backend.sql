-- 승인 후 Supabase SQL Editor에서 실행
begin;
create table public.stats_snapshots (
 id bigserial primary key,
 period text not null check (period in ('d7','d28','d90')),
 section text not null check (section in ('daily','channel','source','pages','region','device','search_queries','link_clicks')),
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 updated_at timestamptz not null default now(),
 unique(period,section)
);
alter table public.stats_snapshots enable row level security;
revoke all on public.stats_snapshots from public, anon, authenticated;
grant select on public.stats_snapshots to authenticated;
grant select, insert, update on public.stats_snapshots to service_role;
grant usage, select on sequence public.stats_snapshots_id_seq to service_role;
create policy stats_admin_read on public.stats_snapshots for select to authenticated using ((select public.is_case_admin()));
commit;
