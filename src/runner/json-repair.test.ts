import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { repairAgentJson } from './json-repair.js';

describe('repairAgentJson', () => {
  it('escapes a literal newline inside a string value', () => {
    const malformed = '{"body": "line one\nline two"}';
    const repaired = repairAgentJson(malformed);
    const parsed = JSON.parse(repaired) as { body: string };
    assert.equal(parsed.body, 'line one\nline two');
  });

  it('escapes a literal tab inside a string value', () => {
    const malformed = '{"body": "col1\tcol2"}';
    const repaired = repairAgentJson(malformed);
    const parsed = JSON.parse(repaired) as { body: string };
    assert.equal(parsed.body, 'col1\tcol2');
  });

  it('escapes other control characters inside a string value as \\uXXXX', () => {
    const malformed = '{"body": "bell\u0007here"}';
    const repaired = repairAgentJson(malformed);
    const parsed = JSON.parse(repaired) as { body: string };
    assert.equal(parsed.body, 'bell\u0007here');
  });

  it('normalizes smart double quotes used as JSON delimiters', () => {
    const malformed = '{\u201Cbody\u201D: \u201Chello\u201D}';
    const repaired = repairAgentJson(malformed);
    const parsed = JSON.parse(repaired) as { body: string };
    assert.equal(parsed.body, 'hello');
  });

  it('normalizes smart single quotes (apostrophes) inside string values', () => {
    const malformed = '{"body": "I\u2019m here, that\u2019s fine"}';
    const repaired = repairAgentJson(malformed);
    const parsed = JSON.parse(repaired) as { body: string };
    assert.equal(parsed.body, "I'm here, that's fine");
  });

  it('preserves already-escaped sequences without double-escaping', () => {
    const valid = '{"body": "line one\\nline two"}';
    const repaired = repairAgentJson(valid);
    const parsed = JSON.parse(repaired) as { body: string };
    assert.equal(parsed.body, 'line one\nline two');
  });

  it('preserves a backslash-escaped quote inside a string', () => {
    const valid = '{"body": "she said \\"hi\\""}';
    const repaired = repairAgentJson(valid);
    const parsed = JSON.parse(repaired) as { body: string };
    assert.equal(parsed.body, 'she said "hi"');
  });

  it('repairs the LinkedIn-style payload with embedded newline at position ~580', () => {
    const body =
      "I still carry a caseload.\n\nEvery Tuesday and Thursday, I'm on a middle school campus. " +
      "IEP meetings, crisis response, documentation that piles up faster than I can clear it.\n\n" +
      "That's why this newsletter exists. Practitioner-to-practitioner. Real strategies that " +
      "work in the field, not the textbook version.";
    const malformed = `{\n  "body": "${body}",\n  "notes": "pain-point post"\n}`;
    assert.throws(() => JSON.parse(malformed));

    const repaired = repairAgentJson(malformed);
    const parsed = JSON.parse(repaired) as { body: string; notes: string };
    assert.equal(parsed.body, body);
    assert.equal(parsed.notes, 'pain-point post');
  });

  it('returns text unchanged when already valid JSON', () => {
    const valid = '{"a":1,"b":"two"}';
    assert.equal(repairAgentJson(valid), valid);
  });

  it('does not mutate content outside string literals', () => {
    const malformed = '{"a": 1,\n"b": "x\ny"}';
    const repaired = repairAgentJson(malformed);
    const parsed = JSON.parse(repaired) as { a: number; b: string };
    assert.equal(parsed.a, 1);
    assert.equal(parsed.b, 'x\ny');
  });
});
