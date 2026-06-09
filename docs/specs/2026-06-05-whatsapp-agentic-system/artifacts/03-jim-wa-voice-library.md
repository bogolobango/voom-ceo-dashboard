# Artifact 03 — Jim's WhatsApp voice library

Dropped by Jim 2026-06-05. Authoritative source for every draft Claude (or any future agent) produces on Jim's behalf in WhatsApp.

**Hard rules (apply to every draft, no exceptions):**
- No em-dashes (—) or en-dashes (–). Use commas, periods, or a line break.
- No "weird" emojis. Use only the ones in this file: 👋 🚗 ✅ 🎉 📸 🏷️ 💵 📲 🎁 👍 🙏 👌 ✨
- Plain Anglo-Saxon, 4th-grade reading level. Short sentences.
- URLs as plain text (`www.voomparts.com`, not Markdown links).
- Never invent numbers ("200+ vendors", etc.). Use only canonical figures.

---

## 1. Short canned responses (single-turn)

These are Jim's go-to replies for the common inbound buckets. Use as drop-in defaults; light personalisation if the thread context warrants.

### Generic discovery (sender vague about intent)
```
Plenty you can find out more here www.voomparts.com. Are you looking to buy or sell parts?
```

### Buyer asking generally about VOOM
```
Cool, step 1 search here www.voomparts.com, if you can't find what you're looking for post it on the request board there and vendors will contact you directly.
```

### New vendor first-contact (when they confirm they sell parts)
```
That's great, we have tons of buyers searching for these types of parts. Please create your shop here https://www.voomparts.com/vendor/register

Click the link and follow the 3 steps. I'll approve you as soon it comes in.
```

### Mixed inquiry (could be buyer or vendor)
```
Yeah we're a digital marketplace for auto parts only. You can check us out here www.voomparts.com.

If you're a parts vendor join us and list your parts https://www.voomparts.com/vendor/register 

Are you selling or looking to buy parts?
```

### Buyer asking for a specific part not listed
```
Hello, I don't think we have this specific part listed but please submit on our request board. Vendors will contact you directly https://www.voomparts.com/requests
```

---

## 2. Multi-turn vendor onboarding script

When a NEW_VENDOR thread is mid-flow, place them at the correct step below and reply with the matching message.

### MESSAGE 1 — Auto-greeting (Meta sends this automatically when they tap the FB ad)
```
Akwaaba! 👋 Welcome to VOOM, Ghana's online marketplace for auto parts.

You saw our offer to list your shop free and get customers without leaving your counter. You're in the right place. 🚗

Quick question to get you started: What kind of auto parts do you sell? (e.g. brake pads, filters, body parts, electricals, tyres...)
```
**Trigger:** they just tapped the ad. We do not send this; Meta does.
**State after:** waiting for parts-type reply.

### MESSAGE 2 — They told us what they sell (Jim sends, live)
```
Perfect, [their parts] move fast on VOOM, buyers search for those every day. 👌

I'll set your shop up myself right now, no stress. Just need 3 quick things:

1️⃣ Your shop name
2️⃣ Where your shop is (Abossey Okai? Suame? Tema?)
3️⃣ Your MoMo number for receiving payments
```
**Why this works:** "I'll set it up myself" kills their #1 fear (figuring out a website). Jim does the work, they just answer.
**State after:** waiting for shop name + location + MoMo.

### MESSAGE 3 — Shop details received, list the first part
```
Got it, setting up [Shop Name] now. ✅

Let's list your first part together. Send me:
📸 A photo of one part you sell
🏷️ The name of the part
💵 Your price

I'll put it live on VOOM for you immediately so you can see how it works.
```
**Why this works:** the vendor who watches their part go LIVE in the chat is converted. They have now seen the product work with their own inventory. THIS IS THE WHOLE GAME.
**State after:** waiting for photo + name + price.

### MESSAGE 4 — Part is live, reinforce value
```
Done! 🎉 Your part is now LIVE on VOOM and buyers across Ghana can find it.

Here's your shop link: [shop URL]

You can list up to 20 parts free, the more you list, the more customers find you. Want to add a few more now while I'm here? Just send photos + prices and I'll do the rest. 📲
```
**State after:** open thread, await more listings or scarcity push.

### MESSAGE 5 — Scarcity / featured placement (if they hesitate or go quiet)
```
One more thing 🎁 you're early, so your shop qualifies for free featured placement on our homepage (only the first 100 shops this month).

That means buyers see YOUR shop first. Want me to feature [Shop Name]?
```

---

## 3. Branch responses (objection handlers)

Detect the objection in the inbound message; respond with the matching branch. Keep them concise.

### "Is it really free?"
```
100% free to list up to 20 parts. No charge to join, no monthly fee to start. You only pay nothing to get customers finding you. The featured spot is free too, for early shops. 👍
```

### "How do I get paid?"
```
Buyers pay through MoMo. When someone wants your part, the lead comes to you and you arrange the sale, same as you do now, just with more customers reaching you. I'll walk you through it.
```

### "I'll do it later / I'm busy"
```
No problem 👍 It honestly takes me 2 minutes since I'm doing the setup. Just send me ONE part photo + price whenever you have a free second today, and I'll get your shop live. The free featured spot is first-come this month though, so sooner is better. 🙏
```

### "Where are you / are you legit?"
```
Good question 👌 VOOM is a Ghanaian auto parts marketplace, you can see us at voomparts.com. Shops at Abossey Okai are already getting leads through us. Happy to send you a shop example so you can see it live.
```

### Silent after Message 2 (next-day follow-up, send once)
```
Hi [name] 👋 Still happy to set up your shop free whenever you're ready, takes me 2 minutes. Just send me one part photo + price and I'll put it live so you can see how it works. 🚗
```

---

## 4. Voice notes (Anglo-Saxon, 4th-grade)

Avoid: "leverage", "ecosystem", "platform" (use "marketplace" or "VOOM"), "onboarding" (use "set up"), "value proposition", "monetize", "synergy".

Prefer: "set up", "sell", "buy", "find", "send", "list", "live", "free", "shop", "buyers", "parts".

Avoid Americanisms that don't translate: "kicker", "no-brainer", "win-win". Ghanaian English is the register: "no stress", "I'll come back to you", "tap to message", "send me a photo".

---

## 5. URL canon

| Purpose | URL |
|---|---|
| Home / marketplace | `www.voomparts.com` |
| Vendor signup | `https://www.voomparts.com/vendor/register` |
| Vendor login | `https://www.voomparts.com/vendor/login` |
| Buyer request board | `https://www.voomparts.com/requests` |

Always plain text. WhatsApp auto-detects and previews them.
