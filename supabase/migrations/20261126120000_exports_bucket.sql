-- Step 1.11: "Download my data" builds a ZIP on the server and stores it here for a short time:
--   exports/<user_id>/<timestamp>.zip     private; the user gets a 10-minute download link
-- No storage policies: only the server (secret key) reads or writes this bucket. Old exports are
-- removed when a new one is made, by the daily sweep, and when the account is deleted.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('exports', 'exports', false, 209715200, array['application/zip'])
on conflict (id) do nothing;
