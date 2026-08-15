const REGISTRATION_SHEET = 'Registrations';
const REGISTRATION_HEADERS = [
  'Registration ID',
  'Registered At',
  'Full Name',
  'Email Address',
  'Phone Number',
  'One Church Member',
  'Confirmation Status',
  'Confirmation Sent At'
];

/**
 * Run this once from a script bound to the destination Google Sheet.
 * It creates the registration tab and stores the spreadsheet ID and secret.
 */
function setupRegistration() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open Apps Script from the destination Google Sheet.');

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('SPREADSHEET_ID', spreadsheet.getId());

  if (!properties.getProperty('REGISTRATION_SECRET')) {
    properties.setProperty('REGISTRATION_SECRET', Utilities.getUuid() + Utilities.getUuid());
  }

  const sheet = getOrCreateRegistrationSheet_(spreadsheet);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, REGISTRATION_HEADERS.length);

  console.log('REGISTRATION_SECRET=' + properties.getProperty('REGISTRATION_SECRET'));
  console.log('Setup complete. Copy the secret above into Vercel.');
}

function doGet() {
  return jsonResponse_({ ok: true, service: 'SALT registration' });
}

function doPost(event) {
  try {
    const payload = JSON.parse(event && event.postData ? event.postData.contents : '{}');
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty('REGISTRATION_SECRET');

    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse_({ ok: false, error: 'Unauthorized request.' });
    }

    const registration = validateRegistration_(payload);
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) throw new Error('Run setupRegistration() before accepting registrations.');

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = getOrCreateRegistrationSheet_(spreadsheet);
    const lock = LockService.getScriptLock();
    let rowNumber;

    lock.waitLock(10000);
    try {
      rowNumber = findRegistrationRow_(sheet, registration.registrationId);
      if (rowNumber && sheet.getRange(rowNumber, 7).getValue() === 'Confirmation sent') {
        return jsonResponse_({ ok: true, duplicate: true });
      }

      if (!rowNumber) {
        sheet.appendRow([
          safeCell_(registration.registrationId),
          new Date(),
          safeCell_(registration.name),
          safeCell_(registration.email),
          safeCell_(registration.phone),
          registration.oneChurchMember === 'yes' ? 'Yes' : 'No',
          'Pending',
          ''
        ]);
        rowNumber = sheet.getLastRow();
      }
    } finally {
      lock.releaseLock();
    }

    try {
      sendConfirmationEmail_(registration);
      sheet.getRange(rowNumber, 7, 1, 2).setValues([['Confirmation sent', new Date()]]);
    } catch (emailError) {
      sheet.getRange(rowNumber, 7).setValue('Email failed: ' + String(emailError.message || emailError).slice(0, 180));
      throw new Error('Registration was saved, but the confirmation email could not be sent.');
    }

    return jsonResponse_({ ok: true, registrationId: registration.registrationId });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, error: String(error.message || error) });
  }
}

function validateRegistration_(payload) {
  const registration = {
    registrationId: clean_(payload.registrationId, 80),
    name: clean_(payload.name, 120),
    email: clean_(payload.email, 180).toLowerCase(),
    phone: clean_(payload.phone, 40),
    oneChurchMember: clean_(payload.oneChurchMember, 3).toLowerCase()
  };

  if (!registration.registrationId) throw new Error('Registration ID is required.');
  if (!registration.name) throw new Error('Full name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registration.email)) throw new Error('A valid email address is required.');
  if (!registration.phone) throw new Error('Phone number is required.');
  if (['yes', 'no'].indexOf(registration.oneChurchMember) === -1) throw new Error('Membership selection is required.');
  return registration;
}

function sendConfirmationEmail_(registration) {
  const firstName = registration.name.split(/\s+/)[0];
  const subject = "You're registered for SALT Conference 2026";
  const merchUrl = 'https://selar.com/m/SALTONECHURCH';
  const plainBody = [
    'Hello ' + firstName + ',',
    '',
    'Your registration for SALT Conference 2026 is confirmed.',
    '',
    'Date: Saturday, 19 September 2026',
    'Time: 11:00 AM–4:00 PM',
    'Venue: One Church International, Beside Landwey Building, Sangotedo, Lagos',
    '',
    'Explore SALT merchandise: ' + merchUrl,
    '',
    'We look forward to seeing you.',
    'SALT Conference Team'
  ].join('\n');

  const htmlBody = '<div style="margin:0;padding:32px 18px;background:#f1f1ef;font-family:Arial,sans-serif;color:#17181a">' +
    '<div style="max-width:580px;margin:0 auto;overflow:hidden;border-radius:24px;background:#ffffff">' +
      '<div style="padding:34px;background:#151619;color:#ffffff">' +
        '<div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#b8b9bc">SALT CONFERENCE 2026</div>' +
        '<h1 style="margin:16px 0 0;font-size:38px;line-height:1">You\'re registered.</h1>' +
      '</div>' +
      '<div style="padding:34px">' +
        '<p style="margin:0 0 22px;font-size:17px;line-height:1.6">Hello ' + escapeHtml_(firstName) + ', your place at SALT Conference 2026 is confirmed.</p>' +
        '<div style="padding:20px;border-radius:16px;background:#f4f4f2;line-height:1.7">' +
          '<strong>Saturday, 19 September 2026</strong><br>' +
          '11:00 AM–4:00 PM<br>' +
          'One Church International<br>' +
          '<span style="color:#707175">Beside Landwey Building, Sangotedo, Lagos</span>' +
        '</div>' +
        '<a href="' + merchUrl + '" style="display:inline-block;margin-top:24px;padding:15px 22px;border-radius:14px;background:#17181a;color:#ffffff;font-weight:700;text-decoration:none">Explore SALT merch →</a>' +
        '<p style="margin:28px 0 0;color:#747579;font-size:13px;line-height:1.5">We look forward to seeing you.<br><strong style="color:#343539">SALT Conference Team</strong></p>' +
      '</div>' +
    '</div>' +
  '</div>';

  const options = {
    htmlBody: htmlBody,
    name: 'SALT Conference'
  };
  const replyTo = PropertiesService.getScriptProperties().getProperty('REPLY_TO_EMAIL');
  if (replyTo) options.replyTo = replyTo;

  MailApp.sendEmail(registration.email, subject, plainBody, options);
}

function getOrCreateRegistrationSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(REGISTRATION_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(REGISTRATION_SHEET);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(REGISTRATION_HEADERS);
    sheet.getRange(1, 1, 1, REGISTRATION_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#17181a')
      .setFontColor('#ffffff');
  }
  return sheet;
}

function findRegistrationRow_(sheet, registrationId) {
  if (sheet.getLastRow() < 2) return 0;
  const match = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(registrationId)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : 0;
}

function clean_(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function safeCell_(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
