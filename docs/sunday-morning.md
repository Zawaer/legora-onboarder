# Sunday morning. Deadline 10:00 sharp, late = out.

## 1. Restart what sleep killed (2 min)

Both processes die when the laptop sleeps. From the repo root, two terminals:

    npm run dev
    node scripts/slack-bot.mjs

Then check everything is warm before you record:

    curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/manager

Expect 200. If a page is slow the first time, that is Next compiling, not a bug.
Load /, /hire/demo-legal-engineer, /manager and /app once each so nothing
compiles while you are recording.

## 2. Record (45 min, script in docs/demo-script-90s.txt)

State as you left it:
  - Your hire is "Toivo", Legal Engineer, ZERO open blockers, so the Nordkap
    question escalates live instead of deduping.
  - auto_send = true, so beats 1-3 run without approval interrupting the take.
  - Both roles cached. Never derive a new role on camera: cold is 3 minutes.

Beats 1-3 in your own Slack DM, then /manager.
For beat 4, flip the gate (ask Claude, or set auto_send=false on Testgroup),
send one message, approve it in /app, watch it land.

Record each beat separately and stitch. One continuous take at 7am is how you
end up doing eleven of them.

## 3. Submit (30 min)

  Track            : AI Agents
  Live product     : https://vanav.io
  Demo video       : set the link so ANYONE can view. Check it in a private window.
  Proof files      : screenshots of the 3 signed LOIs (up to 8 files)

Traction answer, and every word of this is checkable:
  - 3 signed letters of intent
  - Deloitte and Google Cloud have each agreed to a conversation next week
  - 32 questions resolved without interrupting a colleague (/api/resolutions)
  - 16 drafts through the human review gate
  DO NOT say "customers", "partnered with", or "pilots". You have none of those.

## 4. The LinkedIn post. 20 EXTRA POINTS. Do not skip this. (15 min)

Worth four times the entire originality category and it takes ten minutes.
Post on LinkedIn, tag BOTH hosts, thank Plue, Prelint, Aqua Voice and Linkup.
Paste the link into the form, one per line.

Two more cash prizes for separate posts: tag Freebuff, tag Linkup.

## Order if you run late

Video and form first (without them you score nothing), then LinkedIn, then
proof files. Submit early and resubmit: the LAST version before 10:00 is judged,
so get a complete submission in at 09:00 and improve it after.
