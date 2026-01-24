import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const DebugPage: React.FC = () => {
    const [status, setStatus] = useState<any>({});
    const [connTest, setConnTest] = useState<string>('Testing...');

    useEffect(() => {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

        setStatus({
            'VITE_SUPABASE_URL': url ? `${url.substring(0, 15)}...` : 'MISSING',
            'VITE_SUPABASE_ANON_KEY': key ? `Length: ${key.length}, Start: ${key.substring(0, 10)}..., End: ...${key.substring(key.length - 5)}` : 'MISSING',
            'MODE': import.meta.env.MODE,
            'PROD': import.meta.env.PROD ? 'true' : 'false',
            'SSR': import.meta.env.SSR ? 'true' : 'false',
        });

        async function testConn() {
            try {
                console.log('Testing Supabase connection from DebugPage...');
                const { data, error } = await supabase.from('registrations').select('count', { count: 'exact', head: true });
                if (error) {
                    setConnTest(`ERROR: ${error.message} (Code: ${error.code})`);
                    console.error('Debug Page Supabase Error:', error);
                } else {
                    setConnTest(`SUCCESS! Data: ${JSON.stringify(data)}`);
                }
            } catch (err: any) {
                setConnTest(`EXCEPTION: ${err.message}`);
                console.error('Debug Page Exception:', err);
            }
        }

        testConn();
    }, []);

    return (
        <div className="p-8 bg-white min-h-screen text-black font-mono text-sm overflow-x-auto">
            <h1 className="text-2xl font-bold mb-4">Environment Diagnostics</h1>

            <div className="mb-6 p-4 border rounded bg-gray-100">
                <h2 className="font-bold mb-2">Environment Variables</h2>
                <pre>{JSON.stringify(status, null, 2)}</pre>
            </div>

            <div className="p-4 border rounded bg-blue-50">
                <h2 className="font-bold mb-2">Supabase Connection Test</h2>
                <pre className="whitespace-pre-wrap break-all">{connTest}</pre>
            </div>

            <p className="mt-8 text-gray-500">
                Take a screenshot of this page if it shows "MISSING" or an Error.
            </p>
        </div>
    );
};

export default DebugPage;
