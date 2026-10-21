/**
 * Minimal infix formula evaluator for amount inputs.
 *
 * Grammar:
 *   expr    := term (('+' | '-') term)*
 *   term    := factor (('*' | '/') factor)*
 *   factor  := '-' factor | postfix
 *   postfix := primary '%'*
 *   primary := NUMBER | '(' expr ')'
 *
 * Both `.` and `,` are decimal separators, whitespace (including the French
 * narrow no-break spaces used as thousands separators) is ignored, the
 * postfix `%` divides its operand by 100 (`5%` = 0.05), and `-` may prefix
 * any factor. Returns NaN on any syntax error, leftover input, or
 * non-finite result (e.g. division by zero).
 */

type Token = number | '+' | '-' | '*' | '/' | '%' | '(' | ')';

const OPERATORS = new Set(['+', '-', '*', '/', '%', '(', ')']);
const NUMBER_RE = /^\d+(?:[.,]\d*)?|^[.,]\d+/;

function tokenize(text: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }
    if (OPERATORS.has(c)) { tokens.push(c as Token); i++; continue; }
    const m = NUMBER_RE.exec(text.slice(i));
    if (m === null) return null;
    tokens.push(Number.parseFloat(m[0].replace(',', '.')));
    i += m[0].length;
  }
  return tokens;
}

interface Cursor { pos: number }

function parsePrimary(tokens: Token[], c: Cursor): number {
  const tok = tokens[c.pos];
  if (typeof tok === 'number') { c.pos++; return tok; }
  if (tok === '(') {
    c.pos++;
    const value = parseExpr(tokens, c);
    if (tokens[c.pos] === ')') { c.pos++; return value; }
    return Number.NaN;
  }
  return Number.NaN;
}

function parsePostfix(tokens: Token[], c: Cursor): number {
  let value = parsePrimary(tokens, c);
  while (tokens[c.pos] === '%') { c.pos++; value /= 100; }
  return value;
}

function parseFactor(tokens: Token[], c: Cursor): number {
  if (tokens[c.pos] === '-') { c.pos++; return -parseFactor(tokens, c); }
  return parsePostfix(tokens, c);
}

function parseTerm(tokens: Token[], c: Cursor): number {
  let value = parseFactor(tokens, c);
  while (tokens[c.pos] === '*' || tokens[c.pos] === '/') {
    const op = tokens[c.pos++];
    const right = parseFactor(tokens, c);
    value = op === '*' ? value * right : value / right;
  }
  return value;
}

function parseExpr(tokens: Token[], c: Cursor): number {
  let value = parseTerm(tokens, c);
  while (tokens[c.pos] === '+' || tokens[c.pos] === '-') {
    const op = tokens[c.pos++];
    const right = parseTerm(tokens, c);
    value = op === '+' ? value + right : value - right;
  }
  return value;
}

/**
 * Evaluates an amount expression: a plain number (`1234`, `12,50`) or an
 * infix formula (`1000*(1+5%)`). Returns NaN when the input is empty,
 * malformed, or evaluates to a non-finite value.
 */
export function evalFormula(text: string): number {
  const tokens = tokenize(text);
  if (tokens === null) return Number.NaN;
  const cursor: Cursor = { pos: 0 };
  const value = parseExpr(tokens, cursor);
  if (cursor.pos !== tokens.length || !Number.isFinite(value)) return Number.NaN;
  return value;
}
