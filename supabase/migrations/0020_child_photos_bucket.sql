-- Mirrors pet-photos exactly, including the lesson learned there: children
-- also has its own `name` column, so the storage path must be qualified as
-- storage.objects.name inside the exists() subquery — an unqualified bare
-- `name` would silently resolve to the child's own name instead of the
-- upload path, and every write would be rejected.
insert into storage.buckets (id, name, public)
values ('child-photos', 'child-photos', true)
on conflict (id) do nothing;

create policy "Child photos are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'child-photos');

create policy "Household members can upload child photos"
  on storage.objects for insert
  with check (
    bucket_id = 'child-photos'
    and exists (
      select 1 from public.children c
      where c.id::text = (storage.foldername(storage.objects.name))[1]
        and public.is_household_member(c.household_id)
    )
  );

create policy "Household members can update child photos"
  on storage.objects for update
  using (
    bucket_id = 'child-photos'
    and exists (
      select 1 from public.children c
      where c.id::text = (storage.foldername(storage.objects.name))[1]
        and public.is_household_member(c.household_id)
    )
  );

create policy "Household members can delete child photos"
  on storage.objects for delete
  using (
    bucket_id = 'child-photos'
    and exists (
      select 1 from public.children c
      where c.id::text = (storage.foldername(storage.objects.name))[1]
        and public.is_household_member(c.household_id)
    )
  );
