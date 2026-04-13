# MyClubLocator — New User Signup Flow

## Exact Steps

### 1. User signs up on /login (Create Account tab)
- Fills email + password
- Privacy policy checkbox is pre-checked
- Clicks "Create my free account"
- Supabase creates the user (unconfirmed)
- `user_terms_acceptance` row inserted
- `new_signup` notification created for admin
- **Supabase sends branded confirmation email** (template in `email-templates/confirm-signup.html`)
- User sees **"Check your email"** screen with:
  - Envelope icon
  - Their email address bolded
  - Instructions to click the confirmation link
  - "Resend it" link if needed
  - "I've confirmed — Sign in" button

### 2. User clicks confirmation link in email
- Link format: `https://myclublocator.com/login?confirmed=1#access_token=...`
- Supabase auto-signs in the user via URL hash tokens
- AuthPage detects `?confirmed=1` param
- Checks for active session (should exist from auto-sign-in)
- Shows **"Welcome to My Club Locator!"** screen with:
  - Green checkmark icon
  - "Your email is confirmed and your account is active."
  - Spinning loader
  - Auto-redirects to `/onboarding` after 3 seconds

### 3. Onboarding survey
- User completes the onboarding questions
- `onboarding_done` is set to true in `user_terms_acceptance`
- After completion, navigates to profile setup

### 4. Subsequent logins
- User signs in with email + password
- `onboarding_done` is true → skip onboarding
- Shows appropriate welcome message:
  - **No profile**: "Welcome back! Your club profile isn't set up yet."
  - **Pending approval**: "Welcome back! [Club] is pending approval."
  - **Approved**: "Welcome back, [Name]!" → auto-redirect to map

---

## Supabase Email Template Setup

1. Go to **Supabase Dashboard → Authentication → Email Templates**
2. Click **"Confirm signup"**
3. Set **Subject**: `Confirm your email — My Club Locator`
4. Paste contents of `email-templates/confirm-signup.html` into **Body**
5. Ensure **Confirm email** toggle is ON in Auth → Settings → Email
6. Click **Save**

---

## Key Files
- `src/pages/AuthPage.jsx` — unified login/signup with all flow states
- `email-templates/confirm-signup.html` — branded email HTML for Supabase
- `src/pages/OnboardingPage.jsx` — post-confirmation onboarding survey
