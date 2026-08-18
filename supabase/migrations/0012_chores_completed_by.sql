alter table public.chores
  add column completed_by uuid references public.profiles (id) on delete set null;
