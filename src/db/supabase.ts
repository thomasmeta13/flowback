import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezwoigvemjyknhuopfym.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6d29pZ3ZlbWp5a25odW9wZnltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2MjE0NTksImV4cCI6MjA2MTE5NzQ1OX0.WBzDF0aQOdHOAjr5G-KCZ-SZI9W8ivMVxs3uJ-2bfx0';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to handle Supabase errors
export const handleSupabaseError = (error: any) => {
  console.error('Supabase Error:', error);
  throw new Error(error.message || 'Database error occurred');
}; 