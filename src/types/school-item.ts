export type SchoolItemType = 'homework' | 'test' | 'quiz' | 'project' | 'other';

export interface SchoolItem {
  id: string;
  household_id: string;
  child_id: string;
  title: string;
  item_type: SchoolItemType;
  subject: string | null;
  due_date: string | null;
  is_done: boolean;
  assigned_to: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SchoolItemInput {
  title: string;
  itemType: SchoolItemType;
  subject: string | null;
  dueDate: string | null;
  assignedTo: string | null;
}
