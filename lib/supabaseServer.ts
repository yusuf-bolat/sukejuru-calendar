import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  console.warn('SUPABASE: NEXT_PUBLIC_SUPABASE_URL is not set')
}

export const supabaseServer = createClient(
  url ?? '',
  serviceKey ?? '',
  { auth: { persistSession: false } }
)
