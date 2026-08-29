-- A draft needs to carry what Slack will actually render.
--
-- The gate stored `action.text`, which is Slack's notification preview and is
-- clipped to 200 characters by fallback(). The real message is in `blocks`. So
-- the queue held a truncated string, an admin approved a truncated string, and
-- a new hire received a sentence that stopped mid-word.
--
-- `body` stays the readable version an admin reads and may edit. `blocks` is
-- what gets posted when nothing was edited: Block Kit formatting is the
-- difference between a task card and a wall of text, and losing it on every
-- approved message would make review the worse path.
--
-- Run once in the Supabase SQL editor. Idempotent.
alter table public.drafts
  add column if not exists blocks jsonb;
