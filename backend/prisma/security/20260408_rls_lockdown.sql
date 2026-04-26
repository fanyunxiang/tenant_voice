begin;

-- Lock down every current table in public schema.
do $$
declare
  t record;
begin
  for t in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('alter table %I.%I enable row level security', t.schema_name, t.table_name);
    execute format('alter table %I.%I force row level security', t.schema_name, t.table_name);
    execute format('revoke all on table %I.%I from anon', t.schema_name, t.table_name);
    execute format('revoke all on table %I.%I from authenticated', t.schema_name, t.table_name);
  end loop;
end $$;

-- Also revoke sequence privileges from anon/authenticated.
do $$
declare
  s record;
begin
  for s in
    select sequence_schema, sequence_name
    from information_schema.sequences
    where sequence_schema = 'public'
  loop
    execute format('revoke all on sequence %I.%I from anon', s.sequence_schema, s.sequence_name);
    execute format('revoke all on sequence %I.%I from authenticated', s.sequence_schema, s.sequence_name);
  end loop;
end $$;

-- Prevent future tables/sequences/functions in public from becoming publicly accessible by default.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on sequences from authenticated;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on functions from authenticated;

commit;
