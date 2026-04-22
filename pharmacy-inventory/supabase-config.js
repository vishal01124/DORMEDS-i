// ─────────────────────────────────────────────────────────────
//  Supabase Configuration
//  Find credentials at: https://supabase.com → Project → Settings → API
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL     = 'https://mwerulfadajqwiynpcdw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZXJ1bGZhZGFqcXdpeW5wY2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NDkxNjAsImV4cCI6MjA5MjMyNTE2MH0.i4k0Uz_IRR3Yk6ycp-RkwkvsGXPxNtWjNdQM1pJ7I_4';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
