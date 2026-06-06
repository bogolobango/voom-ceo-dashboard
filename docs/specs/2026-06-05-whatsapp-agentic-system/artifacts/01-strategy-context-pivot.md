# Artifact 01 — Strategy context: request-driven marketplace pivot

Dropped by Jim 2026-06-05. Source: claude.ai chat 925981b7-52c9-4218-9fe7-b9302b7673f1. This is the *response* from the other chat (not the underlying spec doc itself — that may be a later artifact). It frames the strategic reframe Jim is building toward.

---

Got it — that's a critical clarification. Vendors are already operating *inside* VOOM's group chat. The WhatsApp-group muscle memory is happening *on your platform*, which is actually good news — you don't have to migrate behavior, you have to formalize and monetize what's already happening. And buyer requests are flowing in two channels (direct to you, and into the parts request channel), which means the demand-side primitive already exists.

This changes the spec meaningfully. Let me write it now.

Got it. Markdown will be better than docx for an agent CTO — easier to parse, easier to commit to the repo, easier to iterate on. Let me write the full spec.

Spec is ready. A few notes on the strategic choices I made writing it, so you know what to push back on with your CTO:

**The biggest reframe in this spec**

The headline shift is treating VOOM as a **request-driven marketplace with chat-based fulfillment**, not a catalog-driven marketplace with listing-based discovery. That matches your actual observed behavior — vendors stop at 20 listings because listings aren't where value comes from for them. Value comes from chat conversations and direct requests. The spec monetizes *that*, not catalog completeness.

If your CTO pushes back on this framing, that's the conversation to have first. Everything downstream depends on agreeing this is the right product model.

**The mechanic I'd ship first if forced to pick one**

Request routing by tier (section 4.1). It directly touches the metric vendors care about most — buyer inquiries — and it's the cleanest demonstration of paid-tier value. Build it first, measure the conversion lift, then layer the others on. The spec sequences five phases over 14 weeks, but if engineering capacity is constrained, request routing alone might move the needle enough to justify the rest.

**The mechanic most likely to backfire**

Response rate limits on Free tier (section 4.3). It's the most coercive, the most likely to generate vendor anger, and the hardest to roll back if it tanks retention. I included it because it's effective, but it's the one I'd ship last and ship carefully, with at least 30 days of notice and a clear upgrade path inside the cap-hit moment.

**The investor angle in section 8, question 10**

Worth reading carefully. This spec, executed well, gives you a clean "product-led growth marketplace with tier-based request routing and chat-native transaction flow" story for Ingressive and Renew Venture Lab. That's a stronger narrative than "we charge subscriptions for listings." Confirm internally you want to commit to that framing before locking in the architecture, because the architectural choices reflect the story.
