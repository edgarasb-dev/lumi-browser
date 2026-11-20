import type { InstantAnswerSuggestion } from "../types";
import { getOmniboxActivePageUrl } from "../states";

// Safe Recursive-Descent Math Evaluator (no eval / Function)
type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: string }
  | { type: "ident"; value: string }
  | { type: "paren"; value: "(" | ")" };

function tokenizeMath(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = "";
      let dotCount = 0;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        if (expr[i] === ".") dotCount++;
        if (dotCount > 1) return null;
        numStr += expr[i++];
      }
      const value = Number(numStr);
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: "num", value });
      continue;
    }
    if (/[+\-*/^%]/.test(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let ident = "";
      while (i < expr.length && /[a-zA-Z]/.test(expr[i])) {
        ident += expr[i++].toLowerCase();
      }
      tokens.push({ type: "ident", value: ident });
      continue;
    }
    return null;
  }

  return tokens;
}

function evaluateMathExpression(raw: string): number | null {
  const tokens = tokenizeMath(raw);
  if (!tokens || tokens.length === 0) return null;

  // Avoid matching plain bare numbers like "2026" or "127.0"
  const hasOperatorOrFn = tokens.some((t) => t.type === "op" || t.type === "ident");
  if (!hasOperatorOrFn) return null;

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseExpr = (): number | null => {
    let left = parseTerm();
    if (left === null) return null;

    while (peek()?.type === "op" && (peek()?.value === "+" || peek()?.value === "-")) {
      const op = consume().value as string;
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = (): number | null => {
    let left = parsePower();
    if (left === null) return null;

    while (peek()?.type === "op" && (peek()?.value === "*" || peek()?.value === "/" || peek()?.value === "%")) {
      const op = consume().value as string;
      const right = parsePower();
      if (right === null) return null;
      if ((op === "/" || op === "%") && right === 0) return null;
      left = op === "*" ? left * right : op === "/" ? left / right : left % right;
    }
    return left;
  };

  const parsePower = (): number | null => {
    const base = parseUnary();
    if (base === null) return null;
    if (peek()?.type === "op" && peek()?.value === "^") {
      consume();
      const exp = parsePower();
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    return base;
  };

  const parseUnary = (): number | null => {
    if (peek()?.type === "op" && peek()?.value === "-") {
      consume();
      const val = parseUnary();
      return val === null ? null : -val;
    }
    if (peek()?.type === "op" && peek()?.value === "+") {
      consume();
      return parseUnary();
    }
    return parsePrimary();
  };

  const FUNCTIONS: Record<string, (n: number) => number> = {
    sqrt: Math.sqrt,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    ln: Math.log,
    log: Math.log10
  };

  const parsePrimary = (): number | null => {
    const tok = peek();
    if (!tok) return null;

    if (tok.type === "num") {
      consume();
      return tok.value;
    }
    if (tok.type === "paren" && tok.value === "(") {
      consume();
      const inner = parseExpr();
      if (inner === null || peek()?.type !== "paren" || peek()?.value !== ")") return null;
      consume();
      return inner;
    }
    if (tok.type === "ident") {
      consume();
      if (tok.value === "pi") return Math.PI;
      if (tok.value === "e") return Math.E;
      const fn = FUNCTIONS[tok.value];
      if (!fn || peek()?.type !== "paren" || peek()?.value !== "(") return null;
      consume();
      const arg = parseExpr();
      if (arg === null || peek()?.type !== "paren" || peek()?.value !== ")") return null;
      consume();
      return fn(arg);
    }
    return null;
  };

  const result = parseExpr();
  if (result === null || pos !== tokens.length || !Number.isFinite(result)) {
    return null;
  }
  return result;
}

function formatNumber(val: number): string {
  if (Number.isInteger(val)) return val.toLocaleString("en-US");
  const rounded = Number(val.toFixed(6));
  return rounded.toString();
}

// Color Converter (#RGB, #RRGGBB, rgb(r, g, b))
function parseColorAnswer(input: string): InstantAnswerSuggestion | null {
  let r: number | null = null;
  let g: number | null = null;
  let b: number | null = null;

  const hex3 = input.match(/^#([0-9a-f]{3})$/i);
  const hex6 = input.match(/^#([0-9a-f]{6})$/i);
  const rgbMatch = input.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);

  if (hex3) {
    const h = hex3[1];
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else if (hex6) {
    const h = hex6[1];
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else if (rgbMatch) {
    const cr = Number(rgbMatch[1]);
    const cg = Number(rgbMatch[2]);
    const cb = Number(rgbMatch[3]);
    if (cr <= 255 && cg <= 255 && cb <= 255) {
      r = cr;
      g = cg;
      b = cb;
    }
  }

  if (r === null || g === null || b === null) return null;

  const hex = `#${[r, g, b]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
  const rgb = `rgb(${r}, ${g}, ${b})`;

  // Convert RGB -> HSL
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  const hsl = `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;

  return {
    type: "instant-answer",
    kind: "color",
    title: `${hex}  ·  ${rgb}`,
    subtitle: `${hsl} — Press Enter to copy HEX`,
    copyValue: hex,
    hexPreview: hex,
    relevance: 1450,
    source: "instant-answer"
  };
}

// Unit Converter
const LINEAR_UNITS: Record<string, { group: string; factor: number; label: string }> = {
  px: { group: "css", factor: 1, label: "px" },
  rem: { group: "css", factor: 16, label: "rem" },
  em: { group: "css", factor: 16, label: "em" },
  km: { group: "length", factor: 1000, label: "km" },
  m: { group: "length", factor: 1, label: "m" },
  cm: { group: "length", factor: 0.01, label: "cm" },
  mm: { group: "length", factor: 0.001, label: "mm" },
  mi: { group: "length", factor: 1609.344, label: "mi" },
  miles: { group: "length", factor: 1609.344, label: "mi" },
  ft: { group: "length", factor: 0.3048, label: "ft" },
  in: { group: "length", factor: 0.0254, label: "in" },
  kg: { group: "weight", factor: 1000, label: "kg" },
  g: { group: "weight", factor: 1, label: "g" },
  lb: { group: "weight", factor: 453.59237, label: "lb" },
  lbs: { group: "weight", factor: 453.59237, label: "lb" },
  oz: { group: "weight", factor: 28.349523, label: "oz" },
  b: { group: "data", factor: 1, label: "B" },
  kb: { group: "data", factor: 1024, label: "KB" },
  mb: { group: "data", factor: 1024 ** 2, label: "MB" },
  gb: { group: "data", factor: 1024 ** 3, label: "GB" },
  tb: { group: "data", factor: 1024 ** 4, label: "TB" }
};

function parseUnitAnswer(input: string): InstantAnswerSuggestion | null {
  const match = input.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s+(?:to|in)\s+([a-zA-Z]+)$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const fromRaw = match[2].toLowerCase();
  const toRaw = match[3].toLowerCase();
  if (!Number.isFinite(amount)) return null;

  if ((fromRaw === "c" || fromRaw === "f") && (toRaw === "c" || toRaw === "f") && fromRaw !== toRaw) {
    const out = fromRaw === "c" ? (amount * 9) / 5 + 32 : ((amount - 32) * 5) / 9;
    const formatted = `${formatNumber(out)} °${toRaw.toUpperCase()}`;
    return {
      type: "instant-answer",
      kind: "unit",
      title: `${formatted}`,
      subtitle: `${amount} °${fromRaw.toUpperCase()} converted — Enter to copy`,
      copyValue: formatNumber(out),
      relevance: 1450,
      source: "instant-answer"
    };
  }

  const fromUnit = LINEAR_UNITS[fromRaw];
  const toUnit = LINEAR_UNITS[toRaw];
  if (!fromUnit || !toUnit || fromUnit.group !== toUnit.group) return null;

  const out = (amount * fromUnit.factor) / toUnit.factor;
  const formatted = `${formatNumber(out)} ${toUnit.label}`;
  const note = fromUnit.group === "css" ? " (16px root base)" : "";
  return {
    type: "instant-answer",
    kind: "unit",
    title: formatted,
    subtitle: `${amount} ${fromUnit.label}${note} — Enter to copy`,
    copyValue: formatted,
    relevance: 1450,
    source: "instant-answer"
  };
}

// Timezone Converter
const TIMEZONES: Record<string, { offsetHours: number; iana: string }> = {
  utc: { offsetHours: 0, iana: "UTC" },
  gmt: { offsetHours: 0, iana: "UTC" },
  est: { offsetHours: -5, iana: "America/New_York" },
  edt: { offsetHours: -4, iana: "America/New_York" },
  cst: { offsetHours: -6, iana: "America/Chicago" },
  pst: { offsetHours: -8, iana: "America/Los_Angeles" },
  pdt: { offsetHours: -7, iana: "America/Los_Angeles" },
  cet: { offsetHours: 1, iana: "Europe/Berlin" },
  eet: { offsetHours: 2, iana: "Europe/Vilnius" },
  eest: { offsetHours: 3, iana: "Europe/Vilnius" },
  ist: { offsetHours: 5.5, iana: "Asia/Kolkata" },
  jst: { offsetHours: 9, iana: "Asia/Tokyo" },
  aest: { offsetHours: 10, iana: "Australia/Sydney" }
};

function parseTimezoneAnswer(input: string): InstantAnswerSuggestion | null {
  const match = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+([a-zA-Z]{2,5})\s+(?:to|in)\s+([a-zA-Z]{2,5})$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();
  const fromTz = TIMEZONES[match[4].toLowerCase()];
  const toTz = TIMEZONES[match[5].toLowerCase()];
  if (!fromTz || !toTz || minute > 59 || hour > 23) return null;

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  const now = new Date();
  const utcMinutes = hour * 60 + minute - Math.round(fromTz.offsetHours * 60);
  const targetMinutes = (((utcMinutes + Math.round(toTz.offsetHours * 60)) % 1440) + 1440) % 1440;
  const outHour = Math.floor(targetMinutes / 60);
  const outMin = targetMinutes % 60;
  const hh = outHour.toString().padStart(2, "0");
  const mm = outMin.toString().padStart(2, "0");
  const h12 = `${outHour % 12 === 0 ? 12 : outHour % 12}:${mm} ${outHour >= 12 ? "PM" : "AM"}`;

  const dayDiff = Math.floor((utcMinutes + Math.round(toTz.offsetHours * 60)) / 1440);
  const dayLabel = dayDiff > 0 ? " (+1 day)" : dayDiff < 0 ? " (-1 day)" : "";

  return {
    type: "instant-answer",
    kind: "timezone",
    title: `${h12} (${hh}:${mm}) ${match[5].toUpperCase()}${dayLabel}`,
    subtitle: `Converted from ${match[4].toUpperCase()} (${now.toLocaleDateString()}) — Enter to copy`,
    copyValue: `${hh}:${mm} ${match[5].toUpperCase()}`,
    relevance: 1440,
    source: "instant-answer"
  };
}

export function getInstantAnswerSuggestions(trimmedInput: string): InstantAnswerSuggestion[] {
  const lower = trimmedInput.toLowerCase();

  // QR share trigger
  if (lower === "qr" || lower === "qr code" || lower === "share qr") {
    const activeUrl = getOmniboxActivePageUrl();
    if (activeUrl && (activeUrl.startsWith("http://") || activeUrl.startsWith("https://"))) {
      return [
        {
          type: "instant-answer",
          kind: "qr",
          title: "Scan QR Code on Mobile",
          subtitle: activeUrl,
          copyValue: activeUrl,
          qrValue: activeUrl,
          relevance: 1500,
          source: "instant-answer"
        }
      ];
    }
  }

  const color = parseColorAnswer(trimmedInput);
  if (color) return [color];

  const unit = parseUnitAnswer(trimmedInput);
  if (unit) return [unit];

  const tz = parseTimezoneAnswer(trimmedInput);
  if (tz) return [tz];

  const mathResult = evaluateMathExpression(trimmedInput);
  if (mathResult !== null) {
    const formatted = formatNumber(mathResult);
    return [
      {
        type: "instant-answer",
        kind: "math",
        title: `= ${formatted}`,
        subtitle: `Calculated result (${trimmedInput}) — Press Enter to copy`,
        copyValue: formatted,
        relevance: 1450,
        source: "instant-answer"
      }
    ];
  }

  return [];
}
