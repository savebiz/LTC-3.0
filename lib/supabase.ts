
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
 * Helper to fetch all rows from a Supabase query, automatically paginating
 * in batches of 1,000 rows to bypass PostgREST's default 1,000-row limit.
 */
export async function fetchAllSupabaseRows<T = any>(
    queryBuilderFn: () => any,
    batchSize = 1000
): Promise<T[]> {
    let allRows: T[] = [];
    let page = 0;
    let hasMore = true;

    try {
        while (hasMore) {
            const from = page * batchSize;
            const to = from + batchSize - 1;
            const { data, error } = await queryBuilderFn().range(from, to);
            if (error) {
                console.error(`[fetchAllSupabaseRows] Error fetching page ${page}:`, error);
                break;
            }
            if (data && data.length > 0) {
                allRows = allRows.concat(data);
                if (data.length < batchSize) {
                    hasMore = false;
                } else {
                    page++;
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
