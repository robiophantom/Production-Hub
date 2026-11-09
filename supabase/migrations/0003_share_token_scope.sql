-- Buyer share links carry an explicit, auditable scope so a link can never be
-- used to reach internal production data. Tokens are stored only as hashes.

alter table public.buyer_share_tokens add column if not exists scope text;
alter table public.buyer_share_tokens add column if not exists label text;

update public.buyer_share_tokens set scope = 'summary' where scope is null;

alter table public.buyer_share_tokens alter column scope set default 'summary';
alter table public.buyer_share_tokens alter column scope set not null;

alter table public.buyer_share_tokens drop constraint if exists buyer_share_tokens_scope_check;
alter table public.buyer_share_tokens
  add constraint buyer_share_tokens_scope_check check (scope in ('summary', 'updates'));

create index if not exists idx_buyer_share_tokens_expiry
  on public.buyer_share_tokens (expires_at);
