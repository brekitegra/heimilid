export interface Pet {
  id: string;
  household_id: string;
  name: string;
  species: string | null;
  breed: string | null;
  birth_date: string | null;
  notes: string | null;
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PetInput {
  name: string;
  species: string | null;
  breed: string | null;
  birthDate: string | null;
  notes: string | null;
}
