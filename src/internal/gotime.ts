// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// Go's time.Parse and time.Time.Format, for the layouts the spec package
// accepts and prints. Port of nextStdChunk, appendFormat (for UTC times) and
// parse from Go's time/format.go. Layout strings and values are treated as
// Go byte strings: the layout elements are all ASCII, and any other text is
// copied or compared byte for byte.

// ── std chunk codes ─────────────────────────────────────────────────────────

const stdNeedDate = 1 << 8;
const stdNeedYday = 1 << 9;
const stdNeedClock = 1 << 10;
const stdArgShift = 16;
const stdSeparatorShift = 28;
const stdMask = (1 << stdArgShift) - 1;

const stdLongMonth = 1 + stdNeedDate; // "January"
const stdMonth = 2 + stdNeedDate; // "Jan"
const stdNumMonth = 3 + stdNeedDate; // "1"
const stdZeroMonth = 4 + stdNeedDate; // "01"
const stdLongWeekDay = 5 + stdNeedDate; // "Monday"
const stdWeekDay = 6 + stdNeedDate; // "Mon"
const stdDay = 7 + stdNeedDate; // "2"
const stdUnderDay = 8 + stdNeedDate; // "_2"
const stdZeroDay = 9 + stdNeedDate; // "02"
const stdUnderYearDay = 10 + stdNeedYday; // "__2"
const stdZeroYearDay = 11 + stdNeedYday; // "002"
const stdHour = 12 + stdNeedClock; // "15"
const stdHour12 = 13 + stdNeedClock; // "3"
const stdZeroHour12 = 14 + stdNeedClock; // "03"
const stdMinute = 15 + stdNeedClock; // "4"
const stdZeroMinute = 16 + stdNeedClock; // "04"
const stdSecond = 17 + stdNeedClock; // "5"
const stdZeroSecond = 18 + stdNeedClock; // "05"
const stdLongYear = 19 + stdNeedDate; // "2006"
const stdYear = 20 + stdNeedDate; // "06"
const stdPM = 21 + stdNeedClock; // "PM"
const stdpm = 22 + stdNeedClock; // "pm"
const stdTZ = 23; // "MST"
const stdISO8601TZ = 24; // "Z0700"
const stdISO8601SecondsTZ = 25; // "Z070000"
const stdISO8601ShortTZ = 26; // "Z07"
const stdISO8601ColonTZ = 27; // "Z07:00"
const stdISO8601ColonSecondsTZ = 28; // "Z07:00:00"
const stdNumTZ = 29; // "-0700"
const stdNumSecondsTz = 30; // "-070000"
const stdNumShortTZ = 31; // "-07"
const stdNumColonTZ = 32; // "-07:00"
const stdNumColonSecondsTZ = 33; // "-07:00:00"
const stdFracSecond0 = 34; // ".0", ".00", ... , trailing zeros included
const stdFracSecond9 = 35; // ".9", ".99", ..., trailing zeros omitted

const std0x = [stdZeroMonth, stdZeroDay, stdZeroHour12, stdZeroMinute, stdZeroSecond, stdYear];

const isDigitAt = (s: string, i: number): boolean => i < s.length && s[i] >= '0' && s[i] <= '9';
const startsWithLowerCase = (s: string): boolean => s.length > 0 && s[0] >= 'a' && s[0] <= 'z';

function stdFracSecond(code: number, n: number, c: string): number {
  if (c === '.') return code | ((n & 0xfff) << stdArgShift);
  return code | ((n & 0xfff) << stdArgShift) | (1 << stdSeparatorShift);
}
const digitsLen = (std: number): number => (std >> stdArgShift) & 0xfff;
const separator = (std: number): string => (std >> stdSeparatorShift === 0 ? '.' : ',');

