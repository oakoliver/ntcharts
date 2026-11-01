// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// Go float64 arithmetic as upstream computes it on arm64, the platform the
// parity goldens are generated on.
//
// Two things differ from plain JavaScript:
//
//  1. The Go compiler fuses `a + b*c` (and `a - b*c`, `b*c - a`) into one
//     fused multiply-add instruction on arm64, rounding once instead of
//     twice. fma() reproduces that; the charts call it wherever upstream's
//     compiled code does.
//  2. Go's math.Log, Log10, Exp and Pow are Go's own algorithms (pure Go
//     compiled with fused multiply-adds, or arm64 assembly), not the
//     engine's libm, and differ from Math.log10/Math.pow in the last bit for
//     many inputs. They are ported here operation for operation, following
//     the arm64 machine code of Go 1.26.

const view = new DataView(new ArrayBuffer(8));

function bits(x: number): bigint {
  view.setFloat64(0, x);
  return view.getBigUint64(0);
}

function fromBits(b: bigint): number {
  view.setBigUint64(0, BigInt.asUintN(64, b));
  return view.getFloat64(0);
}

/** x = mant * 2^exp exactly, with mant a signed integer. x must be finite. */
function decompose(x: number): [bigint, number] {
  const b = bits(x);
  const neg = b >> 63n === 1n;
  const e = Number((b >> 52n) & 0x7ffn);
  const frac = b & 0xfffffffffffffn;
  let mant: bigint;
  let exp: number;
  if (e === 0) {
    mant = frac;
    exp = -1074;
  } else {
    mant = frac | 0x10000000000000n;
    exp = e - 1075;
  }
  return [neg ? -mant : mant, exp];
}

/** Rounds the exact value s * 2^e to the nearest float64, ties to even. */
function roundToFloat(s: bigint, e: number): number {
  if (s === 0n) return 0;
  const neg = s < 0n;
  let a = neg ? -s : s;
  const n = a.toString(2).length;
  const top = e + n - 1; // exponent of the leading bit
  let shift = top < -1022 ? -1074 - e : n - 53;
  let q: bigint;
  if (shift <= 0) {
    q = a << BigInt(-shift);
  } else {
    const sb = BigInt(shift);
    q = a >> sb;
    const rem = a & ((1n << sb) - 1n);
    const half = 1n << (sb - 1n);
    if (rem > half || (rem === half && (q & 1n) === 1n)) q += 1n;
  }
  let qe = e + shift;
  if (q === 1n << 53n) {
    q >>= 1n;
    qe += 1;
  }
  let out: number;
  if (q >= 1n << 52n) {
    const biased = qe + 52 + 1023;
    if (biased >= 0x7ff) out = Infinity;
    else out = fromBits((BigInt(biased) << 52n) | (q - (1n << 52n)));
  } else {
    out = fromBits(q); // subnormal: qe is -1074
  }
  a = 0n;
  return neg ? -out : out;
}

// Veltkamp split constant for the exact-product test below.
const SPLIT = 134217729; // 2^27 + 1

/** Exact rounding error of a*b (Dekker's TwoProduct); valid away from overflow and underflow. */
function productError(a: number, b: number, p: number): number {
  let t = SPLIT * a;
  const ah = t - (t - a);
  const al = a - ah;
  t = SPLIT * b;
  const bh = t - (t - b);
  const bl = b - bh;
  return al * bl - (((p - ah * bh) - al * bh) - ah * bl);
}

/** fma returns a*b + c computed with a single rounding, like Go's math.FMA and arm64 FMADD. */
export function fma(a: number, b: number, c: number): number {
  const p = a * b;
  if (a === 0 || b === 0 || !Number.isFinite(a) || !Number.isFinite(b) || Number.isNaN(c)) return p + c;
  if (c === 0) return p; // hardware FMA: the sign of a tiny product survives
  if (!Number.isFinite(c)) return c; // finite a*b plus an infinity
  const ap = Math.abs(p);
  if (ap < 1e300 && ap > 1e-280 && Math.abs(a) < 1e300 && Math.abs(b) < 1e300) {
    if (productError(a, b, p) === 0) return p + c; // product is exact: one rounding
  }
  const [ma, ea] = decompose(a);
  const [mb, eb] = decompose(b);
  const [mc, ec] = decompose(c);
  const mp = ma * mb;
  const ep = ea + eb;
  const e = Math.min(ep, ec);
  const s = (mp << BigInt(ep - e)) + (mc << BigInt(ec - e));
  return roundToFloat(s, e);
}

