# Artifact 02 — Diagnosis + leverage mechanics workshop

Dropped by Jim 2026-06-05. Source: claude.ai chat 925981b7. This is the deeper diagnostic/strategy reasoning that sits *behind* the spec.

---

Let me make sure I have the picture right before workshopping, because the diagnosis matters more than the strategy here.

**What I'm hearing:**

1. Free vendors stop listing at or near 20 products. Most never push past that threshold.
2. Vendors are still transacting in WhatsApp groups — the old behavior — rather than fully migrating to VOOM as their inventory and lead channel.
3. The conversion from Free to paid is the real bottleneck.
4. Behaviorally, vendors are using VOOM as a *supplement* to their WhatsApp group activity, not a *replacement* for it.

Tell me if that's right before I go too deep — but I'll proceed assuming it is, because there's enough to work with even if I'm slightly off.

**The hard truth you need to hear first**

The problem isn't pricing strategy. The problem is that VOOM is currently a *better business card* for vendors, not a *better business*. They list 20 products to have a digital presence, then they go back to WhatsApp groups because that's where the actual money happens.

If you skip past this diagnosis and jump straight to "how do we force the paid conversion," you'll build a coercion mechanic that converts a few vendors short-term and burns the rest. The real question is: *why isn't VOOM the better channel for them yet*, and *what would have to be true for paying to be a no-brainer*. Pricing strategy comes after that question is answered, not before.

