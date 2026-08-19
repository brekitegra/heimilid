-- Pet photos: mirrors the avatars bucket (migration 0008) exactly, except
-- ownership is household-membership-based rather than a single user id,
-- since a pet belongs to the whole household, not one person.
alter table public.pets add column avatar_url text;

insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', true)
on conflict (id) do nothing;

-- Anyone can view pet photos (public bucket, rendered for all household
-- members).
create policy "Pet photos are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'pet-photos');

-- Path convention: "<pet_id>/photo.<ext>" — write access requires being a
-- member of the household that pet belongs to, checked via the first path
-- segment rather than trusting the client.
create policy "Household members can upload pet photos"
  on storage.objects for insert
  with check (
    bucket_id = 'pet-photos'
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(name))[1]
        and public.is_household_member(p.household_id)
    )
  );

create policy "Household members can update pet photos"
  on storage.objects for update
  using (
    bucket_id = 'pet-photos'
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(name))[1]
        and public.is_household_member(p.household_id)
    )
  );

create policy "Household members can delete pet photos"
  on storage.objects for delete
  using (
    bucket_id = 'pet-photos'
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(name))[1]
        and public.is_household_member(p.household_id)
    )
  );
