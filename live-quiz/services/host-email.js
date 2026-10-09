'use strict';

const { EmailClient } = require('@azure/communication-email');
const { DefaultAzureCredential } = require('@azure/identity');

function requiredUrl(value, name) {
  if (!value) throw new Error(`${name} is required when HOST_EMAIL_MODE=acs.`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL.`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${name} must be an HTTPS URL without credentials, query, or fragment.`);
  }
  return parsed.origin;
}

function requiredSender(value) {
  if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw new Error('HOST_EMAIL_SENDER must be a valid email address when HOST_EMAIL_MODE=acs.');
  }
  return value.trim();
}

function createHostEmailService(env = process.env, dependencies = {}) {
  const mode = env.HOST_EMAIL_MODE || (env.NODE_ENV === 'test' ? 'capture' : 'acs');
  if (mode === 'capture') {
    if (env.NODE_ENV !== 'test' && env.ALLOW_HOST_EMAIL_CAPTURE !== '1') {
      throw new Error('HOST_EMAIL_MODE=capture is allowed only in tests unless ALLOW_HOST_EMAIL_CAPTURE=1.');
    }
    return {
      mode,
      async sendHostOtp() {},
    };
  }
  if (mode !== 'acs') throw new Error('HOST_EMAIL_MODE must be "acs" or "capture".');

  const endpoint = requiredUrl(env.HOST_EMAIL_ENDPOINT, 'HOST_EMAIL_ENDPOINT');
  const senderAddress = requiredSender(env.HOST_EMAIL_SENDER);
  const connectionString = env.HOST_EMAIL_CONNECTION_STRING?.trim();
  const EmailClientClass = dependencies.EmailClientClass || EmailClient;
  const client = dependencies.emailClient || (connectionString
    ? new EmailClientClass(connectionString)
    : new EmailClientClass(endpoint, dependencies.credential || new DefaultAzureCredential()));

  return {
    mode,
    async sendHostOtp({ to, otp, expiresMinutes }) {
      const poller = await client.beginSend({
        senderAddress,
        content: {
          subject: 'Your live quiz host access code',
          plainText: [
            `Your host access code is ${otp}.`,
            '',
            `It expires in ${expiresMinutes} minutes and can be used once.`,
            'If you did not request this code, you can ignore this email.',
          ].join('\n'),
          html: [
            '<p>Your live quiz host access code is:</p>',
            `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${otp}</p>`,
            `<p>It expires in ${expiresMinutes} minutes and can be used once.</p>`,
            '<p>If you did not request this code, you can ignore this email.</p>',
          ].join(''),
        },
        recipients: { to: [{ address: to }] },
      });
      const result = await poller.pollUntilDone();
      if (!result || result.status !== 'Succeeded') {
        throw new Error(`ACS Email send did not succeed (status: ${result?.status || 'unknown'}).`);
      }
    },
  };
}

module.exports = { createHostEmailService };
