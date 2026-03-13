-- Add missing columns to bills table to match Prisma schema
ALTER TABLE public.bills 
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.guest_sessions(id),
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS table_name text;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_bills_session_id ON public.bills(session_id);

-- Verify the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'bills'
ORDER BY ordinal_position;
