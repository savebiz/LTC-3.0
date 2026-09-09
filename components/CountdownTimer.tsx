import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const DEADLINE = new Date('2026-10-04T23:59:59+01:00'); // October 4, 2026 11:59:59 PM WAT (UTC+1)

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

function getTimeLeft(): TimeLeft | null {
    const now = new Date();
    const diff = DEADLINE.getTime() - now.getTime();

    if (diff <= 0) return null;

    return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
    };
}

export default function CountdownTimer() {
    const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(getTimeLeft);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(getTimeLeft());
        }, 1000); // Live ticking every second

        return () => clearInterval(timer);
    }, []);

    const pad = (n: number) => String(n).padStart(2, '0');

    // Expired state (after Oct 4, 11:59 PM)
    if (!timeLeft) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="w-full max-w-lg mx-auto px-2 sm:px-4"
            >
                <div className="bg-black/60 border border-orange-500/30 backdrop-blur-2xl shadow-[0_0_35px_rgba(249,115,22,0.12)] rounded-2xl sm:rounded-3xl px-6 py-5 text-center">
                    <p className="text-[10px] sm:text-xs tracking-[0.18em] text-orange-400 font-mono uppercase font-bold">
                        ONLINE REGISTRATION CLOSED
                    </p>
                    <p className="text-xs sm:text-sm text-zinc-300 mt-2 max-w-md mx-auto leading-relaxed">
                        Missed the online deadline? Onsite registration will be available at the conference venue on <span className="text-white font-semibold">Saturday, October 17, 2026</span>.
                    </p>
                </div>
            </motion.div>
        );
    }

    const segments = [
        { value: pad(timeLeft.days), label: 'Days' },
        { value: pad(timeLeft.hours), label: 'Hours' },
        { value: pad(timeLeft.minutes), label: 'Mins' },
        { value: pad(timeLeft.seconds), label: 'Secs' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="w-full max-w-lg mx-auto px-2 sm:px-4"
        >
            <div className="bg-black/60 border border-orange-500/30 hover:border-orange-500/50 transition-colors backdrop-blur-2xl shadow-[0_0_35px_rgba(249,115,22,0.12)] rounded-2xl sm:rounded-3xl px-3 py-4 sm:px-8 sm:py-5">
                {/* Header: Online Registration Deadline */}
                <p className="text-[8.5px] xs:text-[9.5px] sm:text-xs tracking-[0.04em] sm:tracking-[0.15em] text-zinc-300 font-mono uppercase text-center font-medium mb-3 sm:mb-4 whitespace-nowrap">
                    ONLINE REGISTRATION CLOSES OCT 4 • 11:59 PM
                </p>

                {/* 4-Unit Timer Digits (Days : Hours : Mins : Secs) */}
                <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-5">
                    {segments.map((seg, i) => (
                        <div key={seg.label} className="flex items-center gap-2 sm:gap-4 md:gap-5">
                            <div className="flex flex-col items-center min-w-[48px] sm:min-w-[64px]">
                                <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white font-mono leading-none tabular-nums drop-shadow-sm">
                                    {seg.value}
                                </span>
                                <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.15em] text-zinc-400 mt-1.5 font-medium">
                                    {seg.label}
                                </span>
                            </div>
                            {i < segments.length - 1 && (
                                <span className="text-base sm:text-2xl font-light text-zinc-500 -mt-2.5 select-none">
                                    :
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}