/** Go's math.Frexp: x = frac * 2^exp with frac in [0.5, 1). */
export function frexp(f: number): [number, number] {
  if (f === 0 || !Number.isFinite(f)) return [f, 0];
  let exp = 0;
  if (Math.abs(f) < 2.2250738585072014e-308) {
    f = f * 4503599627370496; // 1 << 52
    exp = -52;
  }
  let x = bits(f);
  exp += Number((x >> 52n) & 0x7ffn) - 1023 + 1;
  x &= ~(0x7ffn << 52n);
  x |= 1022n << 52n;
  return [fromBits(x), exp];
}

/** Go's math.Ldexp: frac * 2^exp. */
export function ldexp(frac: number, exp: number): number {
  if (frac === 0 || !Number.isFinite(frac)) return frac;
  if (Math.abs(frac) < 2.2250738585072014e-308) {
    frac = frac * 4503599627370496;
    exp += -52;
  }
  let x = bits(frac);
  exp += Number((x >> 52n) & 0x7ffn) - 1023;
  if (exp < -1075) return frac < 0 ? -0 : 0; // underflow
  if (exp > 1023) return frac < 0 ? -Infinity : Infinity; // overflow
  let m = 1;
  if (exp < -1022) {
    // denormal
    exp += 53;
    m = 1.0 / 9007199254740992; // 2**-53
  }
  x &= ~(0x7ffn << 52n);
  x |= BigInt(exp + 1023) << 52n;
  return m * fromBits(x);
}

const Ln2Hi = 6.93147180369123816490e-01;
const Ln2Lo = 1.90821492927058770002e-10;
const L1 = 6.666666666666735130e-01;
const L2 = 3.999999999940941908e-01;
const L3 = 2.857142874366239149e-01;
const L4 = 2.222219843214978396e-01;
const L5 = 1.818357216161805012e-01;
const L6 = 1.531383769920937332e-01;
const L7 = 1.479819860511658591e-01;
const SQRT2_2 = 0.7071067811865476; // Sqrt2/2
/** Go's 1/Ln10 constant as a float64: log10(x) is log(x) * LOG10E. */
export const LOG10E = 0.4342944819032518;

/** Go's math.Log, as compiled for arm64 (with its fused multiply-adds). */
export function log(x: number): number {
  if (Number.isNaN(x) || x === Infinity) return x;
  if (x < 0) return NaN;
  if (x === 0) return -Infinity;
  let [f1, ki] = frexp(x);
  if (f1 < SQRT2_2) {
    f1 = f1 + f1;
    ki--;
  }
  const f = f1 - 1;
  const k = ki;
  const s = f / (2 + f);
  const s2 = s * s;
  const s4 = s2 * s2;
  const x1 = fma(s4, fma(s4, fma(s4, L7, L5), L3), L1);
  const t2 = s4 * fma(s4, fma(s4, L6, L4), L2);
  const R = fma(s2, x1, t2); // t1 + t2, t1 = s2*x1
  const hf = 0.5 * f;
  const hR = fma(hf, f, R); // hfsq + R
  const y = fma(s, hR, k * Ln2Lo); // s*(hfsq+R) + k*Ln2Lo
  const w = fma(hf, f, -y); // hfsq - y
  const v = w - f;
  return fma(k, Ln2Hi, -v); // k*Ln2Hi - v
}

/** Go's math.Log10. */
export function log10(x: number): number {
  return log(x) * LOG10E;
}

const Log2e = 1.44269504088896338700e+00;
const Overflow = 7.09782712893383973096e+02;
const Underflow = -7.45133219101941108420e+02;
const NearZero = 1.0 / (1 << 28); // 2**-28
const P1 = 1.66666666666666657415e-01;
const P2 = -2.77777777770155933842e-03;
const P3 = 6.61375632143793436117e-05;
const P4 = -1.65339022054652515390e-06;
const P5 = 4.13813679705723846039e-08;

