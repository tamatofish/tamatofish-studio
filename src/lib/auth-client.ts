'use client';

import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';

/**
 * 携带登录态（x-session header）调用业务接口。
 * 未登录时跳转登录页并返回 undefined。
 */
export async function callAuthenticatedApi(path: string, options?: RequestInit): Promise<Response | undefined> {
  const supabase = await getSupabaseBrowserClientWithRetry();
  const { data: { session } } = await supabase.auth.getSession();

  // ===== 临时 debug =====
  console.log('[auth-api] path =', path);
  console.log('[auth-api] session exists?', !!session);
  console.log('[auth-api] token length =', session?.access_token?.length ?? 0);
  console.log('[auth-api] token first 30 =', session?.access_token?.slice(0, 30));
  // ======================

  if (!session) {
    window.location.href = '/login';
    return undefined;
  }

  const headers = {
    ...(options?.headers || {}),
    'x-session': session.access_token,
  };

  // ===== 临时 debug =====
  console.log('[auth-api] final headers =', headers);
  // ======================

  return fetch(path, {
    ...options,
    headers,
  });
}