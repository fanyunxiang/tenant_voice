import { NextResponse } from 'next/server';
import { getSupabaseEnv } from 'lib/supabase/env';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();
    const supabase = getSupabaseServerClient();

    const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${supabasePublishableKey}`,
      },
      cache: 'no-store',
    });

    if (!settingsResponse.ok) {
      const body = (await settingsResponse.text()).slice(0, 300);
      return NextResponse.json(
        {
          ok: false,
          message: 'Supabase auth endpoint is reachable but key validation failed.',
          status: settingsResponse.status,
          details: body,
        },
        { status: 502 },
      );
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Supabase client initialized, but session check failed.',
          details: sessionError.message,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Supabase connection is configured.',
      hasSession: Boolean(sessionData.session),
      project: supabaseUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        ok: false,
        message: 'Supabase is not configured correctly.',
        details: message,
      },
      { status: 500 },
    );
  }
}
