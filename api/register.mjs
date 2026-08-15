const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function clean(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed.' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid request body.' }, 400);
    }

    const registration = {
      registrationId: clean(body.registrationId, 80),
      name: clean(body.name, 120),
      email: clean(body.email, 180).toLowerCase(),
      phone: clean(body.phone, 40),
      oneChurchMember: clean(body.oneChurchMember, 3).toLowerCase()
    };

    if (
      !registration.registrationId ||
      !registration.name ||
      !validEmail(registration.email) ||
      !registration.phone ||
      !['yes', 'no'].includes(registration.oneChurchMember)
    ) {
      return json({ ok: false, error: 'Please provide valid registration details.' }, 400);
    }

    const appScriptUrl = process.env.APPS_SCRIPT_URL;
    const registrationSecret = process.env.REGISTRATION_SECRET;
    if (!appScriptUrl || !registrationSecret) {
      console.error('Registration service environment variables are missing.');
      return json({ ok: false, error: 'Registration is temporarily unavailable.' }, 503);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const upstream = await fetch(appScriptUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...registration, secret: registrationSecret }),
        signal: controller.signal
      });

      const responseText = await upstream.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error('Apps Script returned an invalid response.');
      }

      if (!upstream.ok || !result.ok) {
        console.error('Apps Script registration failed:', result.error || upstream.status);
        return json({ ok: false, error: result.error || 'Registration could not be completed.' }, 502);
      }

      return json({ ok: true, registrationId: registration.registrationId });
    } catch (error) {
      console.error('Registration service error:', error instanceof Error ? error.message : error);
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'Registration is taking too long. Please try again.'
        : 'We could not complete your registration. Please try again.';
      return json({ ok: false, error: message }, 502);
    } finally {
      clearTimeout(timeout);
    }
  }
};
