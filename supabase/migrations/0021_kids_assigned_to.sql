-- "Assign to a household member" for school items and practices, mirroring
-- the exact pattern Chores/Pets already use — nullable, on delete set null
-- (same account-deletion-safety convention as every other domain table).
alter table public.school_items add column assigned_to uuid references public.profiles (id) on delete set null;
alter table public.practices add column assigned_to uuid references public.profiles (id) on delete set null;
