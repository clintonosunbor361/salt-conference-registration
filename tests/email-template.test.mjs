import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

test('renders location as a separate full-width email card', () => {
  let sentEmail;
  const context = {
    console,
    MailApp: {
      sendEmail(to, subject, body, options) {
        sentEmail = { to, subject, body, options };
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return { getProperty: () => '' };
      }
    }
  };

  vm.createContext(context);
  const code = fs.readFileSync('google-apps-script/Code.gs', 'utf8');
  vm.runInContext(`${code}\nglobalThis.__sendConfirmationEmail = sendConfirmationEmail_;`, context);
  context.__sendConfirmationEmail({ name: 'Ada Test', email: 'ada@example.com' });

  const html = sentEmail.options.htmlBody;
  assert.match(html, /Open in Google Maps/);
  assert.match(html, /margin-top:12px/);
  assert.doesNotMatch(html, /padding-left:23px/);
  assert.doesNotMatch(html, /Sangotedo, Lagos<\/span><\/a><\/td><\/tr><\/table><a/);
});
