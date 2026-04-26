begin;

-- Map auth.uid() -> public.users.id for RLS checks.
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_user_id = auth.uid()
  limit 1
$$;

grant execute on function public.current_app_user_id() to authenticated;

-- Grant read permissions required by Realtime (actual row access is still controlled by RLS).
grant usage on schema public to authenticated;
grant select on public.conversations to authenticated;
grant select on public.conversation_participants to authenticated;
grant select on public.messages to authenticated;

-- conversation_participants: user can only read their own participant records.
drop policy if exists "conversation_participants_select_self" on public.conversation_participants;
create policy "conversation_participants_select_self"
on public.conversation_participants
for select
to authenticated
using (user_id = public.current_app_user_id());

-- conversations: user can only read conversations they participate in.
drop policy if exists "conversations_select_member" on public.conversations;
create policy "conversations_select_member"
on public.conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = public.current_app_user_id()
  )
);

-- messages: user can only read messages from conversations they participate in.
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = public.current_app_user_id()
  )
);

-- Ensure tables are included in Supabase Realtime publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_participants'
  ) then
    alter publication supabase_realtime add table public.conversation_participants;
  end if;
end $$;

commit;
