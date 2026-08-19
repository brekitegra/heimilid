-- Bug fix: the write policies for pet-photos (migration 0017) referenced
-- the storage path as bare `name` inside an `exists (select ... from
-- public.pets p ...)` subquery. `pets` also has its own `name` column (the
-- pet's name, e.g. "Rex"), and Postgres resolves an unqualified column to
-- the innermost matching table in scope — so `name` silently bound to
-- `p.name` instead of the outer `storage.objects.name` (the file path).
-- The check then evaluated `storage.foldername('Rex')` instead of the
-- actual upload path, which could never match a pet id, so every upload
-- was rejected. Fixed by explicitly qualifying the storage path column.
drop policy "Household members can upload pet photos" on storage.objects;
drop policy "Household members can update pet photos" on storage.objects;
drop policy "Household members can delete pet photos" on storage.objects;

create policy "Household members can upload pet photos"
  on storage.objects for insert
  with check (
    bucket_id = 'pet-photos'
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and public.is_household_member(p.household_id)
    )
  );

create policy "Household members can update pet photos"
  on storage.objects for update
  using (
    bucket_id = 'pet-photos'
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and public.is_household_member(p.household_id)
    )
  );

create policy "Household members can delete pet photos"
  on storage.objects for delete
  using (
    bucket_id = 'pet-photos'
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and public.is_household_member(p.household_id)
    )
  );
