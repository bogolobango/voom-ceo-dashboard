# VOOM CEO Dashboard: Strategic Review & Missing Metrics

As the CEO of a two-sided marketplace in an emerging market (Ghana), your dashboard currently looks like an **operational admin panel** rather than a **strategic CEO cockpit**. 

It does a great job tracking *what* is happening (total vendors, total products, recent orders, WhatsApp taps), but it fails to answer the existential questions a CEO must answer for investors and for survival: *Are we making money on each transaction? Are buyers coming back? How much runway do we have left?*

Based on an analysis of the current codebase and best practices for marketplace startups (like Jiji, Jumia, and global models), here is the strategic review of what is missing and what you need to build next.

---

## 1. The "Existential" Financials (Runway & Burn)

Currently, the `Revenue.tsx` section tracks Gross Merchandise Value (GMV) and Commission. However, for an early-stage African startup, top-line revenue is a vanity metric if it costs too much to acquire.

**What is missing:**
- **Cash Runway & Burn Rate:** You need a clear, bold number showing exactly how many months of cash you have left. In emerging markets, capital can dry up quickly, and knowing your runway is critical [1].
- **Customer Acquisition Cost (CAC) vs. Lifetime Value (LTV):** You are tracking "New Users" and "New Vendors," but not how much it cost to acquire them. A healthy marketplace needs an LTV:CAC ratio of at least 3:1 [2].
- **Unit Economics (Contribution Margin):** Are you actually making a profit on a per-order basis after payment gateway fees (e.g., PawaPay/Mobile Money), SMS API costs, and server costs?

**Recommendation for Claude Code:**
Create a new `FinancialHealth.tsx` section that integrates with your accounting software (or allows manual input of bank balances) to calculate Burn Rate, Runway, and blended CAC.

## 2. Marketplace Liquidity & Match Rate

A two-sided marketplace dies if buyers search for parts and find nothing, or if vendors list parts and get no messages. Your `MorningBriefing.tsx` tracks "Zero Result Searches," which is a great start, but it doesn't track the overall health of the market.

**What is missing:**
- **Search-to-Fill (Match) Rate:** What percentage of searches result in a WhatsApp tap or an order? If 1,000 people search for "Toyota Corolla bumper" and only 50 tap a vendor, your match rate is 5%. This is the true measure of inventory quality [3].
- **Vendor Utilization Rate:** What percentage of your approved vendors have received at least one lead in the last 30 days? If 80% of your leads go to the top 5% of vendors, the rest will churn.
- **Time-to-First-Lead:** How long does it take a newly onboarded vendor to get their first WhatsApp message? If this is longer than 48 hours, they will likely abandon the platform.

**Recommendation for Claude Code:**
Enhance the `Analytics.tsx` section to include a "Liquidity Matrix" that plots Vendor Utilization against Buyer Match Rate.

## 3. Cohort Retention (The "Leaky Bucket" Check)

Your `Growth.tsx` section shows cumulative growth (total users over time). Cumulative charts always go up and to the right, masking underlying churn.

**What is missing:**
- **Buyer Cohort Retention:** Of the buyers who made a purchase or tapped a WhatsApp link in January, what percentage returned to do it again in February? [4]
- **Vendor Churn Rate:** How many vendors who were active 30 days ago have stopped logging in or updating their inventory?
- **GMV Retention:** Are your retained cohorts spending more over time? [5]

**Recommendation for Claude Code:**
Replace the cumulative growth charts with a classic Cohort Retention Heatmap (a triangular grid showing Month 1, Month 2, Month 3 retention percentages).

## 4. The "Take Rate" Reality

You are tracking "Total Commission," but the critical metric for marketplace valuation is the Take Rate (Commission / GMV) [6]. 

**What is missing:**
- **Effective Take Rate:** If your standard commission is 5%, but you offer discounts, free tiers, or fail to collect on some orders, your *effective* take rate might be 2%. You need to see this percentage clearly.
- **Take Rate by Category:** Do engines yield a higher take rate than brake pads? You need to know where to focus your marketing spend.

**Recommendation for Claude Code:**
Add a dedicated "Take Rate" KPI card to the `Revenue.tsx` section, tracking the blended percentage and highlighting any downward trends.

## 5. Vendor Quality vs. Quantity

The `VendorCRM.tsx` tracks the funnel from "Not Contacted" to "Paid." However, it treats all vendors equally. In auto parts, a vendor with 500 genuine OEM parts is worth 50 vendors selling generic wiper blades.

**What is missing:**
- **Inventory Value (IGV):** What is the total retail value of all products listed by a vendor?
- **Listing Quality Score:** Are vendors uploading photos, OEM part numbers, and accurate vehicle compatibility? A high quantity of low-quality listings hurts the buyer experience.

**Recommendation for Claude Code:**
Add a "Vendor Quality Index" to the `Vendors.tsx` table, scoring vendors based on listing completeness and response times.

---

## Summary of Action Items for the Next Sprint

If I were the CEO, I would pause building new operational features (like the WhatsApp bot) for one sprint and instruct the engineering team to build the **"CEO Survival View"**:

1. **Runway & Burn Widget:** Front and center on the `Overview.tsx`.
2. **Cohort Retention Heatmap:** Added to `Growth.tsx`.
3. **Liquidity/Match Rate KPI:** Added to `MorningBriefing.tsx`.
4. **Effective Take Rate Tracker:** Added to `Revenue.tsx`.

These are the numbers that will tell you if VOOM is actually a viable business, or just a busy website.

---

### References
[1] Epoch Ventures. "Cash Burn vs. Runway: The Real Metrics Investors Care About."
[2] Startup Daily. "The key metrics to measure when building a two-sided marketplace."
[3] Everything Marketplaces. "The Guide to Early-Stage Marketplace KPIs."
[4] Lenny's Newsletter. "The most important marketplace metrics to track."
[5] Andreessen Horowitz (a16z). "GMV Retention: The Marketplace Metric Most Ignore."
[6] Stripe. "Marketplace metrics: 14 key metrics to watch."
