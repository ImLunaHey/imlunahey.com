import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

// ─── dimensional quantities ────────────────────────────────────────────────
// Every quantity is stored as (value in SI base units, dimension vector). SI
// base dims: [L]ength, [M]ass, [T]ime, [I]current, [Θ]emperature, [N]amount,
// [J]luminous intensity, plus [A]ngle for convenience (strictly dimensionless
// but useful to tag). Arithmetic adds/subtracts the dimension vectors so
// "5 mph * 2 h" comes back as a length, not a nonsense compound.

type Dim = [number, number, number, number, number, number, number, number];
const ZERO_DIM: Dim = [0, 0, 0, 0, 0, 0, 0, 0];
const DIM_NAMES = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd', 'rad'];

type Unit = {
  name: string;
  aliases: string[];
  factor: number; // multiply the value by this to get SI base
  offset?: number; // for temperatures (°C, °F)
  dim: Dim;
};

const UNITS: Unit[] = [
  // length
  { name: 'm', aliases: ['meter', 'meters', 'metre', 'metres'], factor: 1, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'km', aliases: ['kilometer', 'kilometers', 'kilometre', 'kilometres'], factor: 1000, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'cm', aliases: ['centimeter', 'centimeters', 'centimetre', 'centimetres'], factor: 0.01, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'mm', aliases: ['millimeter', 'millimeters'], factor: 0.001, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'μm', aliases: ['um', 'micrometer', 'micrometers', 'micron', 'microns'], factor: 1e-6, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'nm', aliases: ['nanometer', 'nanometers'], factor: 1e-9, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'mi', aliases: ['mile', 'miles'], factor: 1609.344, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'yd', aliases: ['yard', 'yards'], factor: 0.9144, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'ft', aliases: ['foot', 'feet'], factor: 0.3048, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'in', aliases: ['inch', 'inches', '"'], factor: 0.0254, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'nmi', aliases: ['nautical_mile', 'nautical_miles'], factor: 1852, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'ly', aliases: ['lightyear', 'lightyears'], factor: 9.4607e15, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'au', aliases: ['astronomical_unit'], factor: 1.495978707e11, dim: [1, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'pc', aliases: ['parsec', 'parsecs'], factor: 3.0857e16, dim: [1, 0, 0, 0, 0, 0, 0, 0] },

  // mass
  { name: 'kg', aliases: ['kilogram', 'kilograms'], factor: 1, dim: [0, 1, 0, 0, 0, 0, 0, 0] },
  { name: 'g', aliases: ['gram', 'grams'], factor: 0.001, dim: [0, 1, 0, 0, 0, 0, 0, 0] },
  { name: 'mg', aliases: ['milligram', 'milligrams'], factor: 1e-6, dim: [0, 1, 0, 0, 0, 0, 0, 0] },
  { name: 't', aliases: ['tonne', 'tonnes', 'metric_ton'], factor: 1000, dim: [0, 1, 0, 0, 0, 0, 0, 0] },
  { name: 'lb', aliases: ['pound', 'pounds', 'lbs'], factor: 0.45359237, dim: [0, 1, 0, 0, 0, 0, 0, 0] },
  { name: 'oz', aliases: ['ounce', 'ounces'], factor: 0.028349523125, dim: [0, 1, 0, 0, 0, 0, 0, 0] },
  { name: 'st', aliases: ['stone', 'stones'], factor: 6.35029318, dim: [0, 1, 0, 0, 0, 0, 0, 0] },

  // time
  { name: 's', aliases: ['sec', 'secs', 'second', 'seconds'], factor: 1, dim: [0, 0, 1, 0, 0, 0, 0, 0] },
  { name: 'ms', aliases: ['millisecond', 'milliseconds'], factor: 0.001, dim: [0, 0, 1, 0, 0, 0, 0, 0] },
  { name: 'μs', aliases: ['us', 'microsecond', 'microseconds'], factor: 1e-6, dim: [0, 0, 1, 0, 0, 0, 0, 0] },
  { name: 'ns', aliases: ['nanosecond', 'nanoseconds'], factor: 1e-9, dim: [0, 0, 1, 0, 0, 0, 0, 0] },
  { name: 'min', aliases: ['minute', 'minutes'], factor: 60, dim: [0, 0, 1, 0, 0, 0, 0, 0] },
  { name: 'h', aliases: ['hr', 'hrs', 'hour', 'hours'], factor: 3600, dim: [0, 0, 1, 0, 0, 0, 0, 0] },
  { name: 'day', aliases: ['days'], factor: 86400, dim: [0, 0, 1, 0, 0, 0, 0, 0] },
  { name: 'week', aliases: ['weeks'], factor: 604800, dim: [0, 0, 1, 0, 0, 0, 0, 0] },
  { name: 'year', aliases: ['years', 'yr', 'yrs'], factor: 31557600, dim: [0, 0, 1, 0, 0, 0, 0, 0] },

  // temperature (factor + offset; for °C: K = °C + 273.15)
  { name: 'K', aliases: ['kelvin'], factor: 1, dim: [0, 0, 0, 0, 1, 0, 0, 0] },
  { name: '°C', aliases: ['C', 'celsius', 'centigrade'], factor: 1, offset: 273.15, dim: [0, 0, 0, 0, 1, 0, 0, 0] },
  { name: '°F', aliases: ['F', 'fahrenheit'], factor: 5 / 9, offset: 459.67 * 5 / 9, dim: [0, 0, 0, 0, 1, 0, 0, 0] },

  // speed (derived but common as a standalone unit)
  { name: 'mph', aliases: [], factor: 0.44704, dim: [1, 0, -1, 0, 0, 0, 0, 0] },
  { name: 'kph', aliases: ['km/h'], factor: 1 / 3.6, dim: [1, 0, -1, 0, 0, 0, 0, 0] },
  { name: 'knot', aliases: ['knots', 'kn'], factor: 0.514444, dim: [1, 0, -1, 0, 0, 0, 0, 0] },
  { name: 'c', aliases: ['speed_of_light'], factor: 299792458, dim: [1, 0, -1, 0, 0, 0, 0, 0] },

  // force, energy, power, pressure
  { name: 'N', aliases: ['newton', 'newtons'], factor: 1, dim: [1, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'lbf', aliases: ['pound_force'], factor: 4.4482216, dim: [1, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'J', aliases: ['joule', 'joules'], factor: 1, dim: [2, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'kJ', aliases: ['kilojoule', 'kilojoules'], factor: 1000, dim: [2, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'cal', aliases: ['calorie', 'calories'], factor: 4.184, dim: [2, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'kcal', aliases: ['kilocalorie', 'kilocalories'], factor: 4184, dim: [2, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'kWh', aliases: ['kilowatt_hour'], factor: 3.6e6, dim: [2, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'Wh', aliases: ['watt_hour'], factor: 3600, dim: [2, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'eV', aliases: ['electronvolt', 'electronvolts'], factor: 1.602176634e-19, dim: [2, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'W', aliases: ['watt', 'watts'], factor: 1, dim: [2, 1, -3, 0, 0, 0, 0, 0] },
  { name: 'kW', aliases: ['kilowatt', 'kilowatts'], factor: 1000, dim: [2, 1, -3, 0, 0, 0, 0, 0] },
  { name: 'hp', aliases: ['horsepower'], factor: 745.6999, dim: [2, 1, -3, 0, 0, 0, 0, 0] },
  { name: 'Pa', aliases: ['pascal', 'pascals'], factor: 1, dim: [-1, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'kPa', aliases: ['kilopascal'], factor: 1000, dim: [-1, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'bar', aliases: ['bars'], factor: 100000, dim: [-1, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'atm', aliases: ['atmosphere'], factor: 101325, dim: [-1, 1, -2, 0, 0, 0, 0, 0] },
  { name: 'psi', aliases: [], factor: 6894.76, dim: [-1, 1, -2, 0, 0, 0, 0, 0] },

  // volume
  { name: 'L', aliases: ['l', 'liter', 'liters', 'litre', 'litres'], factor: 0.001, dim: [3, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'mL', aliases: ['ml', 'milliliter', 'milliliters'], factor: 1e-6, dim: [3, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'gal', aliases: ['gallon', 'gallons'], factor: 0.00378541, dim: [3, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'pt', aliases: ['pint', 'pints'], factor: 0.000473176, dim: [3, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'qt', aliases: ['quart', 'quarts'], factor: 0.000946353, dim: [3, 0, 0, 0, 0, 0, 0, 0] },

  // data
  { name: 'B', aliases: ['byte', 'bytes'], factor: 1, dim: ZERO_DIM },
  { name: 'KB', aliases: [], factor: 1000, dim: ZERO_DIM },
  { name: 'MB', aliases: [], factor: 1e6, dim: ZERO_DIM },
  { name: 'GB', aliases: [], factor: 1e9, dim: ZERO_DIM },
  { name: 'TB', aliases: [], factor: 1e12, dim: ZERO_DIM },
  { name: 'KiB', aliases: [], factor: 1024, dim: ZERO_DIM },
  { name: 'MiB', aliases: [], factor: 1024 ** 2, dim: ZERO_DIM },
  { name: 'GiB', aliases: [], factor: 1024 ** 3, dim: ZERO_DIM },
  { name: 'TiB', aliases: [], factor: 1024 ** 4, dim: ZERO_DIM },
  { name: 'bit', aliases: ['bits'], factor: 0.125, dim: ZERO_DIM },
];

function resolveUnit(raw: string): Unit | null {
  return UNITS.find((u) => u.name === raw || u.aliases.includes(raw)) ?? null;
}

// ─── tokenizer + parser (a mini expression language) ───────────────────────
// Grammar:  expr := term ( ('+' | '-') term )*
//           term := factor ( ('*' | '/' | '^') factor )*
//           factor := number | unit | '(' expr ')' | number unit

type Quantity = { value: number; dim: Dim };

type Token =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { t: 'lp' } | { t: 'rp' }
  | { t: 'to' };

function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c === '(') { out.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { out.push({ t: 'rp' }); i++; continue; }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^') {
      out.push({ t: 'op', v: c }); i++; continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.eE+-]/.test(s[j])) {
        if ((s[j] === '+' || s[j] === '-') && !/[eE]/.test(s[j - 1] ?? '')) break;
        j++;
      }
      out.push({ t: 'num', v: Number(s.slice(i, j)) });
      i = j;
      continue;
    }
    // identifier — letters / unicode degree / slash-suffix / prime
    if (/[A-Za-z°μ"']/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_°μ/²³"']/.test(s[j])) j++;
      const tok = s.slice(i, j);
      if (tok === 'to' || tok === 'in') out.push({ t: 'to' });
      else out.push({ t: 'id', v: tok });
      i = j;
      continue;
    }
    throw new Error(`unexpected '${c}'`);
  }
  return out;
}

function addDim(a: Dim, b: Dim, sign = 1): Dim {
  const o = [...a] as Dim;
  for (let i = 0; i < 8; i++) o[i] += sign * b[i];
  return o;
}

function scaleDim(d: Dim, k: number): Dim {
  const o = [...d] as Dim;
  for (let i = 0; i < 8; i++) o[i] *= k;
  return o;
}

function dimEq(a: Dim, b: Dim): boolean {
  for (let i = 0; i < 8; i++) if (a[i] !== b[i]) return false;
  return true;
}

function fromUnit(u: Unit, value: number): Quantity {
  // temperature handling: value_K = value * factor + offset
  return { value: value * u.factor + (u.offset ?? 0), dim: u.dim };
}

function toUnit(q: Quantity, u: Unit): number {
  return (q.value - (u.offset ?? 0)) / u.factor;
}

class Parser {
  constructor(private tokens: Token[], private pos = 0) {}
  peek(): Token | undefined { return this.tokens[this.pos]; }
  next(): Token | undefined { return this.tokens[this.pos++]; }

  parseExpr(): Quantity {
    let q = this.parseTerm();
    while (true) {
      const t = this.peek();
      if (!t || t.t !== 'op' || (t.v !== '+' && t.v !== '-')) break;
      this.next();
      const r = this.parseTerm();
      if (!dimEq(q.dim, r.dim)) throw new Error(`can't add ${dimLabel(q.dim)} and ${dimLabel(r.dim)}`);
      q = { value: t.v === '+' ? q.value + r.value : q.value - r.value, dim: q.dim };
    }
    return q;
  }

  parseTerm(): Quantity {
    let q = this.parsePower();
    while (true) {
      const t = this.peek();
      if (!t) break;
      if (t.t === 'op' && (t.v === '*' || t.v === '/')) {
        this.next();
        const r = this.parsePower();
        q = t.v === '*'
          ? { value: q.value * r.value, dim: addDim(q.dim, r.dim) }
          : { value: q.value / r.value, dim: addDim(q.dim, r.dim, -1) };
        continue;
      }
      // implicit multiplication: number directly followed by unit, or two grouped terms
      if ((t.t === 'id' || t.t === 'num' || t.t === 'lp') && q.dim.every((v, i) => !(v === 0 && i >= 0) || true)) {
        // only auto-multiply a number with an immediately following unit identifier
        if (t.t === 'id') {
          const u = resolveUnit(t.v);
          if (u) {
            this.next();
            const r = fromUnit(u, 1);
            q = { value: q.value * r.value, dim: addDim(q.dim, r.dim) };
            continue;
          }
        }
      }
      break;
    }
    return q;
  }

  parsePower(): Quantity {
    let q = this.parseFactor();
    const t = this.peek();
    if (t && t.t === 'op' && t.v === '^') {
      this.next();
      const exp = this.parseFactor();
      if (!exp.dim.every((d) => d === 0)) throw new Error('exponent must be dimensionless');
      q = { value: Math.pow(q.value, exp.value), dim: scaleDim(q.dim, exp.value) };
    }
    return q;
  }

  parseFactor(): Quantity {
    const t = this.next();
    if (!t) throw new Error('unexpected end of input');
    if (t.t === 'op' && t.v === '-') {
      const inner = this.parseFactor();
      return { value: -inner.value, dim: inner.dim };
    }
    if (t.t === 'num') return { value: t.v, dim: ZERO_DIM };
    if (t.t === 'id') {
      const u = resolveUnit(t.v);
      if (!u) throw new Error(`unknown unit '${t.v}'`);
      return fromUnit(u, 1);
    }
    if (t.t === 'lp') {
      const inner = this.parseExpr();
      const r = this.next();
      if (!r || r.t !== 'rp') throw new Error('missing )');
      return inner;
    }
    throw new Error(`unexpected token`);
  }
}

function dimLabel(d: Dim): string {
  if (d.every((v) => v === 0)) return 'scalar';
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) {
    if (d[i] === 0) continue;
    parts.push(d[i] === 1 ? DIM_NAMES[i] : `${DIM_NAMES[i]}^${d[i]}`);
  }
  return parts.join('·');
}

type Evaluated = {
  value: Quantity;
  targetUnit?: Unit;
  targetValue?: number;
  dim: string;
};

function evaluate(input: string): Evaluated {
  const tokens = tokenize(input);
  const toIdx = tokens.findIndex((t) => t.t === 'to');
  let lhs: Token[], rhs: Token[] | null = null;
  if (toIdx >= 0) { lhs = tokens.slice(0, toIdx); rhs = tokens.slice(toIdx + 1); }
  else lhs = tokens;

  const lhsParser = new Parser(lhs);
  const q = lhsParser.parseExpr();
  if (lhsParser.peek()) throw new Error('unexpected extra tokens');

  if (rhs) {
    // expect a single unit identifier
    const rt = rhs.filter((t) => t.t !== 'num' || t.v !== 1);
    if (rt.length !== 1 || rt[0].t !== 'id') throw new Error(`'to' needs a unit`);
    const u = resolveUnit(rt[0].v);
    if (!u) throw new Error(`unknown unit '${rt[0].v}'`);
    if (!dimEq(q.dim, u.dim)) throw new Error(`incompatible dimensions: ${dimLabel(q.dim)} vs ${dimLabel(u.dim)}`);
    return { value: q, targetUnit: u, targetValue: toUnit(q, u), dim: dimLabel(q.dim) };
  }
  return { value: q, dim: dimLabel(q.dim) };
}

function guessAlternates(q: Quantity): { unit: string; value: number }[] {
  const matches = UNITS.filter((u) => dimEq(u.dim, q.dim));
  return matches.slice(0, 8).map((u) => ({ unit: u.name, value: toUnit(q, u) }));
}

function fmt(n: number): string {
  if (!isFinite(n)) return 'Infinity';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-4) return n.toExponential(4);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

const EXAMPLES = [
  '5 mph * 2 hours to miles',
  '100 ft to m',
  '212 °F to °C',
  '1 kWh to J',
  '(4 GB / 100 Mbps) to seconds',
  '1 ly to au',
  '80 kg * 9.81 m / s^2 to N',
];

export default function UnitsPage() {
  const [input, setInput] = useState('5 mph * 2 hours to miles');

  const result = useMemo(() => {
    try {
      return { ok: true as const, value: evaluate(input) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [input]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-units">
        <header className="page-hd">
          <div className="label">~/labs/units</div>
          <h1>units<span className="dot">.</span></h1>
          <p className="sub">
            dimensional analysis calculator. compound expressions, not just "X to Y". tracks units through
            multiplication, division, and powers — so <code>5 mph × 2 hours</code> comes back as a length,
            not a nonsense compound.
          </p>
        </header>

        <section className="input-row">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </section>

        <section className="examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="ex-btn" onClick={() => setInput(ex)}>{ex}</button>
          ))}
        </section>

        {result.ok ? (
          <>
            <section className="result">
              {result.value.targetUnit ? (
                <div className="headline">
                  <div className="big">{fmt(result.value.targetValue!)} <span className="u">{result.value.targetUnit.name}</span></div>
                  <div className="dim">dim · {result.value.dim}</div>
                </div>
              ) : (
                <div className="headline">
                  <div className="big">{fmt(result.value.value.value)} <span className="u">{result.value.dim === 'scalar' ? '(scalar)' : `si base · ${result.value.dim}`}</span></div>
                  <div className="dim">dim · {result.value.dim}</div>
                </div>
              )}
            </section>

            {result.value.dim !== 'scalar' ? (
              <section className="panel">
                <div className="panel-hd">equivalent in other {result.value.dim.split('·')[0]} units</div>
                <table className="alt">
                  <tbody>
                    {guessAlternates(result.value.value).map((a) => (
                      <tr key={a.unit}>
                        <td className="u-name">{a.unit}</td>
                        <td className="u-val">{fmt(a.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}
          </>
        ) : (
          <div className="err">{result.error}</div>
        )}

        <footer className="labs-footer">
          <span>units · <span className="t-accent">{UNITS.length} registered · dimension-checked</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-units { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); }
  .page-hd code { font-family: var(--font-mono); color: var(--color-accent); font-size: 0.9em; }

  .input-row { margin-top: var(--sp-5); }
  .input {
    width: 100%;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-lg);
    padding: var(--sp-3) var(--sp-4);
    outline: 0;
  }
  .input:focus { border-color: var(--color-accent-dim); }

  .examples { margin-top: var(--sp-3); display: flex; gap: 6px; flex-wrap: wrap; }
  .ex-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-fg-dim);
    padding: 3px 10px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    cursor: pointer;
  }
  .ex-btn:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .result {
    margin-top: var(--sp-5);
    padding: var(--sp-5) var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .headline { display: flex; flex-direction: column; gap: var(--sp-2); }
  .big { font-family: var(--font-display); font-size: clamp(32px, 6vw, 64px); color: var(--color-accent); letter-spacing: -0.02em; }
  .big .u { color: var(--color-fg); font-size: 0.6em; margin-left: var(--sp-3); }
  .dim { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); letter-spacing: 0.08em; text-transform: uppercase; }

  .panel { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .panel-hd { padding: 10px var(--sp-4); border-bottom: 1px solid var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); letter-spacing: 0.08em; text-transform: uppercase; }
  .alt { width: 100%; border-collapse: collapse; }
  .alt td { padding: 6px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); border-bottom: 1px dashed var(--color-border); }
  .alt tr:last-child td { border-bottom: 0; }
  .u-name { color: var(--color-fg-dim); width: 120px; }
  .u-val { color: var(--color-fg); font-variant-numeric: tabular-nums; }

  .err { margin-top: var(--sp-5); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-alert); color: var(--color-alert); background: color-mix(in oklch, var(--color-alert) 6%, transparent); font-family: var(--font-mono); font-size: var(--fs-sm); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
