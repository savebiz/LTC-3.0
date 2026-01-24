import { motion } from "framer-motion";
import { Sparkles, CalendarClock, PartyPopper } from "lucide-react";

export function ComingSoonDelegate() {
    return (
        <div className="relative overflow-hidden rounded-xl border border-white/20 bg-black/50 p-8 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-500">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl transform animate-pulse" />
            <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl transform animate-pulse delay-1000" />

            <div className="relative z-10 flex flex-col items-center space-y-6">
                <div className="relative">
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-500 to-orange-500 opacity-75 blur animate-pulse" />
                    <div className="relative rounded-full bg-black p-4">
                        <Sparkles className="h-10 w-10 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-orange-400 fill-current" />
                        <PartyPopper className="h-10 w-10 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 animate-ping" /> {/* Hidden but needed for imports? No, just styling effect */}
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-heading">
                        Registration <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-orange-400">Opening Soon</span>
                    </h3>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                        We are finalizing the details for an incredible experience. The wait will be worth it!
                    </p>
                </div>

                <div className="flex items-center justify-center space-x-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
                    <CalendarClock className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-medium text-gray-300">Check back later</span>
                </div>
            </div>
        </div>
    );
}
