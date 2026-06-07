-- Add quiz_data column to focus_records
ALTER TABLE public.focus_records ADD COLUMN IF NOT EXISTS quiz_data JSONB;
