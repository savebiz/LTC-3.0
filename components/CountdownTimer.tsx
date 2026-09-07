import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const DEADLINE = new Date('2026-09-13T23:59:59+01:00'); // September 13, 2026 11:59:59 PM WAT (UTC+1)

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
}

function getTimeLeft(): TimeLeft | null {
    const now = new Date();
    const diff = DEADLINE.getTime() - now.getTime();

    if (diff <= 0) return null;

    return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
    };
}

export default function CountdownTimer() {
    const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(getTimeLeft);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(getTimeLeft());
        }, 60_000); // Update every minute (no seconds display)

        // Also run once on mount to catch exact minute boundaries
        setTimeLeft(getTimeLeft());

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
                className="w-full max-w-md mx-auto"
            >
                <div className="bg-white/[0.04] border border-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl px-6 py-4 text-center">
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
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="w-full max-w-md mx-auto"
        >
            <div className="bg-white/[0.04] border border-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl px-5 py-4 sm:px-8 sm:py-5">
                {/* Header */}
                <p className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] text-zinc-400 font-mono uppercase text-center mb-3 sm:mb-4">
                    Registration closes Sept 13 • 11:59 PM
                </p>

                {/* Timer Digits */}
                <div className="flex items-center justify-center gap-3 sm:gap-5">
                    {segments.map((seg, i) => (
                        <div key={seg.label} className="flex items-center gap-3 sm:gap-5">
                            <div className="flex flex-col items-center">
                                <span className="text-2xl sm:text-4xl font-extrabold text-white font-mono leading-none tabular-nums">
                                    {seg.value}
                                </span>
                                <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-zinc-500 mt-1.5 font-medium">
                                    {seg.label}
                                </span>
                            </div>
                            {i < segments.length - 1 && (
                                <span className="text-xl sm:text-2xl font-light text-zinc-600 -mt-3 select-none">
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
