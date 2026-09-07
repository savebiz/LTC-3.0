import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const DEADLINE = new Date('2026-09-13T23:59:59+01:00'); // September 13, 2026 11:59:59 PM WAT (UTC+1)

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

    // Expired state
    if (!timeLeft) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="w-full max-w-lg mx-auto px-4"
            >
                <div className="bg-black/60 border border-orange-500/30 backdrop-blur-2xl shadow-[0_0_35px_rgba(249,115,22,0.12)] rounded-2xl sm:rounded-3xl px-6 py-4 text-center">
                    <p className="text-xs tracking-[0.2em] text-zinc-400 font-mono uppercase">
                        Delegate Registration
                    </p>
                    <p className="text-lg sm:text-xl font-bold text-orange-400 mt-2 tracking-wide">
                        CLOSED
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
            <div className="bg-black/60 border border-orange-500/30 hover:border-orange-500/50 transition-colors backdrop-blur-2xl shadow-[0_0_35px_rgba(249,115,22,0.12)] rounded-2xl sm:rounded-3xl px-4 py-4 sm:px-8 sm:py-5">
                {/* Header */}
                <p className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] text-zinc-300 font-mono uppercase text-center font-medium mb-3 sm:mb-4">
                    Registration closes Sept 13 • 11:59 PM
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
