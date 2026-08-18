alter table public.profiles
  add column phone text,
  add column kennitala text;

alter table public.profiles
  add constraint profiles_kennitala_format
  check (kennitala is null or kennitala ~ '^[0-9]{6}-[0-9]{4}$');
