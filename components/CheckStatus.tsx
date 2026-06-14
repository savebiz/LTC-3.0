import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, ArrowLeft } from 'lucide-react';
import DPCardGenerator from './DPCardGenerator';

export default function CheckStatus() {
    const [referenceCode, setReferenceCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const refParam = searchParams.get('ref');
        if (refParam) {
            setReferenceCode(refParam);
            performLookup(refParam);
        }
    }, []);

    async function performLookup(code: string) {
        if (!code.trim()) return;
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const { data, error } = await supabase
                .from('registrations')
                .select('*')
                .ilike('batch_reference', code.trim());

            if (error) throw error;

            if (data && data.length > 0) {
                setResult(data);
            } else {
                setError('No registration found for this reference code. Please check and try again.');
            }
        } catch (err: any) {
            console.error('Lookup Error:', err);
            setError('An error occurred. Please check your network connection and try again.');
        } finally {
            setLoading(false);
        }
    }

    const handleCheck = (e: React.FormEvent) => {
        e.preventDefault();
        performLookup(referenceCode);
    };

    const renderStatusBadge = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'confirmed' || s === 'cleared') {
            return (
                <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl animate-in fade-in">
                    <span className="text-lg leading-none mt-0.5">✓</span>
                    <span className="font-medium text-sm leading-relaxed">Payment Approved — You are confirmed for the event</span>
                </div>
            );
        }
        if (s === 'pending_verification' || s === 'pending_payment' || s === 'pending') {
            return (
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl animate-in fade-in">
                    <span className="text-lg leading-none mt-0.5">⏳</span>
                    <span className="font-medium text-sm leading-relaxed">Payment Pending — Your transfer is awaiting verification by our team</span>
                </div>
            );
        }
        if (s === 'pay_on_arrival') {
            return (
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl animate-in fade-in">
                    <span className="text-lg leading-none mt-0.5">📍</span>
                    <span className="font-medium text-sm leading-relaxed">Pay on Arrival — Please have exact cash ready at the gate</span>
                </div>
            );
        }
        // Rejected / Failed status
        return (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl animate-in fade-in">
                <span className="text-lg leading-none mt-0.5">✗</span>
                <span className="font-medium text-sm leading-relaxed">Payment Not Confirmed — Please contact the C3TC team</span>
            </div>
        );
    };

    const getPaymentMethodLabel = (method: string, status: string) => {
        const s = status?.toLowerCase() || '';
        if (method === 'pay_on_arrival' || s === 'pay_on_arrival') return 'Pay on Arrival';
        if (method === 'bank_transfer' || method === 'manual_transfer') return 'Bank Transfer';
        if (!method) return 'Bank Transfer';
        return method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' ');
    };

    const formatCategory = (cat: string) => {
        const c = cat?.toLowerCase() || '';
        if (c === 'teenager') return 'Teenager';
        if (c === 'teacher' || c === 'teacher_adult' || c === 'teacher / adult') return 'Teacher / Adult';
        return cat || 'Delegate';
    };

    // Derived values
    const totalAmount = result ? result.reduce((sum, r) => sum + (r.amount_due || 0), 0) : 0;
    const batchCode = result && result.length > 0 ? result[0].batch_reference : '';
    const paymentMethod = result && result.length > 0 ? result[0].payment_method : '';
    const paymentStatus = result && result.length > 0 ? (result[0].payment_status || result[0].status) : '';

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-start py-12 px-4 relative overflow-hidden">
            {/* Glowing background circles */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-600/10 blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-2xl relative z-10 space-y-8">
                {/* Back Link */}
                <div className="flex justify-start">
                    <a
                        href="/"
                        className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
                    >
                        <ArrowLeft size={16} /> Back to Home
                    </a>
                </div>

                {/* Header */}
                <div className="text-center space-y-3">
                    <h1 className="text-3xl md:text-4xl font-extrabold font-heading bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent tracking-tight">
                        Check Your Registration Status
                    </h1>
                    <p className="text-sm md:text-base text-zinc-400 max-w-lg mx-auto leading-relaxed">
                        Enter your batch reference code below to check if your payment has been approved.
                    </p>
                </div>

                {/* Search Form Card */}
                <Card className="bg-zinc-950/60 backdrop-blur-md border-zinc-800/80 text-white shadow-2xl rounded-2xl">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-bold">Search Batch</CardTitle>
                        <CardDescription className="text-zinc-500 text-xs">
                            Format example: C3TC-K7MX2PQR
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCheck} className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-3.5 text-zinc-600 w-4 h-4" />
                                <Input
                                    type="text"
                                    placeholder="Enter Reference Code"
                                    className="pl-10 bg-black/40 border-zinc-800 text-white placeholder:text-zinc-600 h-12 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono"
                                    value={referenceCode}
                                    onChange={e => setReferenceCode(e.target.value)}
                                    required
                                />
                            </div>
                            <Button
                                type="submit"
                                className="h-12 px-8 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold tracking-wide rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Check Status'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Error Box */}
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center font-medium animate-in fade-in slide-in-from-bottom-2">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading && !result && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                        <p className="text-sm text-zinc-500 animate-pulse">Searching registration data...</p>
                    </div>
                )}

                {/* Results Card */}
                {result && result.length > 0 && (
                    <Card className="bg-zinc-950/80 backdrop-blur-md border-zinc-800/80 text-white shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 p-6 border-b border-zinc-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Batch Reference Code</p>
                                <h3 className="text-xl font-bold font-mono text-orange-400 mt-1">{batchCode}</h3>
                            </div>
                            {['cleared', 'confirmed'].includes(paymentStatus?.toLowerCase()) ? (
                                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl">
                                    <p className="text-[10px] uppercase text-emerald-500 font-bold">Total Amount Paid</p>
                                    <p className="text-lg font-bold font-mono text-emerald-400 mt-0.5">₦{totalAmount.toLocaleString()}</p>
                                </div>
                            ) : (
                                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl">
                                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Total Amount Due</p>
                                    <p className="text-lg font-bold font-mono text-white mt-0.5">₦{totalAmount.toLocaleString()}</p>
                                </div>
                            )}
                        </div>

                        <CardContent className="p-6 space-y-6">
                            {/* Status Badge */}
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Current Payment Status</p>
                                {renderStatusBadge(paymentStatus)}
                            </div>

                            {/* QR Code section (only if cleared) */}
                            {result && result.length > 0 && ['cleared', 'confirmed'].includes(paymentStatus?.toLowerCase()) && result[0].qr_code_hash && (
                                <div className="space-y-3 flex flex-col items-center md:items-start animate-in fade-in duration-300">
                                    <p className="text-xs uppercase tracking-wider text-zinc-400 font-bold w-full text-center md:text-left">Your Check-In QR Code</p>
                                    <div className="bg-white p-3 rounded-2xl shadow-lg border border-zinc-800">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(result[0].qr_code_hash)}`}
                                            alt="Check-In QR Code"
                                            className="w-[200px] h-[200px] block"
                                        />
                                    </div>
                                    <p className="text-sm text-zinc-300 font-medium text-center md:text-left">
                                        Show this to the check-in team at the venue
                                    </p>
                                </div>
                            )}

                            {/* DP Card Generator section (only if cleared) */}
                            {result && result.length > 0 && ['cleared', 'confirmed'].includes(paymentStatus?.toLowerCase()) && (
                                <DPCardGenerator registrants={result} darkMode={true} />
                            )}

                            {/* Payment Method & Summary */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-900/40 p-4 border border-zinc-800/50 rounded-xl text-sm">
                                <div>
                                    <p className="text-zinc-500 text-xs">Payment Method</p>
                                    <p className="font-semibold text-white mt-0.5">{getPaymentMethodLabel(paymentMethod, paymentStatus)}</p>
                                </div>
                                <div>
                                    <p className="text-zinc-500 text-xs">Total Registrants</p>
                                    <p className="font-semibold text-white mt-0.5">{result.length} {result.length === 1 ? 'Person' : 'People'}</p>
                                </div>
                            </div>

                            {/* Registrants List */}
                            <div className="space-y-3">
                                <p className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Registrants in this Batch</p>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {result.map((reg, index) => (
                                        <div
                                            key={reg.id || index}
                                            className="flex justify-between items-center bg-zinc-900/30 hover:bg-zinc-900/60 p-4 border border-zinc-900 rounded-xl transition-all"
                                        >
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-zinc-200">{reg.full_name}</p>
                                                <p className="text-xs text-zinc-500">
                                                    {formatCategory(reg.category)} {reg.age ? `• Age ${reg.age}` : ''}
                                                </p>
                                            </div>
                                            <span className="font-mono font-medium text-sm text-zinc-300">
                                                ₦{(reg.amount_due || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
