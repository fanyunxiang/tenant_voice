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

type QuotaBlockedResult = {
  ok: false;
  retryAfterSeconds: number;
  message: string;
};

type QuotaAllowedResult = {
  ok: true;
};

export type QuotaCheckResult = QuotaAllowedResult | QuotaBlockedResult;

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

function toBlockedResult(retryAfterMs: number): QuotaBlockedResult {
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    message: buildRetryMessage(),
  };
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

export async function checkVerificationEmailQuotaByUser(user: User): Promise<QuotaCheckResult> {
  const nowMs = Date.now();
  let state = parseLimiterState(user.user_metadata?.[LIMITER_METADATA_KEY], nowMs);

  // Cooldown has elapsed: start a fresh sending window.
  if (state.blocked_until_ms && nowMs >= state.blocked_until_ms) {
    state = {
      window_start_ms: nowMs,
      sent_count: 0,
      blocked_until_ms: null,
    };
  }

  if (state.blocked_until_ms && nowMs < state.blocked_until_ms) {
    return toBlockedResult(state.blocked_until_ms - nowMs);
  }

  if (state.sent_count >= MAX_EMAILS_PER_HOUR) {
    const blockedUntil = nowMs + COOLDOWN_MS;
    await updateLimiterState(user, {
      window_start_ms: nowMs,
      sent_count: 0,
      blocked_until_ms: blockedUntil,
    });
    return toBlockedResult(COOLDOWN_MS);
  }

  return { ok: true };
}

export async function checkVerificationEmailQuotaByEmail(email: string): Promise<{
  quota: QuotaCheckResult;
  user: User | null;
}> {
  const user = await findLatestAuthUserByEmail(email);
  if (!user) {
    return { quota: { ok: true }, user: null };
  }

  const quota = await checkVerificationEmailQuotaByUser(user);
  return { quota, user };
}

export async function recordVerificationEmailSentByUser(user: User): Promise<void> {
  const nowMs = Date.now();
  let state = parseLimiterState(user.user_metadata?.[LIMITER_METADATA_KEY], nowMs);

  if (state.blocked_until_ms && nowMs >= state.blocked_until_ms) {
    state = {
      window_start_ms: nowMs,
      sent_count: 0,
      blocked_until_ms: null,
    };
  }

  const nextState: LimiterState = {
    window_start_ms: state.window_start_ms,
    sent_count: state.sent_count + 1,
    blocked_until_ms: null,
  };

  await updateLimiterState(user, nextState);
}
