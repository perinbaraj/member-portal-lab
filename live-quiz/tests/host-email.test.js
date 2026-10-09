'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHostEmailService } = require('../services/host-email');

test('capture email mode is test-only unless explicitly enabled', () => {
  assert.equal(createHostEmailService({ NODE_ENV: 'test', HOST_EMAIL_MODE: 'capture' }).mode, 'capture');
  assert.throws(
    () => createHostEmailService({ NODE_ENV: 'production', HOST_EMAIL_MODE: 'capture' }),
    /allowed only in tests/,
  );
});

test('ACS email mode validates configuration and sends the OTP message', async () => {
  assert.throws(
    () => createHostEmailService({ HOST_EMAIL_MODE: 'acs' }),
    /HOST_EMAIL_ENDPOINT is required/,
  );

  let sentMessage;
  const emailClient = {
    async beginSend(message) {
      sentMessage = message;
      return { async pollUntilDone() { return { status: 'Succeeded' }; } };
    },
  };
  const service = createHostEmailService({
    HOST_EMAIL_MODE: 'acs',
    HOST_EMAIL_ENDPOINT: 'https://quiz.communication.azure.com',
    HOST_EMAIL_SENDER: 'donotreply@example.azurecomm.net',
  }, { emailClient });

  await service.sendHostOtp({
    to: 'host@github.com',
    otp: '012345',
    expiresMinutes: 10,
  });
  assert.equal(sentMessage.senderAddress, 'donotreply@example.azurecomm.net');
  assert.equal(sentMessage.recipients.to[0].address, 'host@github.com');
  assert.match(sentMessage.content.plainText, /012345/);
  assert.match(sentMessage.content.plainText, /10 minutes/);
});

test('ACS email mode supports a connection-string fallback', () => {
  let constructorArguments;
  class FakeEmailClient {
    constructor(...args) { constructorArguments = args; }
  }
  createHostEmailService({
    HOST_EMAIL_MODE: 'acs',
    HOST_EMAIL_ENDPOINT: 'https://quiz.communication.azure.com',
    HOST_EMAIL_CONNECTION_STRING: 'endpoint=https://quiz.communication.azure.com/;accesskey=test-key',
    HOST_EMAIL_SENDER: 'donotreply@example.azurecomm.net',
  }, { EmailClientClass: FakeEmailClient });
  assert.deepEqual(constructorArguments, [
    'endpoint=https://quiz.communication.azure.com/;accesskey=test-key',
  ]);
});

test('ACS email delivery failure is surfaced to the caller', async () => {
  const service = createHostEmailService({
    HOST_EMAIL_MODE: 'acs',
    HOST_EMAIL_ENDPOINT: 'https://quiz.communication.azure.com',
    HOST_EMAIL_SENDER: 'donotreply@example.azurecomm.net',
  }, {
    emailClient: {
      async beginSend() {
        return { async pollUntilDone() { return { status: 'Failed' }; } };
      },
    },
  });
  await assert.rejects(
    service.sendHostOtp({ to: 'host@microsoft.com', otp: '123456', expiresMinutes: 10 }),
    /did not succeed/,
  );
});
