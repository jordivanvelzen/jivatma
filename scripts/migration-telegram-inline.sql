-- Adds column so we can edit the original notification message when the admin
-- taps Approve/Decline inline in Telegram.
ALTER TABLE pass_requests ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;
