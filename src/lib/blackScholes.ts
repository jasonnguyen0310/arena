// Black-Scholes option pricing + Greeks.
// Pure functions, no dependencies. All time inputs in years (T = days / 365).

/** Standard-normal CDF via Abramowitz & Stegun 7.1.26 approximation. */
export function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

/** Standard-normal PDF. */
export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export type OptionKind = "call" | "put";

export type OptionPricing = {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // per day
  vega: number;  // per 1 vol point (0.01)
};

/**
 * @param S spot price
 * @param K strike
 * @param T time to expiry in years
 * @param r risk-free rate (annualized, e.g. 0.04)
 * @param sigma implied volatility (e.g. 0.80 for 80%)
 * @param kind "call" or "put"
 */
export function bs(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  kind: OptionKind,
): OptionPricing {
  // Guard: intrinsic-only for zero or negative time.
  if (T <= 0 || sigma <= 0) {
    const intrinsic =
      kind === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
    return { price: intrinsic, delta: kind === "call" ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0 };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const disc = Math.exp(-r * T);

  const Nd1 = normCdf(d1);
  const Nd2 = normCdf(d2);
  const nd1 = normPdf(d1);

  let price: number;
  let delta: number;
  let theta: number;
  if (kind === "call") {
    price = S * Nd1 - K * disc * Nd2;
    delta = Nd1;
    theta = (-(S * nd1 * sigma) / (2 * sqrtT) - r * K * disc * Nd2) / 365;
  } else {
    price = K * disc * normCdf(-d2) - S * normCdf(-d1);
    delta = Nd1 - 1;
    theta = (-(S * nd1 * sigma) / (2 * sqrtT) + r * K * disc * normCdf(-d2)) / 365;
  }
  const gamma = nd1 / (S * sigma * sqrtT);
  const vega = (S * nd1 * sqrtT) / 100; // per 1 vol point (0.01)

  return { price, delta, gamma, theta, vega };
}

/** Convert a date string (YYYY-MM-DD) to days-until-expiry from today at 4pm ET. */
export function daysUntil(expirationISO: string, now = new Date()): number {
  const exp = new Date(`${expirationISO}T20:00:00Z`); // 4pm ET ~= 8pm UTC
  const diffMs = exp.getTime() - now.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Probability the stock TOUCHES a barrier price at any point before time T.
 * Uses the reflection principle for geometric Brownian motion with drift r.
 * Returns a number in [0, 1].
 */
export function probTouchBarrier(
  S: number,
  barrier: number,
  T: number,
  r: number,
  sigma: number,
): number {
  if (T <= 0 || sigma <= 0 || S <= 0 || barrier <= 0) return 0;
  if (S === barrier) return 1;
  const nu = r - 0.5 * sigma * sigma;
  const a = Math.log(barrier / S);
  const sqrtT = Math.sqrt(T);
  const upside = barrier > S;

  if (upside) {
    if (S >= barrier) return 1;
    const t1 = normCdf((-a + nu * T) / (sigma * sqrtT));
    const t2 = Math.exp((2 * nu * a) / (sigma * sigma)) * normCdf((-a - nu * T) / (sigma * sqrtT));
    return Math.max(0, Math.min(1, t1 + t2));
  } else {
    // downside barrier; a < 0
    if (S <= barrier) return 1;
    const t1 = normCdf((a - nu * T) / (sigma * sqrtT));
    const t2 = Math.exp((2 * nu * a) / (sigma * sigma)) * normCdf((a + nu * T) / (sigma * sqrtT));
    return Math.max(0, Math.min(1, t1 + t2));
  }
}

/**
 * Probability the stock FINISHES at/above (for calls) or at/below (for puts) the target at time T.
 * Uses the lognormal terminal distribution under GBM.
 */
export function probFinishBeyond(
  S: number,
  target: number,
  T: number,
  r: number,
  sigma: number,
  kind: OptionKind,
): number {
  if (T <= 0 || sigma <= 0 || S <= 0 || target <= 0) return 0;
  const sqrtT = Math.sqrt(T);
  const d = (Math.log(S / target) + (r - 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  return kind === "call" ? normCdf(d) : normCdf(-d);
}

/**
 * Back-solve implied volatility from a known market price via bisection.
 * Returns null if the price is impossible (below intrinsic) or search fails.
 */
export function impliedVol(
  marketPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  kind: OptionKind,
): number | null {
  if (T <= 0 || marketPrice <= 0) return null;
  const intrinsic = kind === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
  if (marketPrice < intrinsic - 0.005) return null;

  let lo = 0.001;
  let hi = 5; // 500% IV upper bound
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const p = bs(S, K, T, r, mid, kind).price;
    if (Math.abs(p - marketPrice) < 0.001) return mid;
    if (p < marketPrice) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
