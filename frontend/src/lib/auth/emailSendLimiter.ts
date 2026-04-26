import { User } from '@supabase/supabase-js';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';
import { normalizeEmail } from './validation';

const LIMITER_METADATA_KEY = 'tenantvoice_verification_email_limiter';
const HOUR_MS = 60 * 60 * 1000;
const COOLDOWN_MS = 30 * 60 * 1000;
const MAX_EMAILS_PER_HOUR = 3;

type LimiterState = {
  window_start_ms: number;
  sent_count: number;
  blocked_until_ms: number | null;
};

type LimiterResult =
  | { ok: true }
  | {
      ok: false;
      retryAfterSeconds: number;
      message: string;
    };

function parseLimiterState(raw: unknown, nowMs: number): LimiterState {
  if (typeof raw !== 'object' || raw === null) {
    return {
      window_start_ms: nowMs,
      sent_count: 0,
      blocked_until_ms: null,
    };
  }

  const source = raw as Record<string, unknown>;
  const windowStart = Number(source.window_start_ms);
  const sentCount = Number(source.sent_count);
  const blockedUntilRaw = source.blocked_until_ms;

  const parsed: LimiterState = {
    window_start_ms: Number.isFinite(windowStart) ? windowStart : nowMs,
    sent_count: Number.isFinite(sentCount) ? Math.max(0, Math.floor(sentCount)) : 0,
    blocked_until_ms:
      blockedUntilRaw === null || blockedUntilRaw === undefined
        ? null
        : Number.isFinite(Number(blockedUntilRaw))
          ? Number(blockedUntilRaw)
          : null,
  };

  if (nowMs - parsed.window_start_ms >= HOUR_MS) {
    return {
      window_start_ms: nowMs,
      sent_count: 0,
      blocked_until_ms: null,
    };
  }

  return parsed;
}

function buildRetryMessage() {
  return 'Too many verification emails have been sent. Please try again in 30 minutes.';
}

async function updateLimiterState(user: User, nextState: LimiterState) {
  const supabase = getSupabaseServerClient();
  const nextMetadata = {
    ...(user.user_metadata ?? {}),
    [LIMITER_METADATA_KEY]: nextState,
  };

  const updateResult = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: nextMetadata,
  });

  if (updateResult.error) {
    throw new Error(`update verification email limiter failed: ${updateResult.error.message}`);
  }
}

async function getAuthUsersByEmail(email: string): Promise<User[]> {
  const supabase = getSupabaseServerClient();
  const target = normalizeEmail(email);
  const users: User[] = [];
  let page = 1;
  const perPage = 200;

  while (page <= 25) {
    const listResult = await supabase.auth.admin.listUsers({ page, perPage });
    if (listResult.error) {
      throw new Error(`list auth users failed: ${listResult.error.message}`);
    }

    const current = listResult.data.users ?? [];
    users.push(...current.filter((user) => normalizeEmail(user.email ?? '') === target));

    if (current.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

export async function findLatestAuthUserByEmail(email: string): Promise<User | null> {
  const users = await getAuthUsersByEmail(email);
  if (users.length === 0) {
    return null;
  }

  users.sort((a, b) => {
    const aTs = new Date(a.created_at ?? 0).getTime();
    const bTs = new Date(b.created_at ?? 0).getTime();
    return bTs - aTs;
  });

  return users[0] ?? null;
}

export async function consumeVerificationEmailQuotaByUser(user: User): Promise<LimiterResult> {
  const nowMs = Date.now();
  const currentState = parseLimiterState(user.user_metadata?.[LIMITER_METADATA_KEY], nowMs);

  if (currentState.blocked_until_ms && nowMs < currentState.blocked_until_ms) {
    const retryAfterSeconds = Math.ceil((currentState.blocked_until_ms - nowMs) / 1000);
    return {
      ok: false,
      retryAfterSeconds,
      message: buildRetryMessage(),
    };
  }

  if (currentState.sent_count >= MAX_EMAILS_PER_HOUR) {
    const blockedUntil = nowMs + COOLDOWN_MS;
    const blockedState: LimiterState = {
      ...currentState,
      blocked_until_ms: blockedUntil,
    };

    await updateLimiterState(user, blockedState);

    return {
      ok: false,
      retryAfterSeconds: Math.ceil(COOLDOWN_MS / 1000),
      message: buildRetryMessage(),
    };
  }

  const nextState: LimiterState = {
    ...currentState,
    sent_count: currentState.sent_count + 1,
    blocked_until_ms: null,
  };

  await updateLimiterState(user, nextState);
  return { ok: true };
}

export async function consumeVerificationEmailQuotaByEmail(email: string): Promise<LimiterResult> {
  const user = await findLatestAuthUserByEmail(email);
  if (!user) {
    return { ok: true };
  }

  return consumeVerificationEmailQuotaByUser(user);
}
