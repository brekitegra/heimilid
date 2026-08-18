-- Deleting an account (auth.users row) cascades to its profiles row. Every
-- domain table's created_by FK had no ON DELETE behavior (defaults to
-- RESTRICT), which would block that deletion entirely the moment someone
-- who'd ever created a chore/pet/bill/etc. tried to delete their account.
-- Switch to SET NULL — the record and the rest of the household's data
-- stays intact, it just loses its "created by" attribution.
alter table public.households alter column created_by drop not null;
alter table public.households drop constraint households_created_by_fkey;
alter table public.households add constraint households_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.chores alter column created_by drop not null;
alter table public.chores drop constraint chores_created_by_fkey;
alter table public.chores add constraint chores_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.pets alter column created_by drop not null;
alter table public.pets drop constraint pets_created_by_fkey;
alter table public.pets add constraint pets_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.finance_accounts alter column created_by drop not null;
alter table public.finance_accounts drop constraint finance_accounts_created_by_fkey;
alter table public.finance_accounts add constraint finance_accounts_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.bills alter column created_by drop not null;
alter table public.bills drop constraint bills_created_by_fkey;
alter table public.bills add constraint bills_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.children alter column created_by drop not null;
alter table public.children drop constraint children_created_by_fkey;
alter table public.children add constraint children_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.practices alter column created_by drop not null;
alter table public.practices drop constraint practices_created_by_fkey;
alter table public.practices add constraint practices_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
