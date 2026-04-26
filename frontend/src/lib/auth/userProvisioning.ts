import { getSupabaseServerClient } from 'lib/supabase/serverClient';
import { DATABASE_ROLE_MAP, RegisterableRole, ROLE_PROFILE_TABLE_MAP } from './roles';

type ExistingUserRow = {
  id: string;
  primary_role: string;
  status: string;
};

export type AppUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  primary_role: string;
  status: string;
};

type ProvisionUserParams = {
  authUserId: string;
  email: string;
  fullName?: string;
  role: RegisterableRole;
  status?: 'PENDING_VERIFICATION' | 'ACTIVE';
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const assertOperation = (operationName: string, error: { message: string } | null) => {
  if (!error) {
    return;
  }

  throw new Error(`${operationName} failed: ${error.message}`);
};

const findExistingUser = async (authUserId: string, email: string): Promise<ExistingUserRow | null> => {
  const supabase = getSupabaseServerClient();

  const byAuth = await supabase
    .from('users')
    .select('id, primary_role, status')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  assertOperation('find user by auth id', byAuth.error);
  if (byAuth.data) {
    return byAuth.data as ExistingUserRow;
  }

  const byEmail = await supabase
    .from('users')
    .select('id, primary_role, status')
    .eq('email', email)
    .maybeSingle();

  assertOperation('find user by email', byEmail.error);
  return (byEmail.data as ExistingUserRow | null) ?? null;
};

export async function provisionUserRecord({
  authUserId,
  email,
  fullName,
  role,
  status = 'PENDING_VERIFICATION',
}: ProvisionUserParams): Promise<AppUserRow> {
  const supabase = getSupabaseServerClient();
  const roleValue = DATABASE_ROLE_MAP[role];
  const normalizedEmail = normalizeEmail(email);
  const existing = await findExistingUser(authUserId, normalizedEmail);
  const nowIso = new Date().toISOString();

  const userPayload = {
    auth_user_id: authUserId,
    email: normalizedEmail,
    full_name: fullName?.trim() || null,
    primary_role: roleValue,
    status,
    updated_at: nowIso,
  };

  const userResult = existing
    ? await supabase
        .from('users')
        .update(userPayload)
        .eq('id', existing.id)
        .select('id, email, full_name, primary_role, status')
        .single()
    : await supabase
        .from('users')
        .insert({
          // Some environments miss a default UUID on users.id.
          // Reusing the Supabase auth user id keeps app user creation deterministic.
          id: authUserId,
          created_at: nowIso,
          ...userPayload,
        })
        .select('id, email, full_name, primary_role, status')
        .single();

  assertOperation(existing ? 'update app user' : 'create app user', userResult.error);

  const appUser = userResult.data as AppUserRow;

  const clearPrimaryRole = await supabase
    .from('user_role_assignments')
    .update({ is_primary: false })
    .eq('user_id', appUser.id)
    .neq('role', roleValue);
  assertOperation('clear previous primary role', clearPrimaryRole.error);

  const existingRoleAssignment = await supabase
    .from('user_role_assignments')
    .select('id')
    .eq('user_id', appUser.id)
    .eq('role', roleValue)
    .maybeSingle();
  assertOperation('find user role assignment', existingRoleAssignment.error);

  const ensureRole = existingRoleAssignment.data
    ? await supabase
        .from('user_role_assignments')
        .update({ is_primary: true })
        .eq('id', existingRoleAssignment.data.id)
    : await supabase.from('user_role_assignments').insert({
        id: globalThis.crypto.randomUUID(),
        user_id: appUser.id,
        role: roleValue,
        is_primary: true,
        created_at: nowIso,
      });
  assertOperation(
    existingRoleAssignment.data ? 'update user role assignment' : 'create user role assignment',
    ensureRole.error,
  );

  const profileTable = ROLE_PROFILE_TABLE_MAP[role];
  const ensureProfile = await supabase
    .from(profileTable)
    .upsert(
      {
        user_id: appUser.id,
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'user_id' },
    );
  assertOperation(`upsert ${profileTable}`, ensureProfile.error);

  return appUser;
}

export async function activateUser(authUserId: string) {
  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const result = await supabase
    .from('users')
    .update({ status: 'ACTIVE', updated_at: nowIso })
    .eq('auth_user_id', authUserId);

  assertOperation('activate user', result.error);
}

export async function findAppUserByAuthUserId(authUserId: string): Promise<AppUserRow | null> {
  const supabase = getSupabaseServerClient();
  const result = await supabase
    .from('users')
    .select('id, email, full_name, primary_role, status')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  assertOperation('query app user', result.error);
  return (result.data as AppUserRow | null) ?? null;
}
