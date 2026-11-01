// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// Go's strconv.FormatFloat, strconv.Quote and the float/string encodings of
// encoding/json, so labels, error messages and JSON are the bytes Go prints.

/**
 * Decimal digits of a positive finite double: v = 0.d1d2d3... * 10^dp
 * (Go's strconv decimal{d, nd, dp}). Exact: every double is a finite
 * decimal, computed here with BigInt.
 */
function exactDecimal(v: number): { d: string; dp: number } {
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, v);
  const hi = buf.getUint32(0);
  const lo = buf.getUint32(4);
  const bexp = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e2: number;
  if (bexp === 0) {
    e2 = -1074;
  } else {
    mant |= 1n << 52n;
    e2 = bexp - 1075;
  }
  let digits: string;
  let dp: number;
  if (e2 >= 0) {
    digits = (mant << BigInt(e2)).toString();
    dp = digits.length;
  } else {
    // mant / 2^k = mant * 5^k / 10^k
    const k = -e2;
    digits = (mant * 5n ** BigInt(k)).toString();
    dp = digits.length - k;
  }
  const trimmed = digits.replace(/0+$/, '');
  const lead = trimmed.length - trimmed.replace(/^0+/, '').length;
  return { d: trimmed.slice(lead), dp: dp - lead };
}

/** Rounds decimal digits d (point at dp) to nd digits, half to even on exact ties (Go's decimal.Round). */
function roundDigits(d: string, dp: number, nd: number): { d: string; dp: number } {
  if (nd < 0) return { d: '', dp };
  if (nd >= d.length) return { d, dp };
  let up: boolean;
  if (d[nd] === '5' && nd + 1 === d.length) {
    // exactly halfway: round to even
    up = nd > 0 && (d.charCodeAt(nd - 1) - 48) % 2 === 1;
  } else {
    up = d[nd] >= '5';
  }
  if (!up) return { d: d.slice(0, nd).replace(/0+$/, ''), dp };
  const a = d.slice(0, nd).split('');
  let i = nd - 1;
  while (i >= 0 && a[i] === '9') i--;
  if (i < 0) return { d: '1', dp: dp + 1 };
  a[i] = String.fromCharCode(a[i].charCodeAt(0) + 1);
  return { d: a.slice(0, i + 1).join(''), dp };
}

/** Shortest decimal digits that read back as v (positive, finite). */
function shortestDigits(v: number): { d: string; dp: number } {
  const [mant, e] = v.toExponential().split('e');
  const d = mant.replace('.', '').replace(/0+$/, '');
  return { d, dp: Number(e) + 1 };
}

function fmtE(neg: boolean, d: string, dp: number, prec: number, fmt: string): string {
  let s = neg ? '-' : '';
  s += d.length === 0 ? '0' : d[0];
  if (prec > 0) {
    s += '.';
    let i = 1;
    const m = Math.min(d.length, prec + 1);
    if (i < m) {
      s += d.slice(i, m);
      i = m;
    }
    for (; i <= prec; i++) s += '0';
  }
  s += fmt;
  let exp = dp - 1;
  if (d.length === 0) exp = 0; // special case: 0 has exponent 0
  s += exp < 0 ? '-' : '+';
  exp = Math.abs(exp);
  s += exp < 10 ? '0' + exp : String(exp);
  return s;
}

function fmtF(neg: boolean, d: string, dp: number, prec: number): string {
  let s = neg ? '-' : '';
  if (dp > 0) {
    const m = Math.min(d.length, dp);
    s += d.slice(0, m);
    for (let i = m; i < dp; i++) s += '0';
  } else {
    s += '0';
  }
  if (prec > 0) {
    s += '.';
    for (let i = 1; i <= prec; i++) {
      const j = dp + i - 1;
      s += j >= 0 && j < d.length ? d[j] : '0';
    }
  }
  return s;
}

/**
 * Go's strconv.FormatFloat(v, fmt, prec, 64) for fmt 'e', 'E', 'f', 'g'
 * and 'G'. prec < 0 means the shortest representation that reads back as v.
 * Fixed precisions round the exact binary value, half to even on exact ties.
 */
