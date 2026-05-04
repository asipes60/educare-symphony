/**
 * Repair pass invoked only when the initial JSON.parse on an agent response
 * fails. Walks the text as a state machine that tracks whether the cursor is
 * inside a JSON string literal, escapes literal control characters that should
 * have been escaped at the source, and normalizes smart quotes the model
 * sometimes emits in delimiter or content positions.
 *
 * Trade-off: smart double quotes are treated as `"` everywhere, even when they
 * appear inside string content. We accept some content mutation here because
 * the alternative is a failed parse and a dropped task. This pass runs only
 * after the strict parse has already failed, so well-formed responses are
 * untouched.
 */

const SMART_SINGLE_QUOTES = new Set(['\u2018', '\u2019', '\u201A']);

function isDoubleQuoteLike(ch: string): boolean {
  return ch === '"' || ch === '\u201C' || ch === '\u201D' || ch === '\u201E';
}

export function repairAgentJson(text: string): string {
  const out: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        out.push(ch);
        escape = false;
        continue;
      }
      if (ch === '\\') {
        out.push(ch);
        escape = true;
        continue;
      }
      if (isDoubleQuoteLike(ch)) {
        out.push('"');
        inString = false;
        continue;
      }
      if (SMART_SINGLE_QUOTES.has(ch)) {
        out.push("'");
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        if (ch === '\n') out.push('\\n');
        else if (ch === '\r') out.push('\\r');
        else if (ch === '\t') out.push('\\t');
        else if (ch === '\b') out.push('\\b');
        else if (ch === '\f') out.push('\\f');
        else out.push('\\u' + code.toString(16).padStart(4, '0'));
        continue;
      }
      out.push(ch);
      continue;
    }

    if (isDoubleQuoteLike(ch)) {
      out.push('"');
      inString = true;
      continue;
    }
    if (SMART_SINGLE_QUOTES.has(ch)) {
      out.push("'");
      continue;
    }
    out.push(ch);
  }

  return out.join('');
}
