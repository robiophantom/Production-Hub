alter table public.production_issues
  add column if not exists voice_translation text;
