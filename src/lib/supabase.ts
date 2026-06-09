import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://earcdglvoepdlauuupuw.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_UMecPkAoioLg55magU-P5w_m4jR3cfq'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
