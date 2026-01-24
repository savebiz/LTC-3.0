import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function RegistrationSuccessPage() {
    const searchParams = new URLSearchParams(window.location.search);
    const type = searchParams.get('type');
    const isVolunteer = type === 'volunteer';

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 animate-fade-in-up">
            <div className="text-center space-y-6 max-w-md">
                <div className="flex justify-center">
                    <CheckCircle2 className="w-24 h-24 text-green-500 animate-bounce" />
                </div>
                <h1 className="text-4xl font-bold font-heading text-gradient-brand">
                    Registration Successful!
                </h1>
                <p className="text-gray-300">
                    Thank you for joining the LTC 3.0 (T.I.M.E) {isVolunteer ? 'Volunteer Force' : 'Delegates'}.
                    Your seat is secured.
                </p>

                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <p className="text-sm text-gray-400 mb-2">Registration Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${isVolunteer ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {isVolunteer ? 'Confirmed' : 'Pending Verification'}
                    </span>
                    {reference && (
                        <div className="mt-4 pt-3 border-t border-white/10">
                            <p className="text-xs text-gray-500 mb-1">Payment Reference</p>
                            <p className="font-mono text-xs text-orange-400 tracking-wider">{reference}</p>
                        </div>
                    )}
                </div>

                {!isVolunteer && (
                    <div className="text-sm text-gray-500 bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                        <p className="font-bold text-white mb-1">IMPORTANT:</p>
                        <p className="mb-2">Please take a screenshot of this page for your records.</p>
                        <p>Once your payment is confirmed by our admin team, your status will be updated.</p>
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
