-- Tabela przechowuje hashe zaimportowanych transakcji MT940.
-- Zapobiega podwójnemu zaksięgowaniu tej samej transakcji.
create table if not exists mt940_imported_transactions (
  id           uuid primary key default gen_random_uuid(),
  tx_hash      text not null,
  community_id uuid not null references communities(id) on delete cascade,
  imported_at  timestamptz not null default now(),
  imported_by  uuid references auth.users(id),
  meta         jsonb,
  constraint mt940_imported_transactions_hash_community_key unique (tx_hash, community_id)
);

-- RLS — tylko admin/super_admin swojej wspólnoty czyta i pisze
alter table mt940_imported_transactions enable row level security;

create policy "admin read mt940 hashes"
  on mt940_imported_transactions for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'admin')
        and (p.role = 'super_admin' or p.community_id = mt940_imported_transactions.community_id)
    )
  );

create policy "admin insert mt940 hashes"
  on mt940_imported_transactions for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'admin')
        and (p.role = 'super_admin' or p.community_id = mt940_imported_transactions.community_id)
    )
  );
