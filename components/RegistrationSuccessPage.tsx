import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function RegistrationSuccessPage() {
    const searchParams = new URLSearchParams(window.location.search);
    const reference = searchParams.get('reference');

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
                    Thank you for registering for LTC 3.0 (T.I.M.E).
                    Your seat is secured.
                </p>

                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <p className="text-sm text-gray-400 mb-2">Registration Status</p>
                    <span className="inline-block px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-semibold">
                        Confirmed
                    </span>
                    {reference && (
                        <div className="mt-4 pt-3 border-t border-white/10">
                            <p className="text-xs text-gray-500 mb-1">Payment Reference</p>
                            <p className="font-mono text-xs text-orange-400 tracking-wider">{reference}</p>
                        </div>
                    )}
                </div>

                <p className="text-sm text-gray-500">
                    Please check your email for further details.
                </p>

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