/** Go's math.Exp: the arm64 assembly implementation (exp_arm64.s). */
export function exp(x: number): number {
  if (Number.isNaN(x)) return x;
  if (x > Overflow) return Infinity;
  if (x < Underflow) return 0;
  if (Math.abs(x) < NearZero) return 1 + x;
  // argument reduction, x = k*ln2 + r, |r| <= 0.5*ln2
  const kd = x < 0 ? fma(Log2e, x, -0.5) : fma(Log2e, x, 0.5);
  const k = Math.trunc(kd);
  const hi = fma(-k, Ln2Hi, x);
  const lo = k * Ln2Lo;
  const r = hi - lo;
  const t = r * r;
  let c = fma(P5, t, P4);
  c = fma(c, t, P3);
  c = fma(c, t, P2);
  c = fma(c, t, P1);
  c = fma(-c, t, r);
  const y = 1 - ((lo - (r * c) / (2 - c)) - hi);
  // inline Ldexp(y, k)
  const b = bits(y);
  const frac = b & 0xfffffffffffffn;
  let e = Number(b >> 52n) + k;
  let m = 1;
  if (e < 1) {
    e += 52;
    m = 2.220446049250313e-16; // 2**-52
  }
  return m * fromBits((BigInt(e) << 52n) | frac);
}

function isOddInt(x: number): boolean {
  if (Math.abs(x) >= 9007199254740992) return false; // 1<<53: all even
  const xi = Math.trunc(x);
  return x - xi === 0 && Math.abs(xi % 2) === 1;
}

/** Go's math.Pow, as compiled for arm64. */
export function pow(x: number, y: number): number {
  if (y === 0 || x === 1) return 1;
  if (y === 1) return x;
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (x === 0) {
    const signbit = Object.is(x, -0);
    if (y < 0) return signbit && isOddInt(y) ? -Infinity : Infinity;
    if (y > 0) return signbit && isOddInt(y) ? x : 0;
  }
  if (!Number.isFinite(y)) {
    if (x === -1) return 1;
    if ((Math.abs(x) < 1) === (y === Infinity)) return 0;
    return Infinity;
  }
  if (!Number.isFinite(x)) {
    if (x === -Infinity) return pow(1 / x, -y);
    if (y < 0) return 0;
    if (y > 0) return Infinity;
  }
  if (y === 0.5) return Math.sqrt(x);
  if (y === -0.5) return 1 / Math.sqrt(x);

  const ay = Math.abs(y);
  let yi = Math.trunc(ay);
  let yf = ay - yi;
  if (yf !== 0 && x < 0) return NaN;
  if (yi >= 9223372036854775808) {
    if (x === -1) return 1;
    if ((Math.abs(x) < 1) === (y > 0)) return 0;
    return Infinity;
  }

  let a1 = 1.0;
  let ae = 0;
  if (yf !== 0) {
    if (yf > 0.5) {
      yf--;
      yi++;
    }
    a1 = exp(yf * log(x));
  }

  let [x1, xe] = frexp(x);
  for (let i = BigInt(yi); i !== 0n; i >>= 1n) {
    if (xe < -(1 << 12) || 1 << 12 < xe) {
      ae += xe;
      break;
    }
    if ((i & 1n) === 1n) {
      a1 *= x1;
      ae += xe;
    }
    const sq = x1 * x1;
    xe <<= 1;
    if (sq < 0.5) {
      x1 = fma(x1, x1, sq); // `x1 += x1` fused with the square above
      xe--;
    } else {
      x1 = sq;
    }
  }

  if (y < 0) {
    a1 = 1 / a1;
    ae = -ae;
  }
  return ldexp(a1, ae);
}

const pow10tab = [
  1e00, 1e01, 1e02, 1e03, 1e04, 1e05, 1e06, 1e07, 1e08, 1e09, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15, 1e16, 1e17,
  1e18, 1e19, 1e20, 1e21, 1e22, 1e23, 1e24, 1e25, 1e26, 1e27, 1e28, 1e29, 1e30, 1e31,
];
const pow10postab32 = [1e00, 1e32, 1e64, 1e96, 1e128, 1e160, 1e192, 1e224, 1e256, 1e288];
const pow10negtab32 = [1e-00, 1e-32, 1e-64, 1e-96, 1e-128, 1e-160, 1e-192, 1e-224, 1e-256, 1e-288, 1e-320];

/** Go's math.Pow10. */
export function pow10(n: number): number {
  if (0 <= n && n <= 308) return pow10postab32[Math.trunc(n / 32)] * pow10tab[n % 32];
  if (-323 <= n && n <= 0) return pow10negtab32[Math.trunc(-n / 32)] / pow10tab[-n % 32];
  if (n > 0) return Infinity;
  return 0;
}
