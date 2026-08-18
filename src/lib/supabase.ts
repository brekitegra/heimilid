import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://odwnrzasatbvwjxdbuqr.supabase.co';
const supabaseAnonKey = 'sb_publishable_jxwNEgBXtzUoJLuw1O-T6A_ckTKk-Uo';

// Named explicitly (rather than relying on supabase-js's auto-derived
// default) so other code — the "Remember me" opt-out below — can reliably
// remove exactly this key from storage.
export const SUPABASE_AUTH_STORAGE_KEY = 'heimilid-auth';

// On web, Expo Router's `web.output: "static"` server-renders each route in
// Node before it ever reaches a browser. AsyncStorage's web implementation
// touches `window` as soon as it's called, which throws in that SSR pass.
// Native platforms always have a real storage layer, so only gate on web.
const isBrowser = Platform.OS !== 'web' || typeof window !== 'undefined';

// supabase-js always constructs a Realtime client, which eagerly resolves a
// WebSocket constructor and throws if none is found — and SSR's Node process
// has no global WebSocket (only Node 22+ does). This app never opens a
// realtime channel, so SSR just needs construction to succeed; this stand-in
// is never actually connected. Native/browser runtimes keep using their own
// global WebSocket (transport left undefined there).
class NoopWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = NoopWebSocket.CONNECTING;
  readonly OPEN = NoopWebSocket.OPEN;
  readonly CLOSING = NoopWebSocket.CLOSING;
  readonly CLOSED = NoopWebSocket.CLOSED;
  readonly readyState = NoopWebSocket.CLOSED;
  readonly protocol = '';
  onopen = null;
  onmessage = null;
  onclose = null;
  onerror = null;

  readonly url: string;
  constructor(address: string | URL) {
    this.url = String(address);
  }
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

// Where Supabase should send people back to after an email confirmation or
// password-reset link — our own /auth-callback route, which parses the
// tokens in the URL and either signs them in or lets them set a new
// password. Must be added to this project's Auth > URL Configuration >
// Redirect URLs allow-list in the Supabase dashboard, or Supabase will
// silently ignore it and fall back to the project's default Site URL.
export function getAuthCallbackUrl() {
  return Platform.OS === 'web' ? `${window.location.origin}/auth-callback` : Linking.createURL('/auth-callback');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isBrowser ? AsyncStorage : undefined,
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    autoRefreshToken: isBrowser,
    persistSession: isBrowser,
    detectSessionInUrl: false,
  },
  realtime: isBrowser ? undefined : { transport: NoopWebSocket },
});