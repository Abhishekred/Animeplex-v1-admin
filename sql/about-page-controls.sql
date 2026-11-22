-- Add public About settings to the existing, RLS-protected config.
-- Existing table-level SELECT/UPDATE grants and policies protect both fields.
alter table public.animeplex_update_config
  add column if not exists about_website_url text not null default 'https://Abhishek.dpdns.org/',
  add column if not exists about_instagram_handle text not null default 'animeplexofficial';
