# App Store listing copy

Text for App Store Connect, with the field limits that apply. The wording describes Tapped as a summary of public EPA compliance records. It never calls water "safe" or implies a recent test (see App Review guideline 1.4 and [METHODOLOGY.md](METHODOLOGY.md)).

## Name (30 characters)

```
Tapped
```

If the name is unavailable, use `Tapped: Water Records` (21 characters).

## Subtitle (30 characters)

```
Tap water records near you
```

## Promotional text (170 characters; can be changed without a new release)

```
See at a glance whether EPA records show recent or open health-based violations for the water system serving your location.
```

## Description (4,000 characters)

```
Tapped tells you, at a glance, what public EPA records say about the tap water where you are.

Tap Locate, or type a ZIP code. Tapped finds the water system for the area and shows a clear result:

• Green: no health-based violations began in the last 12 months of EPA data, and none are open.
• Yellow: a recent health-based violation, a long-running one that is still open, or repeated paperwork violations.
• Red: an urgent health-based violation, such as bacteria, nitrate, or a treatment failure, is open.

Every result includes a short plain-language summary, the name of the water system, how many people it serves, and a link to its public record so you can read the source yourself.

Built for travelers and the curious:
• One tap. No account, no sign-up.
• Works with your approximate location, or a ZIP code you type.
• If no system is registered to a ZIP code, Tapped shows the main system for the city or the nearest ZIP code, and tells you so.
• Clear statement of how current the data is.

Private by design:
• Your location is converted to a ZIP code on your device. Only the five-digit ZIP code is sent to look up records.
• No ads, no analytics, no tracking.

Important: Tapped summarizes public regulatory records. It is not a water test, does not guarantee that water is safe to drink, and is not a substitute for advice from your local water utility or a medical professional. Records can lag behind current conditions, and a water system's registered address is not always the area it serves.

Data: US EPA drinking-water compliance records, via WaterViolations.org. Place data: GeoNames.
```

## Keywords (100 characters, comma-separated, no spaces)

```
tap water,drinking water,water quality,EPA,violations,contaminants,utility,travel,lead,records
```

## Category

- Primary: **Utilities**
- Secondary: **Travel**

Health & Fitness is deliberately avoided: it invites closer health-claim review, and Tapped reports regulatory records, not health advice.

## URLs

- Support URL: `https://easternlabs.app/tapped`
- Privacy policy URL: `https://easternlabs.app/tapped/privacy`
- Marketing URL: leave blank (or `https://easternlabs.app/tapped`)

## Copyright

```
2026 EasternLabs
```

## Age rating questionnaire

Answer "None" or "No" to every content question (no violence, no mature themes, no gambling, no user-generated content, no web browsing, no unrestricted web access). Expected rating: **4+**. For "Medical or health information", answer that the app does not provide medical or treatment advice: it summarizes public regulatory records.

## App Privacy ("nutrition label")

- Data collected: **Coarse Location** (the ZIP code).
- Purpose: **App Functionality**.
- Linked to the user's identity: **No**.
- Used for tracking: **No**.
- No other data types.

## App Review notes

```
Tapped needs no sign-in. To test:
1. Tap "Locate" and allow location access, or type a ZIP code such as 21231 (Baltimore, MD) or 60601 (Chicago, IL) and tap the arrow.
2. The app shows a green, yellow, or red result, a plain-language summary, the water system, and a link to its public EPA record.

The app summarizes public EPA drinking-water compliance records. It does not perform water tests and states in each result that it is not a guarantee of safety. Location is used once, on the device, to find a ZIP code; only the ZIP code is sent to our API (hosted on Cloudflare Workers). Privacy policy: https://easternlabs.app/tapped/privacy. Contact: support@easternlabs.app.
```

## What's New (first release)

```
First release.
```

## Screenshot plan

Capture on a 6.9-inch iPhone (iPhone 17 Pro Max) and one 6.5-inch size if requested by App Store Connect:

1. Idle screen: the Locate orb ("Tap to see the water records around you").
2. A green result with the summary and water system.
3. A yellow result, showing that Tapped reports reasons, not just colors.
4. A typed ZIP code lookup with the keyboard dismissed.
5. The About screen (data sources and privacy).
