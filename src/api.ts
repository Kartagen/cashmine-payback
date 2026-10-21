export const BASE_URL = 'https://task-api.cashmine.io';

const TOKEN_KEY = 'cm.token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
/** Claims tracked on this device belong to the old token, so they are dropped too. */
export const setToken = (t: string | null) => {
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('cm.claims');
};

export type Balance = {
  asset: string; decimals: number; available: string; pending: string; claiming: string; usdPrice: string;
};
export type Balances = { asOf: string; items: Balance[] };
export type Activity = {
  id: string; type: 'accrual' | 'reversal' | 'claim'; asset: string; amount: string; status: string;
  exchange: string | null; createdAt: string; relatedId: string | null;
};
export type ClaimOptions = {
  asset: string; minAmount: string; fee: string; destinations: { id: string; label: string }[];
};
export type ClaimBody = { asset: string; amount: string; destinationId: string };
export type Claim = ClaimBody & {
  id: string; fee: string; receiveAmount: string; status: 'pending' | 'completed' | 'failed';
  failureReason: string | null; createdAt: string; updatedAt: string;
};

export class ApiError extends Error {
  constructor(
    public status: number, // 0 = network error / client timeout
    public code: string,
    message: string,
    public field?: string,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
  /** The server may or may not have done the work (timeout, lost response, 5xx). */
  get outcomeUnknown() {
    return this.status === 0 || this.status >= 500;
  }
}

const TIMEOUT_MS = 15000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function once<T>(path: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(BASE_URL + path, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error or timeout');
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error ?? {};
    const retry = e.retryAfterMs ?? Number(res.headers.get('Retry-After') ?? 1) * 1000;
    throw new ApiError(res.status, e.code ?? 'SERVER', e.message ?? `HTTP ${res.status}`, e.field, retry);
  }
  return body as T;
}

/**
 * Retries rate limits and temporary failures. Only safe for idempotent requests:
 * GETs, and POST /claims because it always carries the same Idempotency-Key.
 */
async function request<T>(path: string, init?: RequestInit, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await once<T>(path, init);
    } catch (e) {
      const retryable = e instanceof ApiError && (e.status === 429 || e.outcomeUnknown);
      if (!retryable || i >= tries) throw e;
      await sleep(e.status === 429 ? e.retryAfterMs ?? 1000 : 500 * 2 ** i);
    }
  }
}

export const api = {
  balances: () => request<Balances>('/v1/balances'),
  activity: (cursor?: string | null) =>
    request<{ items: Activity[]; nextCursor: string | null }>(
      `/v1/activity?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  claimOptions: (asset: string) => request<ClaimOptions>(`/v1/claim-options?asset=${encodeURIComponent(asset)}`),
  createClaim: (body: ClaimBody, idempotencyKey: string) =>
    request<Claim>('/v1/claims', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  claim: (id: string) => request<Claim>(`/v1/claims/${encodeURIComponent(id)}`),
};
