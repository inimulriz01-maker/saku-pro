import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vlfeiybxbhpyuuncohqd.supabase.co'
const supabaseKey = 'sb_publishable_C-Uvw4ZIQ8_qL5L1lEbQaw_NxQWW8a1'

export const supabase = createClient(supabaseUrl, supabaseKey)