Let me workshop both angles — the diagnostic angle (what's actually broken) and the leverage angle (assuming the product gets fixed, what mechanics force conversion). Then you decide which lever to pull first.

---

## PART 1: Diagnosing why vendors stop at 20 and stay in WhatsApp groups

The 20-listing ceiling isn't arbitrary behavior. It's a signal. Three possible causes, each requiring different fixes.

**Cause A — Listing friction is too high.** If listing a product on VOOM takes more than 60 seconds per item, vendors will list their 20 fastest-moving SKUs and stop. WhatsApp group posting is instant: take a photo, paste it in the group, type "Toyota brake pad GH¢200," done. If VOOM requires categorization, fitment specs, photo upload, price entry, description — vendors quit at 20 because the marginal time per listing exceeds the perceived marginal return.

How to test: ask 5 vendors directly, "what stops you from listing your 21st product?" The answer will tell you within one conversation. If they say "it takes too long" — fix the listing flow before touching pricing.

**Cause B — Lead quality from VOOM isn't beating WhatsApp groups.** In a WhatsApp parts group, when a buyer posts "looking for Honda Civic 2010 headlight," the vendor sees the message instantly, knows the buyer is *actively shopping right now*, and can respond in 30 seconds with a photo and price. The buyer is hot.

VOOM leads, by contrast, may feel colder — a tap from a buyer browsing, possibly comparison-shopping, possibly not even ready to buy. If a vendor's experience is "WhatsApp group = 1 in 3 leads converts to sale, VOOM = 1 in 10 leads converts to sale," they'll list 20 products on VOOM as a marketing presence and pour their actual effort into the groups.

How to test: ask 5 vendors what their close rate is on VOOM inquiries versus WhatsApp group inquiries. If the gap is large, you have a lead quality problem and no amount of pricing pressure will fix it.

**Cause C — The vendor doesn't trust the 20-listing cap to be enforced.** If vendors believe they can keep operating freely on 20 listings forever, they have no urgency to upgrade. They list their 20 best, get whatever leads come, and treat VOOM as free marketing alongside their WhatsApp group business. Why would they pay GH¢200/month for what they're getting for free?

This is the failure mode most likely to be true *right now* given what you've described. The 20-listing ceiling exists in policy but doesn't bite hard enough to force a decision.

**My honest read:** all three are probably true to some degree, but Cause C is the one you have most control over fixing this week, Cause A is the second-easiest, and Cause B is the hardest because it requires real demand-side traffic growth.

---

## PART 2: Stress-testing leverage mechanics to force conversion

Now the actual question you asked. Assuming the product is good enough that a vendor *would* benefit from paying, what mechanics force them to make the decision instead of drifting on free forever? Here are six options, ranked from most coercive to least.

**Mechanic 1 — Hard listing cap with delisting at 21.** Vendor can list 20 products. 21st attempt blocked. Must delete an existing or upgrade. Necessary as foundation, not sufficient alone.

**Mechanic 2 — Time-limited free trial.** All Free vendors get 90 days of full Pro features, then drop to Free unless they upgrade. Strongest single mechanic.

**Mechanic 3 — Free tier becomes meaningfully degraded.** Free vendors rank below paid in search. "Free Vendor" badge. No homepage placement. No buyer analytics. Right long-term mechanic — compounds best.

**Mechanic 4 — Lead routing favors paid vendors.** Pro/Business WhatsApp tap CTAs prominent; Free CTAs gated behind extra tap. Powerful but must be tuned — don't ship the crude version.

**Mechanic 5 — Listing expiration on Free tier.** Free listings expire after 30 days, manually renewed one-by-one. Paid stays live indefinitely. Flips the effort math.

**Mechanic 6 — Verification gating.** Verified badge only for paid tiers. Free = "Unverified Vendor". Strong in Ghana because trust concern is real.

---

## PART 3: The recommended combination

Stack three to five mechanics. The shipping combination:

- **Foundation (M1):** Hard 20-listing cap. Stays.
- **Forcing function (M2):** 90-day full-feature trial. Existing vendors past 90 days get 30-day warning window.
- **Market enforcement (M3):** Free ranks below paid. "Free Vendor" badge. No homepage. No analytics dashboard.
- **Trust gating (M6):** Verified badge paid-only. Free displays as "Unverified Vendor".
- **Listing freshness (M5):** Free listings expire 30 days, manual renewal.

After 90 days, staying Free means: last in search, Unverified, no analytics, re-listing 20 every month, capped at 20. Decision flips from "why pay?" to "why stay Free?"

---

## PART 4: The behavior change problem (WhatsApp groups)

Pricing levers alone won't pull vendors off WhatsApp groups. VOOM has to feel like a *better WhatsApp group*, not a different kind of platform.

**Move 1 — Real-time buyer demand feed.** Paid vendors see live buyer searches (category, region, term) for the last hour. "5 buyers searched for 'Honda Civic 2014 headlight' in Accra. You have this. Tap to message." Recreates the WhatsApp group dynamic, platform-mediated. Free vendors don't see this.

**Move 2 — Buyer broadcast feature.** Buyers post "looking for X" requests into the platform. Only paid vendors get pinged. Buyer gets multiple WhatsApp-tap quotes; vendor gets warm intent leads. Directly replicates WhatsApp group dynamic gated behind paid.

**Move 3 — The exit-WhatsApp-group narrative.** Pitch becomes: "Stop wasting 4 hours/day scrolling 15 WhatsApp groups. VOOM brings buyers to you, pre-filtered, ready to buy." Frame the sale around time saved, not features added.

Moves 1 and 2 are product work, not pricing. Without them, pricing leverage converts some vendors but won't change underlying behavior.

---

## PART 5: Honest investor framing

Bad: "We're forcing free vendors to pay by degrading their experience."

Good: "We've built a 90-day free trial that lets vendors prove the platform's value with full features. After the trial, vendors who've experienced real lead flow self-select into paid tiers. The combination of a hard listing cap, search ranking by tier, and live buyer demand feeds for paid vendors creates a virtuous cycle where paid vendors capture disproportionate lead volume, which strengthens the case for upgrading among the rest of the cohort."

Same mechanics. Product-led growth narrative.

---

## One concrete next step this week

Sequence, don't ship all at once.

- **Week 1:** M6 (verification gating) + M3 partial (Free Vendor badge). Frame as "platform update for buyer trust." No coercion language.
- **Weeks 2-3:** M2 (90-day trial). Existing vendors framed as "upgrading all vendors to 90-day full-feature trial."
- **Weeks 4-6:** First cohort hits day 90 → M1 (hard cap enforcement) + M3 full (search ranking). Decision moment with full information.
- **Week 7+:** M5 (listing expiration) activates for vendors who stayed Free past day 90.

Clean data for the investor deck: trial-to-paid conversion at day 90, conversion after ranking changes.