export function FormatFloat(v: number, fmt: 'e' | 'E' | 'f' | 'g' | 'G', prec: number): string {
  if (Number.isNaN(v)) return 'NaN';
  if (v === Infinity) return '+Inf';
  if (v === -Infinity) return '-Inf';
  const neg = v < 0 || Object.is(v, -0);
  const a = Math.abs(v);
  const shortest = prec < 0;
  let d: string;
  let dp: number;
  if (a === 0) {
    d = '';
    dp = 0;
  } else if (shortest) {
    ({ d, dp } = shortestDigits(a));
  } else {
    ({ d, dp } = exactDecimal(a));
    let nd: number;
    switch (fmt) {
      case 'e':
      case 'E':
        nd = prec + 1;
        break;
      case 'f':
        nd = dp + prec;
        break;
      default:
        if (prec === 0) prec = 1;
        nd = prec;
    }
    ({ d, dp } = roundDigits(d, dp, nd));
  }
  if (shortest) {
    switch (fmt) {
      case 'e':
      case 'E':
        prec = Math.max(d.length - 1, 0);
        break;
      case 'f':
        prec = Math.max(d.length - dp, 0);
        break;
      default:
        prec = d.length;
    }
  }
  switch (fmt) {
    case 'e':
    case 'E':
      return fmtE(neg, d, dp, prec, fmt);
    case 'f':
      return fmtF(neg, d, dp, prec);
    default: {
      let eprec = prec;
      if (eprec > d.length && d.length >= dp) eprec = d.length;
      // %e is used if the exponent from the conversion is less than -4 or
      // greater than or equal to the precision. If precision was the
      // shortest possible, use precision 6 for this decision.
      if (shortest) eprec = 6;
      const exp = dp - 1;
      if (exp < -4 || exp >= eprec) {
        if (prec > d.length) prec = d.length;
        return fmtE(neg, d, dp, prec - 1, fmt === 'g' ? 'e' : 'E');
      }
      if (prec > dp) prec = d.length;
      return fmtF(neg, d, dp, Math.max(prec - dp, 0));
    }
  }
}

/** Go's strconv.ParseFloat(s, 64) for the strings FormatFloat produces. */
export function ParseFloat(s: string): number {
  if (s === '+Inf') return Infinity;
  if (s === '-Inf') return -Infinity;
  return Number(s);
}

// Go's unicode.IsPrint: letters, marks, numbers, punctuation, symbols and the ASCII space.
const printRe = /^[\p{L}\p{M}\p{N}\p{P}\p{S}]$/u;

/** Go's strconv.IsPrint. */
export function isPrint(cp: number): boolean {
  if (cp < 0x80) return cp >= 0x20 && cp < 0x7f;
  return printRe.test(String.fromCodePoint(cp));
}

const hex = (n: number, w: number) => n.toString(16).padStart(w, '0');

/**
 * Go's strconv.Quote (the %q verb for strings). A lone UTF-16 surrogate,
 * which a Go string decoded from JSON holds as U+FFFD, quotes as U+FFFD.
 */
export function Quote(s: string): string {
  let out = '"';
  for (const ch of s) {
    let r = ch.codePointAt(0)!;
    if (r >= 0xd800 && r <= 0xdfff) r = 0xfffd;
    if (r === 0x22 || r === 0x5c) {
      out += '\\' + String.fromCharCode(r);
      continue;
    }
    if (isPrint(r)) {
      out += String.fromCodePoint(r);
      continue;
    }
    switch (r) {
      case 0x07:
        out += '\\a';
        break;
      case 0x08:
        out += '\\b';
        break;
      case 0x0c:
        out += '\\f';
        break;
      case 0x0a:
        out += '\\n';
        break;
      case 0x0d:
        out += '\\r';
        break;
      case 0x09:
        out += '\\t';
        break;
      case 0x0b:
        out += '\\v';
        break;
      default:
        if (r < 0x20 || r === 0x7f) out += '\\x' + hex(r, 2);
        else if (r < 0x10000) out += '\\u' + hex(r, 4);
        else out += '\\U' + hex(r, 8);
    }
  }
  return out + '"';
}

/**
 * encoding/json's encoding of a float64: shortest digits, in exponent form
 * below 1e-6 and from 1e21 up, with a one-digit negative exponent ("1e-7").
 * NaN and infinities are an error, as in Go.
 */
export function jsonFloat(v: number): string {
  if (!Number.isFinite(v)) {
    throw new Error(`json: unsupported value: ${FormatFloat(v, 'g', -1)}`);
  }
  const abs = Math.abs(v);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e21)) {
    let b = FormatFloat(v, 'e', -1);
    const n = b.length;
    if (n >= 4 && b[n - 4] === 'e' && b[n - 3] === '-' && b[n - 2] === '0') b = b.slice(0, n - 2) + b[n - 1];
    return b;
  }
  return FormatFloat(v, 'f', -1);
}

/**
 * encoding/json's encoding of a string with HTML escaping (json.Marshal):
 * <, > and & become <, > and &; U+2028 and U+2029 are
 * escaped; a lone surrogate becomes �.
 */
export function jsonString(s: string): string {
  let out = '"';
  for (const ch of s) {
    const r = ch.codePointAt(0)!;
    if (r < 0x80) {
      switch (r) {
        case 0x22:
          out += '\\"';
          break;
        case 0x5c:
          out += '\\\\';
          break;
        case 0x08:
          out += '\\b';
          break;
        case 0x0c:
          out += '\\f';
          break;
        case 0x0a:
          out += '\\n';
          break;
        case 0x0d:
          out += '\\r';
          break;
        case 0x09:
          out += '\\t';
          break;
        default:
          if (r < 0x20 || r === 0x3c || r === 0x3e || r === 0x26) out += '\\u00' + hex(r, 2);
          else out += ch;
      }
      continue;
    }
    if (r >= 0xd800 && r <= 0xdfff) out += '\\ufffd';
    else if (r === 0x2028 || r === 0x2029) out += '\\u' + hex(r, 4);
    else out += ch;
  }
  return out + '"';
}