/** nextStdChunk finds the first layout element: the text before it, its code (0 if none) and the text after. */
function nextStdChunk(layout: string): [string, number, string] {
  for (let i = 0; i < layout.length; i++) {
    const c = layout[i];
    switch (c) {
      case 'J': // January, Jan
        if (layout.length >= i + 3 && layout.slice(i, i + 3) === 'Jan') {
          if (layout.length >= i + 7 && layout.slice(i, i + 7) === 'January') {
            return [layout.slice(0, i), stdLongMonth, layout.slice(i + 7)];
          }
          if (!startsWithLowerCase(layout.slice(i + 3))) return [layout.slice(0, i), stdMonth, layout.slice(i + 3)];
        }
        break;
      case 'M': // Monday, Mon, MST
        if (layout.length >= i + 3) {
          if (layout.slice(i, i + 3) === 'Mon') {
            if (layout.length >= i + 6 && layout.slice(i, i + 6) === 'Monday') {
              return [layout.slice(0, i), stdLongWeekDay, layout.slice(i + 6)];
            }
            if (!startsWithLowerCase(layout.slice(i + 3))) return [layout.slice(0, i), stdWeekDay, layout.slice(i + 3)];
          }
          if (layout.slice(i, i + 3) === 'MST') return [layout.slice(0, i), stdTZ, layout.slice(i + 3)];
        }
        break;
      case '0': // 01, 02, 03, 04, 05, 06, 002
        if (layout.length >= i + 2 && layout[i + 1] >= '1' && layout[i + 1] <= '6') {
          return [layout.slice(0, i), std0x[layout.charCodeAt(i + 1) - 49], layout.slice(i + 2)];
        }
        if (layout.length >= i + 3 && layout[i + 1] === '0' && layout[i + 2] === '2') {
          return [layout.slice(0, i), stdZeroYearDay, layout.slice(i + 3)];
        }
        break;
      case '1': // 15, 1
        if (layout.length >= i + 2 && layout[i + 1] === '5') return [layout.slice(0, i), stdHour, layout.slice(i + 2)];
        return [layout.slice(0, i), stdNumMonth, layout.slice(i + 1)];
      case '2': // 2006, 2
        if (layout.length >= i + 4 && layout.slice(i, i + 4) === '2006') {
          return [layout.slice(0, i), stdLongYear, layout.slice(i + 4)];
        }
        return [layout.slice(0, i), stdDay, layout.slice(i + 1)];
      case '_': // _2, _2006, __2
        if (layout.length >= i + 2 && layout[i + 1] === '2') {
          // _2006 is really a literal _, followed by stdLongYear
          if (layout.length >= i + 5 && layout.slice(i + 1, i + 5) === '2006') {
            return [layout.slice(0, i + 1), stdLongYear, layout.slice(i + 5)];
          }
          return [layout.slice(0, i), stdUnderDay, layout.slice(i + 2)];
        }
        if (layout.length >= i + 3 && layout[i + 1] === '_' && layout[i + 2] === '2') {
          return [layout.slice(0, i), stdUnderYearDay, layout.slice(i + 3)];
        }
        break;
      case '3':
        return [layout.slice(0, i), stdHour12, layout.slice(i + 1)];
      case '4':
        return [layout.slice(0, i), stdMinute, layout.slice(i + 1)];
      case '5':
        return [layout.slice(0, i), stdSecond, layout.slice(i + 1)];
      case 'P': // PM
        if (layout.length >= i + 2 && layout[i + 1] === 'M') return [layout.slice(0, i), stdPM, layout.slice(i + 2)];
        break;
      case 'p': // pm
        if (layout.length >= i + 2 && layout[i + 1] === 'm') return [layout.slice(0, i), stdpm, layout.slice(i + 2)];
        break;
      case '-': // -070000, -07:00:00, -0700, -07:00, -07
        if (layout.slice(i, i + 7) === '-070000') return [layout.slice(0, i), stdNumSecondsTz, layout.slice(i + 7)];
        if (layout.slice(i, i + 9) === '-07:00:00') return [layout.slice(0, i), stdNumColonSecondsTZ, layout.slice(i + 9)];
        if (layout.slice(i, i + 5) === '-0700') return [layout.slice(0, i), stdNumTZ, layout.slice(i + 5)];
        if (layout.slice(i, i + 6) === '-07:00') return [layout.slice(0, i), stdNumColonTZ, layout.slice(i + 6)];
        if (layout.slice(i, i + 3) === '-07') return [layout.slice(0, i), stdNumShortTZ, layout.slice(i + 3)];
        break;
      case 'Z': // Z070000, Z07:00:00, Z0700, Z07:00,
        if (layout.slice(i, i + 7) === 'Z070000') return [layout.slice(0, i), stdISO8601SecondsTZ, layout.slice(i + 7)];
        if (layout.slice(i, i + 9) === 'Z07:00:00') return [layout.slice(0, i), stdISO8601ColonSecondsTZ, layout.slice(i + 9)];
        if (layout.slice(i, i + 5) === 'Z0700') return [layout.slice(0, i), stdISO8601TZ, layout.slice(i + 5)];
        if (layout.slice(i, i + 6) === 'Z07:00') return [layout.slice(0, i), stdISO8601ColonTZ, layout.slice(i + 6)];
        if (layout.slice(i, i + 3) === 'Z07') return [layout.slice(0, i), stdISO8601ShortTZ, layout.slice(i + 3)];
        break;
      case '.':
      case ',': // ,000, or .000, or ,999, or .999 - repeated digits for fractional seconds.
        if (i + 1 < layout.length && (layout[i + 1] === '0' || layout[i + 1] === '9')) {
          const ch = layout[i + 1];
          let j = i + 1;
          while (j < layout.length && layout[j] === ch) j++;
          // String of digits must end here - only fractional second is all digits.
          if (!isDigitAt(layout, j)) {
            const code = layout[i + 1] === '9' ? stdFracSecond9 : stdFracSecond0;
            return [layout.slice(0, i), stdFracSecond(code, j - (i + 1), c), layout.slice(j)];
          }
        }
        break;
    }
  }
  return [layout, 0, ''];
}

const longDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longMonthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Go's appendInt: decimal x, zero-padded to width digits (excluding the sign). */
function appendInt(x: number, width: number): string {
  const neg = x < 0;
  const s = String(Math.abs(x));
  return (neg ? '-' : '') + (s.length < width ? '0'.repeat(width - s.length) + s : s);
}

// ── calendar ────────────────────────────────────────────────────────────────

/** Days since 1970-01-01 of the proleptic Gregorian date y-m-d (m is 1-based). */
export function daysFromCivil(y: number, m: number, d: number): number {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The proleptic Gregorian date [year, month (1-based), day] of days since 1970-01-01. */
function civilFromDays(z: number): [number, number, number] {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [m <= 2 ? y + 1 : y, m, d];
}

const isLeap = (y: number): boolean => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
const daysBefore = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

function daysIn(month: number, year: number): number {
  if (month === 2 && isLeap(year)) return 29;
  return daysBefore[month] - daysBefore[month - 1];
}

// ── conversions ─────────────────────────────────────────────────────────────

const MAX_INT64 = (1n << 63n) - 1n;
const MIN_INT64 = -(1n << 63n);

/**
 * Go's int64(f) conversion. Out-of-range values are implementation-defined
 * in Go; this follows arm64 (saturate, NaN is 0), where the parity goldens
 * are generated.
 */
export function goInt64(f: number): bigint {
  if (Number.isNaN(f)) return 0n;
  if (f >= 9223372036854775807) return MAX_INT64;
  if (f <= -9223372036854775808) return MIN_INT64;
  return BigInt(Math.trunc(f));
}

/**
 * GoTime is an instant with Go's nanosecond resolution: ms is
 * time.UnixMilli() (floored), ns the nanoseconds within that millisecond
 * (0..999999). A JavaScript Date keeps only ms.
 */
export interface GoTime {
  ms: number;
  ns: number;
}

/** GoTime of a Unix seconds/nanoseconds pair, as Go's time.Unix(sec, nsec). */
function fromUnix(sec: number, nsec: number): GoTime {
  return { ms: sec * 1000 + Math.floor(nsec / 1e6), ns: nsec % 1e6 };
}

/** Go's time.UnixMilli(ms) (ms an int64). */
export function unixMilli(ms: bigint): GoTime {
  return { ms: Number(ms), ns: 0 };
}

/** Compares two instants: negative if a is before b, 0 if equal, positive after. */
export function compareTime(a: GoTime, b: GoTime): number {
  return a.ms !== b.ms ? a.ms - b.ms : a.ns - b.ns;
}

/** Go's float64(a.Sub(b)): the nanoseconds from b to a, saturated to int64, as a float64. */
export function subNanos(a: GoTime, b: GoTime): number {
  let d = (BigInt(a.ms) - BigInt(b.ms)) * 1000000n + BigInt(a.ns - b.ns);
  if (d > MAX_INT64) d = MAX_INT64;
  if (d < MIN_INT64) d = MIN_INT64;
  return Number(d);
}

// ── Format ──────────────────────────────────────────────────────────────────

/**
 * Go's time.UnixMilli(ms).UTC().Format(layout), for any int64 ms. With the
 * time in UTC, the zone name is "UTC" and the offset zero.
 */
export function formatUnixMilliUTC(ms: bigint, layout: string): string {
  let sec = ms / 1000n;
  let nsec = Number(ms % 1000n) * 1e6;
  if (nsec < 0) {
    sec -= 1n;
    nsec += 1e9;
  }
  let days = sec / 86400n;
  let sod = sec % 86400n;
  if (sod < 0n) {
    days -= 1n;
    sod += 86400n;
  }
  return formatUTC(Number(days), Number(sod), nsec, layout);
}

function formatUTC(days: number, secOfDay: number, nanosec: number, layout: string): string {
  const [year, month, day] = civilFromDays(days);
  const yday = days - daysFromCivil(year, 1, 1) + 1;
  const weekday = (((days + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday
  const hour = Math.floor(secOfDay / 3600);
  const min = Math.floor((secOfDay % 3600) / 60);
  const sec = secOfDay % 60;
  const offset = 0;
  let b = '';
  while (layout !== '') {
    const [prefix, std, suffix] = nextStdChunk(layout);
    if (prefix !== '') b += prefix;
    if (std === 0) break;
    layout = suffix;
    switch (std & stdMask) {
      case stdYear:
        b += appendInt(Math.abs(year) % 100, 2);
        break;
      case stdLongYear:
        b += appendInt(year, 4);
        break;
      case stdMonth:
        b += longMonthNames[month - 1].slice(0, 3);
        break;
      case stdLongMonth:
        b += longMonthNames[month - 1];
        break;
      case stdNumMonth:
        b += appendInt(month, 0);
        break;
      case stdZeroMonth:
        b += appendInt(month, 2);
        break;
      case stdWeekDay:
        b += longDayNames[weekday].slice(0, 3);
        break;
      case stdLongWeekDay:
        b += longDayNames[weekday];
        break;
      case stdDay:
        b += appendInt(day, 0);
        break;
      case stdUnderDay:
        if (day < 10) b += ' ';
        b += appendInt(day, 0);
        break;
      case stdZeroDay:
        b += appendInt(day, 2);
        break;
      case stdUnderYearDay:
        if (yday < 100) {
          b += ' ';
          if (yday < 10) b += ' ';
        }
        b += appendInt(yday, 0);
        break;
      case stdZeroYearDay:
        b += appendInt(yday, 3);
        break;
      case stdHour:
        b += appendInt(hour, 2);
        break;
      case stdHour12:
        b += appendInt(hour % 12 === 0 ? 12 : hour % 12, 0);
        break;
      case stdZeroHour12:
        b += appendInt(hour % 12 === 0 ? 12 : hour % 12, 2);
        break;
      case stdMinute:
        b += appendInt(min, 0);
        break;
      case stdZeroMinute:
        b += appendInt(min, 2);
        break;
      case stdSecond:
        b += appendInt(sec, 0);
        break;
      case stdZeroSecond:
        b += appendInt(sec, 2);
        break;
      case stdPM:
        b += hour >= 12 ? 'PM' : 'AM';
        break;
      case stdpm:
        b += hour >= 12 ? 'pm' : 'am';
        break;
      case stdISO8601TZ:
      case stdISO8601ColonTZ:
      case stdISO8601SecondsTZ:
      case stdISO8601ShortTZ:
      case stdISO8601ColonSecondsTZ:
      case stdNumTZ:
      case stdNumColonTZ:
      case stdNumSecondsTz:
      case stdNumShortTZ:
      case stdNumColonSecondsTZ: {
        // the "Z" variants print Z for UTC
        if (
          offset === 0 &&
          (std === stdISO8601TZ ||
            std === stdISO8601ColonTZ ||
            std === stdISO8601SecondsTZ ||
            std === stdISO8601ShortTZ ||
            std === stdISO8601ColonSecondsTZ)
        ) {
          b += 'Z';
          break;
        }
        const zone = offset / 60;
        b += '+';
        b += appendInt(Math.trunc(zone / 60), 2);
        if (std === stdISO8601ColonTZ || std === stdNumColonTZ || std === stdISO8601ColonSecondsTZ || std === stdNumColonSecondsTZ) {
          b += ':';
        }
        if (std !== stdNumShortTZ && std !== stdISO8601ShortTZ) b += appendInt(zone % 60, 2);
        if (std === stdISO8601SecondsTZ || std === stdNumSecondsTz || std === stdNumColonSecondsTZ || std === stdISO8601ColonSecondsTZ) {
          if (std === stdNumColonSecondsTZ || std === stdISO8601ColonSecondsTZ) b += ':';
          b += appendInt(offset % 60, 2);
        }
        break;
      }
      case stdTZ:
        b += 'UTC';
        break;
      case stdFracSecond0:
      case stdFracSecond9:
        b += appendNano(nanosec, std);
        break;
    }
  }
  return b;
}

/** Go's appendNano: a fractional second of nanosec nanoseconds. */
function appendNano(nanosec: number, std: number): string {
  const trim = (std & stdMask) === stdFracSecond9;
  const n = digitsLen(std);
  if (trim && (n === 0 || nanosec === 0)) return '';
  const dot = separator(std);
  let b = dot + appendInt(nanosec, 9);
  if (n < 9) b = b.slice(0, b.length - 9 + n);
  if (trim) {
    b = b.replace(/0+$/, '');
    if (b.endsWith(dot)) b = b.slice(0, -1);
  }
  return b;
}

// ── Parse ───────────────────────────────────────────────────────────────────

class ParseFail extends Error {}

const commaOrPeriod = (c: string | undefined): boolean => c === '.' || c === ',';

/** Go's getnum: one or two digits (fixed forces two). */
function getnum(s: string, fixed: boolean): [number, string] {
  if (!isDigitAt(s, 0)) throw new ParseFail();
  if (!isDigitAt(s, 1)) {
    if (fixed) throw new ParseFail();
    return [s.charCodeAt(0) - 48, s.slice(1)];
  }
  return [(s.charCodeAt(0) - 48) * 10 + (s.charCodeAt(1) - 48), s.slice(2)];
}

/** Go's getnum3: one to three digits (fixed forces three). */
function getnum3(s: string, fixed: boolean): [number, string] {
  let n = 0;
  let i = 0;
  for (; i < 3 && isDigitAt(s, i); i++) n = n * 10 + (s.charCodeAt(i) - 48);
  if (i === 0 || (fixed && i !== 3)) throw new ParseFail();
  return [n, s.slice(i)];
}

/** Go's atoi: an optionally signed run of digits, the whole string. */
function atoi(s: string): number {
  let neg = false;
  if (s.length > 0 && (s[0] === '-' || s[0] === '+')) {
    neg = s[0] === '-';
    s = s.slice(1);
  }
  if (!/^[0-9]+$/.test(s)) throw new ParseFail();
  const x = Number(s);
  return neg ? -x : x;
}

function cutspace(s: string): string {
  let i = 0;
  while (i < s.length && s[i] === ' ') i++;
  return s.slice(i);
}

/** Go's skip: removes prefix from value, treating runs of spaces as equivalent. */
function skip(value: string, prefix: string): string {
  while (prefix.length > 0) {
    if (prefix[0] === ' ') {
      if (value.length > 0 && value[0] !== ' ') throw new ParseFail();
      prefix = cutspace(prefix);
      value = cutspace(value);
      continue;
    }
    if (value.length === 0 || value[0] !== prefix[0]) throw new ParseFail();
    prefix = prefix.slice(1);
    value = value.slice(1);
  }
  return value;
}

function lookup(tab: string[], val: string): [number, string] {
  for (let i = 0; i < tab.length; i++) {
    const v = tab[i];
    if (val.length >= v.length && val.slice(0, v.length).toLowerCase() === v.toLowerCase()) {
      // Go's match folds ASCII letters only; the names are ASCII
      let ok = true;
      for (let k = 0; k < v.length; k++) {
        const a = val.charCodeAt(k);
        if (a > 0x7f) ok = false;
      }
      if (ok) return [i, val.slice(v.length)];
    }
  }
  throw new ParseFail();
}

/** Go's parseNanoseconds: value[0] is the separator, value[1:nbytes] the digits. */
function parseNanoseconds(value: string, nbytes: number): number {
  if (!commaOrPeriod(value[0])) throw new ParseFail();
  if (nbytes > 10) {
    value = value.slice(0, 10);
    nbytes = 10;
  }
  let ns = atoi(value.slice(1, nbytes));
  if (ns < 0) throw new ParseFail();
  for (let i = 0; i < 10 - nbytes; i++) ns *= 10;
  return ns;
}

/**
 * Go's time.Parse(layout, value) in the default UTC location, reduced to the
 * instant it returns: null where Go returns an error. Zone abbreviations
 * (MST) other than UTC are taken at a zero offset, as Go does for an
 * abbreviation the local zone does not know.
 */
export function Parse(layout: string, value: string): GoTime | null {
  try {
    return parse(layout, value);
  } catch (e) {
    if (e instanceof ParseFail) return null;
    throw e;
  }
}

function parse(layout: string, value: string): GoTime {
  let amSet = false;
  let pmSet = false;
  let year = 0;
  let month = -1;
  let day = -1;
  let yday = -1;
  let hour = 0;
  let min = 0;
  let sec = 0;
  let nsec = 0;
  let zoneOffset = -1;
  for (;;) {
    const [prefix, std0, suffix] = nextStdChunk(layout);
    let std = std0;
    value = skip(value, prefix);
    if (std === 0) {
      if (value.length !== 0) throw new ParseFail(); // extra text
      break;
    }
    layout = suffix;
    switch (std & stdMask) {
      case stdYear: {
        if (value.length < 2) throw new ParseFail();
        const p = value.slice(0, 2);
        value = value.slice(2);
        year = atoi(p);
        year += year >= 69 ? 1900 : 2000;
        break;
      }
      case stdLongYear: {
        if (value.length < 4 || !isDigitAt(value, 0)) throw new ParseFail();
        const p = value.slice(0, 4);
        value = value.slice(4);
        year = atoi(p);
        break;
      }
      case stdMonth:
        [month, value] = lookup(shortMonthNames, value);
        month++;
        break;
      case stdLongMonth:
        [month, value] = lookup(longMonthNames, value);
        month++;
        break;
      case stdNumMonth:
      case stdZeroMonth:
        [month, value] = getnum(value, std === stdZeroMonth);
        if (month <= 0 || 12 < month) throw new ParseFail(); // month out of range
        break;
      case stdWeekDay:
        [, value] = lookup(shortDayNames, value);
        break;
      case stdLongWeekDay:
        [, value] = lookup(longDayNames, value);
        break;
      case stdDay:
      case stdUnderDay:
      case stdZeroDay:
        if (std === stdUnderDay && value.length > 0 && value[0] === ' ') value = value.slice(1);
        [day, value] = getnum(value, std === stdZeroDay);
        break;
      case stdUnderYearDay:
      case stdZeroYearDay:
        for (let i = 0; i < 2; i++) {
          if (std === stdUnderYearDay && value.length > 0 && value[0] === ' ') value = value.slice(1);
        }
        [yday, value] = getnum3(value, std === stdZeroYearDay);
        break;
      case stdHour:
        [hour, value] = getnum(value, false);
        if (hour < 0 || 24 <= hour) throw new ParseFail();
        break;
      case stdHour12:
      case stdZeroHour12:
        [hour, value] = getnum(value, std === stdZeroHour12);
        if (hour < 0 || 12 < hour) throw new ParseFail();
        break;
      case stdMinute:
      case stdZeroMinute:
        [min, value] = getnum(value, std === stdZeroMinute);
        if (min < 0 || 60 <= min) throw new ParseFail();
        break;
      case stdSecond:
      case stdZeroSecond: {
        [sec, value] = getnum(value, std === stdZeroSecond);
        if (sec < 0 || 60 <= sec) throw new ParseFail();
        // a fractional second in the value but not in the layout
        if (value.length >= 2 && commaOrPeriod(value[0]) && isDigitAt(value, 1)) {
          std = nextStdChunk(layout)[1] & stdMask;
          if (std === stdFracSecond0 || std === stdFracSecond9) break;
          let n = 2;
          while (n < value.length && isDigitAt(value, n)) n++;
          nsec = parseNanoseconds(value, n);
          value = value.slice(n);
        }
        break;
      }
      case stdPM: {
        if (value.length < 2) throw new ParseFail();
        const p = value.slice(0, 2);
        value = value.slice(2);
        if (p === 'PM') pmSet = true;
        else if (p === 'AM') amSet = true;
        else throw new ParseFail();
        break;
      }
      case stdpm: {
        if (value.length < 2) throw new ParseFail();
        const p = value.slice(0, 2);
        value = value.slice(2);
        if (p === 'pm') pmSet = true;
        else if (p === 'am') amSet = true;
        else throw new ParseFail();
        break;
      }
      case stdISO8601TZ:
      case stdISO8601ShortTZ:
      case stdISO8601ColonTZ:
      case stdISO8601SecondsTZ:
      case stdISO8601ColonSecondsTZ:
      case stdNumTZ:
      case stdNumShortTZ:
      case stdNumColonTZ:
      case stdNumSecondsTz:
      case stdNumColonSecondsTZ: {
        const iso =
          std === stdISO8601TZ ||
          std === stdISO8601ShortTZ ||
          std === stdISO8601ColonTZ ||
          std === stdISO8601SecondsTZ ||
          std === stdISO8601ColonSecondsTZ;
        if (iso && value.length >= 1 && value[0] === 'Z') {
          value = value.slice(1);
          zoneOffset = 0;
          break;
        }
        let sign: string, hh: string, mm: string, ss: string;
        if (std === stdISO8601ColonTZ || std === stdNumColonTZ) {
          if (value.length < 6 || value[3] !== ':') throw new ParseFail();
          [sign, hh, mm, ss, value] = [value.slice(0, 1), value.slice(1, 3), value.slice(4, 6), '00', value.slice(6)];
        } else if (std === stdNumShortTZ || std === stdISO8601ShortTZ) {
          if (value.length < 3) throw new ParseFail();
          [sign, hh, mm, ss, value] = [value.slice(0, 1), value.slice(1, 3), '00', '00', value.slice(3)];
        } else if (std === stdISO8601ColonSecondsTZ || std === stdNumColonSecondsTZ) {
          if (value.length < 9 || value[3] !== ':' || value[6] !== ':') throw new ParseFail();
          [sign, hh, mm, ss, value] = [value.slice(0, 1), value.slice(1, 3), value.slice(4, 6), value.slice(7, 9), value.slice(9)];
        } else if (std === stdISO8601SecondsTZ || std === stdNumSecondsTz) {
          if (value.length < 7) throw new ParseFail();
          [sign, hh, mm, ss, value] = [value.slice(0, 1), value.slice(1, 3), value.slice(3, 5), value.slice(5, 7), value.slice(7)];
        } else {
          if (value.length < 5) throw new ParseFail();
          [sign, hh, mm, ss, value] = [value.slice(0, 1), value.slice(1, 3), value.slice(3, 5), '00', value.slice(5)];
        }
        const [hr] = getnum(hh, true);
        const [mi] = getnum(mm, true);
        const [se] = getnum(ss, true);
        // the range tests use > rather than >=: offsets of 24 hours,
        // 60 minutes or 60 seconds are accepted
        if (hr > 24 || mi > 60 || se > 60) throw new ParseFail();
        zoneOffset = (hr * 60 + mi) * 60 + se;
        if (sign === '-') zoneOffset = -zoneOffset;
        else if (sign !== '+') throw new ParseFail();
        break;
      }
      case stdTZ: {
        if (value.length >= 3 && value.slice(0, 3) === 'UTC') {
          value = value.slice(3);
          zoneOffset = 0;
          break;
        }
        const n = parseTimeZone(value);
        if (n === 0) throw new ParseFail();
        value = value.slice(n);
        break;
      }
      case stdFracSecond0: {
        // stdFracSecond0 requires the exact number of digits as specified in the layout.
        const ndigit = 1 + digitsLen(std);
        if (value.length < ndigit) throw new ParseFail();
        nsec = parseNanoseconds(value, ndigit);
        value = value.slice(ndigit);
        break;
      }
      case stdFracSecond9: {
        if (value.length < 2 || !commaOrPeriod(value[0]) || value[1] < '0' || '9' < value[1]) break; // omitted
        let i = 0;
        while (i + 1 < value.length && value[i + 1] >= '0' && value[i + 1] <= '9') i++;
        nsec = parseNanoseconds(value, 1 + i);
        value = value.slice(1 + i);
        break;
      }
    }
  }
  if (pmSet && hour < 12) hour += 12;
  else if (amSet && hour === 12) hour = 0;

  // Convert yday to day, month.
  if (yday >= 0) {
    let d = 0;
    let m = 0;
    if (isLeap(year)) {
      if (yday === 31 + 29) {
        m = 2;
        d = 29;
      } else if (yday > 31 + 29) {
        yday--;
      }
    }
    if (yday < 1 || yday > 365) throw new ParseFail();
    if (m === 0) {
      m = Math.trunc((yday - 1) / 31) + 1;
      if (daysBefore[m] < yday) m++;
      d = yday - daysBefore[m - 1];
    }
    if (month >= 0 && month !== m) throw new ParseFail();
    month = m;
    if (day >= 0 && day !== d) throw new ParseFail();
    day = d;
  } else {
    if (month < 0) month = 1;
    if (day < 0) day = 1;
  }
  if (day < 1 || day > daysIn(month, year)) throw new ParseFail(); // day out of range

  let unix = daysFromCivil(year, month, day) * 86400 + hour * 3600 + min * 60 + sec;
  if (zoneOffset !== -1) unix -= zoneOffset;
  return fromUnix(unix, nsec);
}

// Go's parseTimeZone: the length of a time zone abbreviation at the start of value, or 0.
function parseTimeZone(value: string): number {
  if (value.length < 3) return 0;
  // Special case 1: ChST and MeST.
  if (value.length >= 4 && (value.slice(0, 4) === 'ChST' || value.slice(0, 4) === 'MeST')) return 4;
  // Special case 2: GMT may have an hour offset; treat it specially.
  if (value.slice(0, 3) === 'GMT') return parseGMT(value);
  // Special Case 3: Some time zones are not named, but have +/-00 format
  if (value[0] === '+' || value[0] === '-') return parseSignedOffset(value);
  // How many upper-case letters are there? Need at least three, at most five.
  let nUpper = 0;
  for (; nUpper < 6; nUpper++) {
    if (nUpper >= value.length) break;
    const c = value[nUpper];
    if (c < 'A' || 'Z' < c) break;
  }
  switch (nUpper) {
    case 0:
    case 1:
    case 2:
    case 6:
      return 0;
    case 5: // Must end in T to match.
      return value[4] === 'T' ? 5 : 0;
    case 4: // Must end in T, except one special case.
      return value[3] === 'T' || value.slice(0, 4) === 'WITA' ? 4 : 0;
    default:
      return 3;
  }
}

function parseGMT(value: string): number {
  value = value.slice(3);
  if (value.length === 0) return 3;
  return 3 + parseSignedOffset(value);
}

function parseSignedOffset(value: string): number {
  const sign = value[0];
  if (sign !== '-' && sign !== '+') return 0;
  const m = /^[0-9]+/.exec(value.slice(1));
  if (m === null) return 0;
  const x = Number(m[0]);
  if (x > 23) return 0;
  return value.length - (value.length - 1 - m[0].length);
}
