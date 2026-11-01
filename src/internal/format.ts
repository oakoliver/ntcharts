// Number formatting that matches Go's fmt verbs, so axis labels are the same
// strings upstream prints.

/**
 * Go's fmt.Sprintf("%.<prec>f", v). JavaScript's toFixed rounds the exact
 * binary value like Go does, except on exact ties, where it rounds away from
 * zero and Go rounds half to even (fmt.Sprintf("%.0f", 2.5) is "2").
 */
export function sprintfF(v: number, prec: number): string {
  if (Number.isNaN(v)) return 'NaN';
  if (v === Infinity) return '+Inf';
  if (v === -Infinity) return '-Inf';
  const neg = v < 0 || Object.is(v, -0);
  const a = Math.abs(v);
  let s: string;
  if (a >= 1e21) {
    // toFixed switches to exponent notation here; BigInt gives the integer part exactly.
    s = BigInt(a).toString() + (prec > 0 ? '.' + '0'.repeat(prec) : '');
  } else {
    s = a.toFixed(prec);
    const full = a.toFixed(Math.min(100, prec + 80));
    const dot = full.indexOf('.');
    const rest = full.slice(dot + 1 + prec);
    if (/^50*$/.test(rest)) {
      // exact tie: toFixed rounded up; round half to even instead
      const kept = (full.slice(0, dot) + full.slice(dot + 1, dot + 1 + prec)).replace(/^0+(?=\d)/, '');
      const lastDigit = Number(kept[kept.length - 1]);
      if (lastDigit % 2 === 0) {
        // even: truncate
        const intPart = full.slice(0, dot);
        s = prec > 0 ? `${intPart}.${full.slice(dot + 1, dot + 1 + prec)}` : intPart;
      }
    }
  }
  return neg ? '-' + s : s;
}
