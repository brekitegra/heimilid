export interface Note {
  id: string;
  household_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteInput {
  body: string;
}
