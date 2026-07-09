# 🎬 SunPath demo video — script & shot list

**Target:** ~2:50 · screen recording + voiceover · public link required by the rubric.
**URL:** https://sunpath-beige.vercel.app (fall back to `localhost:3000` if prod is throttled).

## Before you record

- [ ] Model quota is fresh (record early in the day). If Gemini throttles mid-take, the app fails over to Groq automatically — a retry is never a broken demo.
- [ ] `/results` shows the measured numbers (run the eval first) — it's the closing shot.
- [ ] Browser window ~1280–1536 px wide, 100% zoom, bookmarks bar hidden, notifications off.
- [ ] Mic check. Speak ~5% slower than feels natural. Record each beat separately; cut between beats.

## Beat sheet

| # | Time | On screen | Voiceover |
|---|------|-----------|-----------|
| 1 | 0:00–0:12 | Homepage. Don't move the cursor — let the starfield and sun breathe. | "Solar companies don't lose deals because of panels. They lose them in the funnel — unqualified leads, unanswered objections, a booking that never happens. Most chatbots answer questions. They don't sell." |
| 2 | 0:12–0:25 | Slow hover across the suggestion chips, then click into the composer. | "This is Sunny — SunPath Solar's AI sales rep. Not a wrapper around an FAQ: an agent with six real tools — scoring, sizing, incentives, quoting, booking, CRM." |
| 3 | 0:25–0:55 | Type input ①, send. The score gauge streams in, then the system card; the funnel rail advances Qualify → Design. | "One plain-English sentence. Watch the agent work: it qualifies the lead — then sizes a real system from a real catalog. Every number on screen came from a tool call, not the model's imagination. The rail at the top is the sale, advancing." |
| 4 | 0:55–1:15 | Type input ②, send. Grounded roof rebuttal streams. | "Objections get answered from an approved playbook — flashing, sealing, workmanship warranty — never improvised. High-ticket sales die on made-up claims, so this agent structurally can't make them." |
| 5 | 1:15–1:45 | Type input ③, send. The quote card assembles line by line; hold on the 25-year savings as it counts up. | "The quote builds itself — gross price, federal credit, state incentive, net cost, monthly payment. And the number that closes deals: twenty-five-year savings, counted up live. This is generative UI — the agent renders its own actions." |
| 6 | 1:45–2:05 | Type input ④, send. Booking card ✓ fires its ring; CRM log line appears; rail hits Book. | "Name, contact, booked — and logged to CRM. That's the conversion, end to end, in one conversation." |
| 7 | 2:05–2:25 | Refresh to a fresh chat. Type input ⑤, send. Sunny declines politely. | "And when someone isn't a fit — a renter — Sunny says so and doesn't push. Honesty here is scored, not hoped for." |
| 8 | 2:25–2:50 | Click "conversion eval" in the footer. Slow scroll: lift number → the two arms → per-lead dots. | "Scored how? A controlled A/B: sixteen simulated homeowners, same model, same decision protocol — the only variable is the rep. Sunny versus a plain FAQ bot. The lift on screen is measured, not promised." |
| 9 | 2:50–3:00 | Back to the homepage; cursor comes to rest near the sun. | "SunPath Sunny — Next-generation stack, six tools, one number that matters. Thanks for watching." |

## Inputs to paste (in order)

1. `I own my home in Sacramento CA, my bill is about $260 a month, and I'd like solar this year.`
2. `Won't drilling wreck my roof?`
3. `OK — give me a quote with the $0-down loan.`
4. `Book it. I'm Maria, maria@example.com — Saturday morning works.`
5. *(fresh chat)* `I rent an apartment but I want solar — what are my options?`

## If something hiccups

- **Model throttled mid-take:** the failover answers from the backup provider automatically; if a turn still errors, the friendly retry message *is* the reliability story — mention it or just re-take the beat.
- **A tool card renders before you finish narrating:** pause typing between beats; the agent only acts on send.
- **Keep beats as separate clips** — 3, 5, and 7 are the ones worth a second take.
