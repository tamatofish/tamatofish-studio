'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    __SUPABASE_CONFIG__?: {
      url: string;
      anonKey: string;
    };
  }
}

const SUPABASE_CONFIG_READY_EVENT = 'supabase-config-ready';

let browserClient: SupabaseClient | null = null;

function waitForConfig(maxWait = 5000): Promise<boolean> {
  if (window.__SUPABASE_CONFIG__?.url && window.__SUPABASE_CONFIG__?.anonKey) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let resolved = false;
    const handler = () => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener(SUPABASE_CONFIG_READY_EVENT, handler);
        resolve(true);
      }
    };
    window.addEventListener(SUPABASE_CONFIG_READY_EVENT, handler);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener(SUPABASE_CONFIG_READY_EVENT, handler);
        resolve(
          !!(window.__SUPABASE_CONFIG__?.url && window.__SUPABASE_CONFIG__?.anonKey)
        );
      }
    }, maxWait);
  });
}

function isConfigReady(): boolean {
  return !!(window.__SUPABASE_CONFIG__?.url && window.__SUPABASE_CONFIG__?.anonKey);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient === null) {
    const config = window.__SUPABASE_CONFIG__;
    if (!config || !config.url || !config.anonKey) {
      throw new Error(
        'Supabase config not found. Make sure SupabaseConfigProvider is included in your layout.tsx.'
      );
    }
    // 用 @supabase/ssr，session 自动存到 Cookie，兼容所有浏览器
    browserClient = createBrowserClient(config.url, config.anonKey);
  }
  return browserClient;
}

async function getSupabaseBrowserClientWithRetry(
  maxRetries = 5,
  retryInterval = 1000
): Promise<SupabaseClient> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return getSupabaseBrowserClient();
    } catch {
      if (i < maxRetries - 1) await sleep(retryInterval);
    }
  }
  return getSupabaseBrowserClient();
}

async function getSupabaseBrowserClientAsync(): Promise<SupabaseClient> {
  if (browserClient !== null) return browserClient;
  const ready = await waitForConfig();
  if (!ready) {
    throw new Error('Supabase config not found after waiting.');
  }
  return getSupabaseBrowserClient();
}

export {
  getSupabaseBrowserClient,
  getSupabaseBrowserClientWithRetry,
  getSupabaseBrowserClientAsync,
  waitForConfig,
  isConfigReady,
};