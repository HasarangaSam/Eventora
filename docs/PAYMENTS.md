# PayHere Checkout and Payment Notifications

Eventora uses PayHere Checkout API with hosted redirect checkout. Merchant credentials stay in `backend/.env`; the browser receives only the checkout URL and form fields generated from a database-owned registration, ticket price, currency, and payment attempt. Checkout requests accept customer contact details because Eventora does not persist a phone or address. Eventora does not store card data.

## Backend settings

Copy these keys from `backend/.env.example` into `backend/.env` and supply the merchant values from PayHere:

```dotenv
PAYHERE_MERCHANT_ID=
PAYHERE_MERCHANT_SECRET=
PAYHERE_ENVIRONMENT=sandbox
PAYHERE_NOTIFY_URL=https://<current-ngrok-host>/api/webhooks/payhere/notify
PAYHERE_RETURN_URL=http://localhost:5173/checkout/result
PAYHERE_CANCEL_URL=http://localhost:5173/checkout/cancelled
```

The merchant secret is specific to the domain/app approved in the PayHere merchant portal. Use the matching sandbox merchant credentials for local testing. For production, set `PAYHERE_ENVIRONMENT=live`, use production return/cancel URLs, and set `PAYHERE_NOTIFY_URL` to the public HTTPS deployment URL. Do not expose or commit merchant credentials.

The attendee page sends contact details to `POST /api/payments/:registrationId/checkout`. The server returns a hosted checkout URL, method, and signed form fields. The frontend posts that form to PayHere. Each checkout attempt is associated with one unique `PaymentAttempt.merchantReference`; repeated requests reuse the active attempt, while a failed attempt can be retried with a new reference during the reservation window.

## Notification verification and state changes

PayHere posts `application/x-www-form-urlencoded` fields to `POST /api/webhooks/payhere/notify`. Eventora verifies `md5sig` using the configured merchant secret and a constant-time comparison before looking up or changing payment state. The checksum covers merchant ID, order ID, amount, currency, status code, and the uppercase MD5 of the merchant secret. The official checksum does not cover `payment_id`; Eventora treats that value as a provider reference for duplicate detection and audit only, never as proof of success.

After signature verification, the handler checks merchant identity, merchant reference, amount, currency, and supported PayHere status. It serializes payment processing against reservation expiry and cancellation using the event, ticket-type, and reservation row locks. A success commits inventory and confirms the registration only if the hold remains valid or current capacity can fulfill a late success. Otherwise, Eventora records the verified success and a `PaymentException` without issuing a ticket or changing sold inventory. Duplicate notifications do not commit inventory twice. A chargeback is recorded as `CHARGEDBACK` with an exception; Eventora does not automatically refund, void tickets, or reverse inventory.

The browser return and cancel URLs contain only the registration reference. The result page reads the status from Eventora's authenticated API. Redirects never confirm payments. Digital ticket issuance and purchase email are tracked in Phase 9 and will consume only confirmed registrations.

## Local notification testing

1. Start the backend on port 3000 and the frontend on port 5173.
2. Run `ngrok http 3000` and copy its current HTTPS forwarding URL.
3. Set `PAYHERE_NOTIFY_URL` to `<ngrok-url>/api/webhooks/payhere/notify`.
4. Set the merchant portal's approved sandbox domain/app and use its sandbox merchant ID and merchant secret.
5. Restart the backend after changing `.env`, create an event with an LKR or USD paid ticket, and begin checkout from the event page.
6. Complete a sandbox payment. The PayHere notification must reach the public ngrok URL; inspect registration/payment status in Eventora, not URL parameters from the browser redirect.

PayHere does not post notification results to `localhost`, and its browser return does not contain payment status. Recreate or update the notify URL whenever the ngrok hostname changes. Never fabricate a success callback using production secrets.

## Current limits

- PayHere checkout accepts LKR and USD ticket currencies; other configured currencies are rejected before checkout.
- An unfulfillable valid success remains recorded as a successful provider payment plus a payment exception for administrator review. No automated refund or admin resolution action is defined here.
- Live/sandbox provider verification requires merchant credentials and a reachable public notify URL. Unit and database integration tests do not replace that external sandbox check.
