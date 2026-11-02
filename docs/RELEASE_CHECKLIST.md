# Public release checklist (App Store)

Items required or strongly advised before submitting Tapped for public distribution.

## Accounts and cost

- [ ] **Apple Developer Program membership** (US$99 per year). Required for TestFlight and App Store distribution; the only unavoidable fixed cost.
- [ ] Cloudflare Workers free plan is sufficient at current design limits; review request volume after launch.

## Backend

- [ ] API deployed and verified (see [DEPLOYMENT.md](DEPLOYMENT.md)); production URL set in `ios/Tapped/Config.swift`.
- [ ] Release build confirmed to use HTTPS only; the local-networking exception in the Info.plist is acceptable for debug use but should be reviewed for release.
- [ ] Automated quarterly or monthly data refresh configured (optional; see the operations notes).

## Application

- [ ] App icon and launch presentation.
- [x] Credits screen with the required attributions (WaterViolations.org / EPA, GeoNames CC BY 4.0): About screen, info button on the main screen.
- [x] Hosted privacy policy URL linked from the About screen (https://easternlabs.app/tapped/privacy, published from the landing-page repository).
- [ ] In-app statement of the data's nature and end date (present in each result) and the disclaimer (present).
- [ ] Accessibility pass: Dynamic Type at the largest sizes, VoiceOver, Reduce Motion, small-screen devices.
- [ ] Verification of all states on device: permission denied, location unavailable, non-US location, offline, API error.
- [ ] Bundle identifier, version, and build number finalized.

## App Store Connect

- [ ] Unique app name confirmed available (the working name is "Tapped").
- [ ] **Privacy policy URL** (required): publish [PRIVACY_POLICY.md](PRIVACY_POLICY.md) at a public web address. The policy states that the app uses approximate location on the device to derive a ZIP code, sends only the ZIP code to the project API, collects no account data, and uses no third-party analytics.
- [ ] App Privacy ("nutrition label") answers consistent with the policy: Data collected = **Coarse Location** (the ZIP code), purpose **App Functionality**, **not linked** to the user's identity, **not used for tracking**; no other data types. Policy text: [PRIVACY_POLICY.md](PRIVACY_POLICY.md).
- [x] Support URL (https://easternlabs.app/tapped) and contact email (support@easternlabs.app).
- [ ] Description and screenshots (copy drafted in [APP_STORE_LISTING.md](APP_STORE_LISTING.md); screenshots pending) that describe the app as a summary of EPA compliance records, not a water test or safety guarantee. Review guideline 1.4 (physical harm) makes accurate framing important for any app that informs health decisions.
- [ ] Age rating questionnaire; category (for example, Utilities or Health & Fitness).

## Courtesy and compliance

- [ ] Notify WaterViolations.org that the project builds on its data and link back to it (requested, not required).
- [ ] Confirm the repository license and attribution files are accurate for the published code and datasets.
