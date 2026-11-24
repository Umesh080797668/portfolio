-- =====================================================================
-- Work tracking schema for the portfolio.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- SECURITY MODEL
--   * Row Level Security (RLS) is ENABLED on every table and there are NO policies.
--     That means the public "anon" key and any logged-in user's key can read and write
--     NOTHING. Only the server (service-role key, kept in .env) can access the data.
--   * Visitors never talk to the database. They talk to the server API, which exposes
--     a safe subset of one order at a time, identified by an unguessable tracking code.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Orders (a request from the website or a job you created yourself) ----------
create table if not exists public.work_orders (
    id            uuid primary key default gen_random_uuid(),
    tracking_code text unique,                       -- null until you accept the request
    client_name   text not null check (char_length(client_name) between 2 and 80),
    client_phone  text not null default '',
    client_email  text not null default '',
    client_org    text not null default '',
    title         text not null check (char_length(title) between 3 and 150),
    details       text not null default '',
    source        text not null default 'portfolio'
                  check (source in ('portfolio','whatsapp','email','phone','other')),
    status        text not null default 'pending_review'
                  check (status in ('pending_review','accepted','in_progress','awaiting_client',
                                    'ready_for_delivery','completed','on_hold','cancelled','rejected')),
    progress      integer not null default 0 check (progress between 0 and 100),
    due_date      date,
    quote_no      text not null default '',
    quote_total   numeric(12,2),
    quote_lines   jsonb,
    internal_notes text not null default '',         -- NEVER shown to visitors
    accepted_at   timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists work_orders_status_idx  on public.work_orders (status, updated_at desc);
create index if not exists work_orders_created_idx on public.work_orders (created_at desc);

-- ---------- Timeline entries ----------
create table if not exists public.order_updates (
    id         uuid primary key default gen_random_uuid(),
    order_id   uuid not null references public.work_orders(id) on delete cascade,
    status     text not null,
    progress   integer not null default 0,
    message    text not null default '',
    is_public  boolean not null default true,        -- false = internal note, hidden from the visitor
    created_by text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists order_updates_order_idx on public.order_updates (order_id, created_at desc);

-- ---------- Files (stored privately in Cloudinary; only metadata lives here) ----------
create table if not exists public.order_files (
    id            uuid primary key default gen_random_uuid(),
    order_id      uuid not null references public.work_orders(id) on delete cascade,
    public_id     text not null,
    resource_type text not null check (resource_type in ('image','raw','video')),
    format        text not null default '',
    bytes         bigint not null default 0,
    original_name text not null default '',
    visibility    text not null check (visibility in ('client_upload','deliverable')),
    uploaded_by   text not null default '',
    created_at    timestamptz not null default now()
);

create index if not exists order_files_order_idx on public.order_files (order_id);
create unique index if not exists order_files_public_id_idx on public.order_files (public_id);

-- ---------- Audit log (who did what, from which IP) ----------
create table if not exists public.audit_log (
    id     bigint generated always as identity primary key,
    at     timestamptz not null default now(),
    actor  text not null,
    action text not null,
    target text,
    ip     text,
    meta   jsonb
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);

-- ---------- Row Level Security: deny everything to anon/authenticated ----------
alter table public.work_orders  enable row level security;
alter table public.order_updates enable row level security;
alter table public.order_files   enable row level security;
alter table public.audit_log     enable row level security;

-- Belt and braces: remove any default grants for the public API roles
revoke all on public.work_orders   from anon, authenticated;
revoke all on public.order_updates from anon, authenticated;
revoke all on public.order_files   from anon, authenticated;
revoke all on public.audit_log     from anon, authenticated;

-- ---------- Keep updated_at fresh ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end $$;

drop trigger if exists work_orders_touch on public.work_orders;
create trigger work_orders_touch before update on public.work_orders
    for each row execute function public.touch_updated_at();

-- ---------- Realtime (optional but recommended) ----------
-- Lets the server notice changes made anywhere, even directly in the Supabase dashboard.
do $$
begin
    alter publication supabase_realtime add table public.work_orders;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.order_updates;
exception when duplicate_object then null;
end $$;
