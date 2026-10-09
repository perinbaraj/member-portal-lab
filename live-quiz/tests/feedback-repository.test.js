'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  FileFeedbackRepository,
  MemoryFeedbackRepository,
} = require('../repositories/feedback-repository');

function sampleFeedback(id = 'feedback-id') {
  return {
    id,
    rating: 5,
    category: 'suggestion',
    comments: 'The quiz was easy to run.',
    email: 'host@example.com',
    role: 'host',
    sessionId: 'session_abcdefghijklmnop',
    sessionStatus: 'active',
    brand: 'github',
    phase: 'lobby',
    createdAt: '2026-10-05T12:00:00.000Z',
  };
}

test('memory feedback repository clones submissions', async () => {
  const repository = new MemoryFeedbackRepository();
  const feedback = sampleFeedback();
  await repository.createFeedback(feedback);
  feedback.comments = 'Changed after saving';
  const stored = await repository.listFeedback();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].comments, 'The quiz was easy to run.');
  stored[0].rating = 1;
  assert.equal((await repository.listFeedback())[0].rating, 5);
  assert.equal((await repository.getFeedback(feedback.id)).status, 'new');
  const updated = await repository.updateFeedback(feedback.id, {
    status: 'resolved',
    internalNote: 'Handled by support.',
    reviewedBy: 'Operator',
  }, { expectedRevision: 1 });
  assert.equal(updated.status, 'resolved');
  assert.equal(updated.revision, 2);
  await assert.rejects(
    repository.updateFeedback(feedback.id, { status: 'reviewed' }, { expectedRevision: 1 }),
    error => error.code === 'REVISION_CONFLICT',
  );
});

test('file feedback repository restores durable submissions', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'live-quiz-feedback-test-'));
  const filePath = path.join(directory, 'feedback.json');
  try {
    const writer = new FileFeedbackRepository(filePath);
    await writer.initialize();
    await writer.createFeedback(sampleFeedback());

    const reader = new FileFeedbackRepository(filePath);
    await reader.initialize();
    const [restored] = await reader.listFeedback();
    assert.equal(restored.category, 'suggestion');
    assert.equal(restored.sessionId, 'session_abcdefghijklmnop');
    assert.equal(JSON.stringify(restored).includes('resumeToken'), false);
    assert.equal(JSON.stringify(restored).includes('reconnectToken'), false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
