// Amounts are decimal strings from the API. We convert them to BigInt "base units"
// (amount * 10^decimals) so that math is exact even for ETH's 18 decimals.

const API_FORMAT = /^(0|[1-9]\d*)(\.\d+)?$/;

export function toUnits(s: string, decimals: number): bigint {
  const m = /^(-?)(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) throw new Error(`bad amount: ${s}`);
  const frac = m[3] ?? '';
  if (frac.length > decimals) throw new Error(`too many decimals: ${s}`);
  const units = BigInt(m[2] + frac.padEnd(decimals, '0'));
  return m[1] ? -units : units;
}

export function fromUnits(u: bigint, decimals: number): string {
  const neg = u < 0n;
  const s = (neg ? -u : u).toString().padStart(decimals + 1, '0');
  const int = s.slice(0, s.length - decimals);
  const frac = decimals ? s.slice(-decimals).replace(/0+$/, '') : '';
  return (neg ? '-' : '') + int + (frac ? '.' + frac : '');
}

export type AmountCheck =
  | { ok: true; units: bigint; amount: string; fee: bigint; receive: bigint }
  | { ok: false; error: string };

/** Validate user input against the API rules: format, decimals, min, available, and fee. */
export function checkAmount(
  input: string,
  o: { decimals: number; available: string; minAmount: string; fee: string },
): AmountCheck {
  const s = input.trim().replace(',', '.');
  if (!s) return { ok: false, error: 'Enter an amount' };
  if (!API_FORMAT.test(s)) return { ok: false, error: 'Use digits like 0.5 or 12' };
  if ((s.split('.')[1] ?? '').length > o.decimals)
    return { ok: false, error: `At most ${o.decimals} decimal places` };
  const units = toUnits(s, o.decimals);
  const min = toUnits(o.minAmount, o.decimals);
  const avail = toUnits(o.available, o.decimals);
  const fee = toUnits(o.fee, o.decimals);
  if (units < min) return { ok: false, error: `Minimum is ${o.minAmount}` };
  if (units > avail) return { ok: false, error: `Only ${o.available} available` };
  if (units <= fee) return { ok: false, error: 'Amount must be greater than the fee' };
  return { ok: true, units, amount: fromUnits(units, o.decimals), fee, receive: units - fee };
}

/** USD value of an amount, rounded to cents. The price is a decimal string with any precision. */
export function usdCents(amount: string, decimals: number, usdPrice: string): bigint {
  const pDec = (usdPrice.split('.')[1] ?? '').length;
  const product = toUnits(amount, decimals) * toUnits(usdPrice, pDec) * 100n;
  const scale = 10n ** BigInt(decimals + pDec);
  return (product + scale / 2n) / scale; // round half up (amounts are non-negative)
}

export function formatUsd(cents: bigint): string {
  const s = fromUnits(cents, 2);
  const [i, f = ''] = s.split('.');
  return '$' + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + f.padEnd(2, '0');
}
