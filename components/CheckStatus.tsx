
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function CheckStatus() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');

    async function handleCheck(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResult(null);

        try {
            // Check both tables
            const { data: volData } = await supabase
                .from('volunteers')
                .select('*')
                .eq('email', email.trim())
                .single();

            if (volData) {
                setResult({ ...volData, type: 'Volunteer' });
                setLoading(false);
                return;
            }

            const { data: regData } = await supabase
                .from('registrations')
                .select('*')
                .eq('email', email.trim())
                .single();

            if (regData) {
                setResult({ ...regData, type: 'Delegate' });
            } else {
                setError('No registration found with this email.');
            }

        } catch (err) {
            console.error(err);
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-white">
                <CardHeader>
                    <CardTitle className="text-2xl font-heading text-center">Check Registration Status</CardTitle>
                    <CardDescription className="text-center text-zinc-400">Enter your email address to check your status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleCheck} className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-zinc-500 w-5 h-5" />
                            <Input
                                type="email"
                                placeholder="Enter your email"
                                className="pl-10 bg-black/50 border-zinc-700 text-white placeholder:text-zinc-600 h-11"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full h-11 bg-orange-600 hover:bg-orange-700 font-bold tracking-wide" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : 'CHECK STATUS'}
                        </Button>
                    </form>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    {result && (
                        <div className="p-6 bg-zinc-950 rounded-xl border border-zinc-800 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex flex-col items-center text-center space-y-4">
                                {result.status === 'confirmed' ? (
                                    <CheckCircle className="w-12 h-12 text-green-500" />
                                ) : result.status === 'rejected' ? (
                                    <XCircle className="w-12 h-12 text-red-500" />
                                ) : (
                                    <Clock className="w-12 h-12 text-yellow-500" />
                                )}

                                <div>
                                    <h3 className="font-bold text-lg">{result.full_name}</h3>
                                    <p className="text-zinc-500 text-sm capitalize">{result.type} • {result.status?.replace('_', ' ')}</p>
                                </div>

                                <div className="w-full pt-4 border-t border-zinc-800">
                                    {result.status === 'confirmed' ? (
                                        <p className="text-green-400 font-medium">Your registration is confirmed! See you at the conference.</p>
                                    ) : result.status === 'pending_verification' ? (
                                        <p className="text-yellow-400 font-medium">Your payment is being verified. Please check back later.</p>
                                    ) : (
                                        <p className="text-zinc-400 text-sm">Status: {result.status}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <a href="/" className="mt-8 text-zinc-500 hover:text-white text-sm transition-colors">
                &larr; Back to Home
            </a>
        </div>
    );
}
