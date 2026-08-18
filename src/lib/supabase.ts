import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://odwnrzasatbvwjxdbuqr.supabase.co';
const supabaseAnonKey = 'sb_publishable_jxwNEgBXtzUoJLuw1O-T6A_ckTKk-Uo';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isBrowser ? AsyncStorage : undefined,
    autoRefreshToken: isBrowser,
    persistSession: isBrowser,
    detectSessionInUrl: false,
  },
  realtime: isBrowser ? undefined : { transport: NoopWebSocket },
});