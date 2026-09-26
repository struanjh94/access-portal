insert into roles (key, name, description) values
  ('admin',   'Administrator', 'Full access: manage users and their roles, and read the audit log'),
  ('support', 'Support',       'Read-only access to users and the audit log'),
  ('viewer',  'Viewer',        'Read-only access to users')
on conflict (key) do nothing;

insert into permissions (key, description) values
  ('users:read',   'View users and their assigned roles'),
  ('users:create', 'Add a new user'),
  ('roles:grant',  'Assign a role to a user'),
  ('roles:revoke', 'Remove a role from a user'),
  ('audit:read',   'View the audit log')
on conflict (key) do nothing;

insert into role_permissions (role_key, permission_key) values
  ('admin',   'users:read'),
  ('admin',   'users:create'),
  ('admin',   'roles:grant'),
  ('admin',   'roles:revoke'),
  ('admin',   'audit:read'),
  ('support', 'users:read'),
  ('support', 'audit:read'),
  ('viewer',  'users:read')
on conflict do nothing;

insert into users (id, email, display_name) values
  ('11111111-1111-4111-8111-111111111111', 'ada.lovelace@example.com',   'Ada Lovelace'),
  ('22222222-2222-4222-8222-222222222222', 'grace.hopper@example.com',   'Grace Hopper'),
  ('33333333-3333-4333-8333-333333333333', 'alan.turing@example.com',    'Alan Turing'),
  ('44444444-4444-4444-8444-444444444444', 'katherine.j@example.com',    'Katherine Johnson'),
  ('55555555-5555-4555-8555-555555555555', 'margaret.h@example.com',     'Margaret Hamilton'),
  ('66666666-6666-4666-8666-666666666666', 'barbara.liskov@example.com', 'Barbara Liskov')
on conflict (id) do nothing;

insert into user_roles (user_id, role_key, granted_by) values
  ('11111111-1111-4111-8111-111111111111', 'admin',   '11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222', 'admin',   '11111111-1111-4111-8111-111111111111'),
  ('33333333-3333-4333-8333-333333333333', 'support', '11111111-1111-4111-8111-111111111111'),
  ('44444444-4444-4444-8444-444444444444', 'support', '11111111-1111-4111-8111-111111111111'),
  ('44444444-4444-4444-8444-444444444444', 'viewer',  '11111111-1111-4111-8111-111111111111'),
  ('55555555-5555-4555-8555-555555555555', 'viewer',  '11111111-1111-4111-8111-111111111111')
on conflict (user_id, role_key) do nothing;

insert into audit_logs (occurred_at, action, actor_id, actor_email, target_user_id, target_user_email, role_key, details)
select * from (values
  (now() - interval '9 days',
   'user.created', '11111111-1111-4111-8111-111111111111'::uuid, 'ada.lovelace@example.com',
   '33333333-3333-4333-8333-333333333333'::uuid, 'alan.turing@example.com', null::text,
   '{}'::jsonb),

  (now() - interval '9 days',
   'role.granted', '11111111-1111-4111-8111-111111111111'::uuid, 'ada.lovelace@example.com',
   '33333333-3333-4333-8333-333333333333'::uuid, 'alan.turing@example.com', 'support',
   '{"before": [], "after": ["support"]}'),

  (now() - interval '6 days',
   'user.created', '11111111-1111-4111-8111-111111111111'::uuid, 'ada.lovelace@example.com',
   '44444444-4444-4444-8444-444444444444'::uuid, 'katherine.j@example.com', null,
   '{}'),

  (now() - interval '6 days',
   'role.granted', '11111111-1111-4111-8111-111111111111'::uuid, 'ada.lovelace@example.com',
   '44444444-4444-4444-8444-444444444444'::uuid, 'katherine.j@example.com', 'viewer',
   '{"before": [], "after": ["viewer"]}'),

  (now() - interval '4 days',
   'role.granted', '22222222-2222-4222-8222-222222222222'::uuid, 'grace.hopper@example.com',
   '44444444-4444-4444-8444-444444444444'::uuid, 'katherine.j@example.com', 'support',
   '{"before": ["viewer"], "after": ["support", "viewer"]}'),

  (now() - interval '2 days',
   'user.created', '22222222-2222-4222-8222-222222222222'::uuid, 'grace.hopper@example.com',
   '66666666-6666-4666-8666-666666666666'::uuid, 'barbara.liskov@example.com', null,
   '{}'),

  (now() - interval '1 day',
   'role.revoked', '11111111-1111-4111-8111-111111111111'::uuid, 'ada.lovelace@example.com',
   '55555555-5555-4555-8555-555555555555'::uuid, 'margaret.h@example.com', 'support',
   '{"before": ["support", "viewer"], "after": ["viewer"]}')
) as seed_rows
where not exists (select 1 from audit_logs);
