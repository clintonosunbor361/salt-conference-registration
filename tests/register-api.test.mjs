import assert from 'node:assert/strict';
import test from 'node:test';
import register from '../api/register.mjs';

const validRegistration = {
  registrationId: 'test-registration-id',
  name: 'Ada Test',
  email: 'ADA@example.com',
  phone: '08000000000',
  gender: 'female',
  oneChurchMember: 'yes'
};

test('rejects an unsupported gender before contacting Apps Script', async () => {
  const originalFetch = globalThis.fetch;
  let contactedUpstream = false;
  globalThis.fetch = async () => {
    contactedUpstream = true;
    return Response.json({ ok: true });
  };

  try {
    const request = new Request('http://localhost/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validRegistration, gender: 'unsupported' })
    });
    const response = await register.fetch(request);
    assert.equal(response.status, 400);
    assert.equal(contactedUpstream, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects incomplete registrations before contacting Apps Script', async () => {
  const originalFetch = globalThis.fetch;
  let contactedUpstream = false;
  globalThis.fetch = async () => {
    contactedUpstream = true;
    return Response.json({ ok: true });
  };

  try {
    const request = new Request('http://localhost/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' })
    });
    const response = await register.fetch(request);
    assert.equal(response.status, 400);
    assert.equal(contactedUpstream, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('passes through the already-registered state without exposing the secret', async () => {
  const originalFetch = globalThis.fetch;
  process.env.APPS_SCRIPT_URL = 'https://example.test/exec';
  process.env.REGISTRATION_SECRET = 'test-secret';
  let forwardedBody;

  globalThis.fetch = async (_url, options) => {
    forwardedBody = JSON.parse(options.body);
    return Response.json({ ok: true, alreadyRegistered: true });
  };

  try {
    const request = new Request('http://localhost/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validRegistration)
    });
    const response = await register.fetch(request);
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.alreadyRegistered, true);
    assert.equal(result.secret, undefined);
    assert.equal(forwardedBody.email, 'ada@example.com');
    assert.equal(forwardedBody.secret, 'test-secret');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
