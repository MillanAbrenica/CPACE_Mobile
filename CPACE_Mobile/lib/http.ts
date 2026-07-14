// HTTP client for the CPACE Mobile API — the app's own PHP backend at
// "SEM Project APP DEV\cpace-mobile-api" (start it with start-api.bat).
//
// Base URL resolution:
//  - By default the dev-machine host is derived from the Expo dev server
//    (Constants.expoConfig.hostUri), so a phone on the same Wi-Fi reaches
//    the PHP server on your PC automatically.
//  - Set API_HOST_OVERRIDE if your setup differs (e.g. 'http://192.168.1.5:8080').

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Leave empty to auto-detect from the Expo dev server host.
// Example override: 'http://192.168.1.5:8080'
const API_HOST_OVERRIDE = '';

// Port the standalone PHP backend listens on (see cpace-mobile-api/start-api.bat).
const API_PORT = 8080;
const API_PATH = '/api';

const TOKEN_KEY = 'cpace.token';

function resolveHost(): string {
  if (API_HOST_OVERRIDE) return API_HOST_OVERRIDE;
  const hostUri: string | undefined =
    (Constants.expoConfig as any)?.hostUri ?? (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  const host = hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:${API_PORT}`;
}

export const API_BASE = `${resolveHost()}${API_PATH}`;

let token: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (token) return token;
  token = await AsyncStorage.getItem(TOKEN_KEY);
  return token;
}

export async function setToken(value: string | null): Promise<void> {
  token = value;
  if (value) await AsyncStorage.setItem(TOKEN_KEY, value);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (auth) {
    const t = await loadToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach the CPACE Mobile API at ${API_BASE}. Make sure start-api.bat is running and your phone is on the same Wi-Fi.`,
    );
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON response (e.g. HTML error page)
  }

  if (!res.ok) {
    const message = json?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, json?.errors);
  }

  return json as T;
}
