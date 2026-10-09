'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('../public/batch-prompt-builder');

test('builds a provider-neutral prompt for the paste parser', () => {
  const prompt = build({
    brand: 'github',
    label: 'Developer tools',
    tags: ['GitHub', 'Git'],
    count: 6,
    guidance: 'Use beginner-friendly scenarios.',
  });

  assert.match(prompt, /Create exactly 6 accurate/);
  assert.match(prompt, /Experience: GitHub Platform Challenge/);
  assert.match(prompt, /Batch label: Developer tools/);
  assert.match(prompt, /Topics or tags: GitHub, Git/);
  assert.match(prompt, /Additional guidance: Use beginner-friendly scenarios/);
  assert.match(prompt, /Question: <question text>/);
  assert.match(prompt, /A: <option>[\s\S]*D: <option>/);
  assert.match(prompt, /Answer: <A, B, C, or D>/);
  assert.match(prompt, /Put Question, A, B, C, D, and Answer on separate lines/);
  assert.match(prompt, /Never place two labels on the same line/);
  assert.match(prompt, /Do not include numbering, markdown fences/);
});

test('validates the requested question count and supports Microsoft branding', () => {
  assert.throws(() => build({ count: 0 }), /between 1 and 50/);
  assert.match(build({ brand: 'microsoft', count: 1 }), /Microsoft Cloud Challenge/);
});

test('builds a Microsoft 365 Copilot prompt grounded in an attached slide deck', () => {
  const prompt = build({
    sourceMode: 'slide-deck',
    brand: 'microsoft',
    label: 'Customer presentation',
    count: 5,
  });
  assert.match(prompt, /PowerPoint presentation attached to or open in this Microsoft 365 Copilot conversation/i);
  assert.match(prompt, /sole factual source/i);
  assert.match(prompt, /only in content stated or clearly shown in the presentation/i);
  assert.match(prompt, /without inventing details or using outside knowledge/i);
  assert.match(prompt, /Question: <question text>[\s\S]*Answer: <A, B, C, or D>/);
});
