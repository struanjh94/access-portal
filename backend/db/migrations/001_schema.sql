create table users (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create unique index users_email_lower_idx on users (lower(email));

create table roles (
  key         text primary key,
  name        text not null,
  description text not null
);

create table permissions (
  key         text primary key,
  description text not null
);

create table role_permissions (
  role_key       text not null references roles(key)       on delete cascade,
  permission_key text not null references permissions(key) on delete restrict,
  primary key (role_key, permission_key)
);

create index role_permissions_permission_idx on role_permissions (permission_key);

create table user_roles (
  user_id    uuid not null references users(id) on delete cascade,
  role_key   text not null references roles(key),
  granted_at timestamptz not null default now(),
  granted_by uuid references users(id) on delete set null,
  primary key (user_id, role_key)
);

create index user_roles_role_idx on user_roles (role_key);

create table audit_logs (
  id                bigserial primary key,
  occurred_at       timestamptz not null default now(),
  action            text not null check (action in (
                      'user.created',
                      'role.granted',
                      'role.revoked'
                    )),
  actor_id          uuid,
  actor_email       text not null,
  target_user_id    uuid,
  target_user_email text not null,
  role_key          text references roles(key),
  details           jsonb not null default '{}'
);

create index audit_logs_recent_idx on audit_logs (occurred_at desc, id desc);

create index audit_logs_target_recent_idx
  on audit_logs (target_user_id, occurred_at desc, id desc);

create or replace function audit_logs_immutable() returns trigger as $$
begin
  raise exception 'audit_logs is append-only: % is not permitted', tg_op;
end;
$$ language plpgsql;

create trigger audit_logs_no_change
  before update or delete on audit_logs
  for each row execute function audit_logs_immutable();

create trigger audit_logs_no_truncate
  before truncate on audit_logs
  for each statement execute function audit_logs_immutable();
