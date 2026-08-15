# SALT Conference Registration

Responsive registration experience for SALT Conference 2026, with Google Sheets storage, confirmation email delivery, and a post-registration merchandise page.

## Event

- Date: 19 September 2026
- Time: 10:00 AM–3:00 PM WAT
- Venue: One Church International, Beside Landwey Building, Sangotedo, Lagos

## Registration flow

1. The browser submits registration details to `/api/register`.
2. The Vercel Function validates the data and forwards it to Google Apps Script.
3. Apps Script appends the registration to the `Registrations` sheet.
4. Apps Script sends the attendee an HTML confirmation email.
5. The page displays the confirmation and SALT merchandise campaigns.

The success page is only shown after Apps Script reports that both the spreadsheet entry and email were completed.

## Google Sheets and Apps Script setup

1. Create or open the Google Sheet that should receive registrations.
2. In the sheet, select **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with [google-apps-script/Code.gs](google-apps-script/Code.gs).
4. Save the project and run `setupRegistration` once from the Apps Script editor.
5. Approve the requested Google Sheets and email permissions.
6. Open the execution log and copy the generated `REGISTRATION_SECRET`.
7. Select **Deploy → New deployment → Web app**.
8. Set **Execute as** to **Me** and **Who has access** to **Anyone**.
9. Deploy and copy the production URL ending in `/exec`.

Do not use the `/dev` test URL in Vercel. It only works for users with access to the Apps Script project.

## Vercel environment variables

In the Vercel project, open **Settings → Environment Variables** and add:

- `APPS_SCRIPT_URL`: the Apps Script deployment URL ending in `/exec`
- `REGISTRATION_SECRET`: the secret printed by `setupRegistration`

Enable both variables for Production, Preview, and Development, then redeploy the project.

An example is provided in [.env.example](.env.example). Never commit the real secret.

## Optional reply-to address

In Apps Script, open **Project Settings → Script Properties** and add `REPLY_TO_EMAIL` if replies should go to a specific monitored inbox. The email sender remains the Google account that owns the Apps Script deployment.

## Local preview

Opening `signup-form.html` directly previews the interface, but registration requires the Vercel Function. Use `vercel dev` with local environment variables to test the complete flow locally.

## Deployment

The root URL rewrites to the registration page. Pushing to the connected GitHub branch triggers a Vercel deployment.
