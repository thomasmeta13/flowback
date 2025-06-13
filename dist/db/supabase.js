"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSupabaseError = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = 'https://ezwoigvemjyknhuopfym.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6d29pZ3ZlbWp5a25odW9wZnltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2MjE0NTksImV4cCI6MjA2MTE5NzQ1OX0.WBzDF0aQOdHOAjr5G-KCZ-SZI9W8ivMVxs3uJ-2bfx0';
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
const handleSupabaseError = (error) => {
    console.error('Supabase Error:', error);
    throw new Error(error.message || 'Database error occurred');
};
exports.handleSupabaseError = handleSupabaseError;
//# sourceMappingURL=supabase.js.map