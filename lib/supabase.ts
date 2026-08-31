
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase Environment Variables');
    console.log('VITE_SUPABASE_URL present:', !!supabaseUrl);
    console.log('VITE_SUPABASE_ANON_KEY present:', !!supabaseAnonKey);
    console.log('Environment Mode:', import.meta.env.MODE);
} else {
    console.log('Supabase Configured. URL Length:', supabaseUrl.length);
}

export const supabase = createClient((supabaseUrl || '').trim(), (supabaseAnonKey || '').trim());

/**
 * Helper to fetch all rows from a Supabase query, iteratively chunking
 * in batches of 1,000 rows to bypass PostgREST's server max_rows limit.
 */
export async function fetchAllSupabaseRows<T = any>(
    queryBuilderFn: () => any,
    batchSize = 1000
): Promise<T[]> {
    let allRows: T[] = [];
    let from = 0;
    let hasMore = true;

    try {
        while (hasMore) {
            const to = from + batchSize - 1;
            const { data, error } = await queryBuilderFn().range(from, to);
            if (error) {
                console.error(`[fetchAllSupabaseRows] Error fetching range ${from}-${to}:`, error);
                break;
            }
            if (data && data.length > 0) {
                allRows.push(...data);
                if (data.length < batchSize) {
                    hasMore = false;
                } else {
                    from += batchSize;
                }
            } else {
                hasMore = false;
            }
        }
    } catch (err) {
        console.error('[fetchAllSupabaseRows] Unexpected error during pagination:', err);
    }

    return allRows;
}
