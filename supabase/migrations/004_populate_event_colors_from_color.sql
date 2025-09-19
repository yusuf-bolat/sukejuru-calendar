-- Migration: populate color fields from existing `color` column if present
DO $$
BEGIN
  -- Only run if `color` column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events' AND column_name='color'
  ) THEN

    -- Ensure target columns exist (safe no-op if already added by earlier migration)
    -- Ensure only background_color exists and copy values from `color`
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='events' AND column_name='background_color'
    ) THEN
      ALTER TABLE public.events ADD COLUMN background_color text;
    END IF;

    -- Copy existing `color` values into background_color where it is NULL
    UPDATE public.events
    SET background_color = COALESCE(background_color, color)
    WHERE color IS NOT NULL;
  END IF;
END
$$;  

-- Quick verification helpers you can run after applying this migration:
-- 1) Confirm columns exist:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='events' ORDER BY ordinal_position;

-- 2) Preview a few rows:
-- SELECT id, color, background_color, border_color, text_color FROM public.events LIMIT 10;
