-- Admin accounts created through /admin/signup.
-- Run once in the Supabase SQL editor. Only the server (service-role key)
-- touches this table; anon/authenticated get no access.
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists admin_users_username_key
  on public.admin_users (lower(username));

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

grant select, insert on public.admin_users to service_role;
