// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// Go strings are byte sequences: len(s) is the UTF-8 byte length and s[:n]
// slices bytes, which can cut a multi-byte rune in half. Upstream charts use
// both for label widths, so the port reproduces them here.

const encoder = new TextEncoder();

function isAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0x7f) return false;
  return true;
}

/** Go's len(s): number of UTF-8 bytes in s. */
export function goLen(s: string): number {
  return isAscii(s) ? s.length : encoder.encode(s).length;
}

/**
 * Go's `[]rune(string(bytes))` decoding: each byte that is not part of a valid
 * UTF-8 sequence becomes one U+FFFD (the WHATWG decoder would merge a
 * truncated sequence into a single replacement character).
 */
function decodeGo(b: Uint8Array): string {
  const out: string[] = [];
  let i = 0;
  while (i < b.length) {
    const c = b[i];
    if (c < 0x80) {
      out.push(String.fromCharCode(c));
      i++;
      continue;
    }
    let need = 0;
    let lo = 0x80;
    let hi = 0xbf;
    let cp = 0;
    if (c >= 0xc2 && c <= 0xdf) {
      need = 1;
      cp = c & 0x1f;
    } else if (c >= 0xe0 && c <= 0xef) {
      need = 2;
      cp = c & 0x0f;
      if (c === 0xe0) lo = 0xa0;
      if (c === 0xed) hi = 0x9f;
    } else if (c >= 0xf0 && c <= 0xf4) {
      need = 3;
      cp = c & 0x07;
      if (c === 0xf0) lo = 0x90;
      if (c === 0xf4) hi = 0x8f;
    }
    let ok = need > 0;
    if (ok) {
      for (let k = 1; k <= need; k++) {
        const x = b[i + k];
        if (x === undefined) {
          ok = false;
          break;
        }
        const l = k === 1 ? lo : 0x80;
        const h = k === 1 ? hi : 0xbf;
        if (x < l || x > h) {
          ok = false;
          break;
        }
        cp = (cp << 6) | (x & 0x3f);
      }
    }
    if (ok) {
      out.push(String.fromCodePoint(cp));
      i += need + 1;
    } else {
      out.push('�');
      i++;
    }
  }
  return out.join('');
}

/**
 * Go's `s[:n]` followed by the rune conversion a canvas performs when the
 * string is drawn. n is a byte count; n beyond len(s) returns s unchanged.
 */
export function goSliceBytes(s: string, n: number): string {
  if (n <= 0) return '';
  if (isAscii(s)) return s.length <= n ? s : s.slice(0, n);
  const b = encoder.encode(s);
  if (n >= b.length) return s;
  return decodeGo(b.subarray(0, n));
}
