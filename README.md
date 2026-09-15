# Agrisetu Web App

A functional front-end prototype for the Agrisetu farmer portal.

## Run in VS Code

1. Open the `Agrisetu_Webapp` folder in VS Code.
2. Make sure these files exist:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `assets/logo.png`
3. Open `index.html` in a browser, or use the VS Code Live Server extension.
4. Click **Login / Get Started**.
5. Choose **Farmer**, enter an email and password, and log in.
6. The app remembers the login in browser `localStorage`, so the returning user can sign in again with the saved account.

## Included till this stage

- Agrisetu landing page and logo
- Farmer login
- Local login persistence
- Farmer dashboard
- Spoilage-risk alert
- Dashboard metrics
- Current stored products
- Storage booking timeline
- Recent activity
- Book Storage multi-step flow
- Cold-storage selection
- Travel/porter selection
- Pickup OTP
- Payment modal
- Payment success screen
- Invoices
- Download invoice demo
- Notifications
- Sidebar sections for My Storage, My Products, Marketplace, Monitoring, Spoilage Alerts, Discounts and Payments

This is a front-end demo. Passwords are stored in localStorage only for the prototype; for a real deployment, use a secure backend/authentication system and never store plaintext passwords in browser storage.


## Current workflow additions

- My Storage shows only products whose storage booking has been accepted.
- Accepted batches expose live prototype readings for PT100 temperature, industrial humidity, NDIR CO2 and camera observations.
- Spoilage predictions are restricted to accepted/stored batches and are tied to the batch ID.
- Discounted products are automatically published to the shared buyer marketplace.
- Buyer marketplace listings are shared across farmer accounts, while farmer listings remain scoped to the logged-in farmer.
- In this front-end prototype, successful checkout records the storage acceptance state locally; replace this transition with the real cold-storage backend acceptance response when the backend API is connected.
