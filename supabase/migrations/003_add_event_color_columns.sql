-- Migration: add color columns to events table if missing
DO $$
BEGIN
  -- Add background_color if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='events' AND column_name='background_color'
  ) THEN
    ALTER TABLE public.events ADD COLUMN background_color text;
  END IF;

  -- Optionally set defaults for existing rows where null
  UPDATE public.events
  SET background_color = COALESCE(background_color, '#4fc3f7')
  WHERE true;
END
$$;
