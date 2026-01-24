import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function RegistrationSuccessPage() {
    const searchParams = new URLSearchParams(window.location.search);
    const type = searchParams.get('type');
    const reference = searchParams.get('reference');
    const name = searchParams.get('name');
    const regId = searchParams.get('regId');
    const isVolunteer = type === 'volunteer';

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 animate-fade-in-up">
            <div className="text-center space-y-6 max-w-md w-full">
                <div className="flex justify-center">
                    <CheckCircle2 className="w-24 h-24 text-green-500 animate-bounce" />
                </div>
                <h1 className="text-4xl font-bold font-heading text-gradient-brand">
                    Registration Successful!
                </h1>

                {/* Digital Ticket Card */}
                {!isVolunteer ? (
                    <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/20 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
                        {/* Decorative circles to look like a ticket */}
                        <div className="absolute top-1/2 -left-3 w-6 h-6 bg-black rounded-full transform -translate-y-1/2"></div>
                        <div className="absolute top-1/2 -right-3 w-6 h-6 bg-black rounded-full transform -translate-y-1/2"></div>

                        <div className="text-center border-b border-dashed border-white/20 pb-6 mb-6">
                            <h2 className="text-lg font-bold text-gray-400 uppercase tracking-widest">Digital Pass</h2>
                            <p className="text-2xl font-bold text-white mt-2">{name || 'Delegate'}</p>
                            <span className="inline-block mt-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-semibold">
                                Pending Verification
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-left text-sm">
                            <div>
                                <p className="text-gray-500 text-xs uppercase">Event</p>
                                <p className="font-semibold text-white">LTC 3.0 (T.I.M.E)</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase">Reg ID</p>
                                <p className="font-mono text-orange-400 font-bold">{regId?.slice(0, 8).toUpperCase() || reference || '---'}</p>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-white/10 text-center">
                            <p className="text-xs text-gray-500">Please screenshot this pass for your records.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-gray-300">
                            Thank you for joining the LTC 3.0 (T.I.M.E) Volunteer Force.
                            We will review your application and get back to you.
                        </p>
                        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                            <p className="text-sm text-gray-400 mb-2">Registration Status</p>
                            <span className="inline-block px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-semibold">
                                Confirmed
                            </span>
                        </div>
                    </div>
                )}

                <Button
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 font-bold tracking-wide py-6"
                    onClick={() => window.location.href = '/'}
                >
                    BACK TO HOME
                </Button>
            </div>
        </div>
    );
}
