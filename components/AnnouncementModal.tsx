import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Laptop, Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'c3tc_date_shift_notice_v1';

export default function AnnouncementModal() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Check if user has already seen this notice in the current browser session
        const hasSeen = sessionStorage.getItem(STORAGE_KEY);
        if (!hasSeen) {
            // Slight delay for smooth initial page reveal
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 600);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        sessionStorage.setItem(STORAGE_KEY, 'true');
        setIsOpen(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                    {/* Dark Backdrop with Blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={handleDismiss}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md"
                    />

                    {/* Compact Micro-Card Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
                        className="relative w-full max-w-md bg-zinc-950/95 border border-white/15 rounded-3xl p-5 sm:p-7 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl text-white z-10 my-auto"
                    >
                        {/* Top Row: Tag & Close Button */}
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <span className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.16em] font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
                                IMPORTANT UPDATE
                            </span>
                            <button
                                onClick={handleDismiss}
                                aria-label="Close notification"
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-white/5"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Headline */}
                        <h3 className="text-lg sm:text-xl font-bold font-heading text-white tracking-tight leading-snug mb-2.5">
                            C3TC '26 Rescheduled to Saturday, Oct 17
                        </h3>

                        {/* Concise Context Message */}
                        <p className="text-xs sm:text-[13px] text-zinc-300 leading-relaxed mb-4">
                            Due to ongoing Lagos–Ibadan Expressway expansion joint repairs, the conference has been rescheduled to ensure delegate safety, reduced commuting costs, and seamless travel.
                        </p>

                        {/* 3-Pill Date Grid */}
                        <div className="space-y-2 mb-5">
                            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                                <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
                                    <Calendar className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-medium">New Conference Date</p>
                                    <p className="text-xs sm:text-sm font-semibold text-white truncate">Saturday, October 17, 2026</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                                    <Laptop className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-medium">Online Registration</p>
                                    <p className="text-xs sm:text-sm font-semibold text-white truncate">Closes Sunday, Oct 4 • 11:59 PM</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                                    <Users className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-medium">Volunteer Registration</p>
                                    <p className="text-xs sm:text-sm font-semibold text-white truncate">Reopened (Active till Sept 30)</p>
                                </div>
                            </div>
                        </div>

                        {/* CTA Dismiss Button */}
                        <Button
                            onClick={handleDismiss}
                            className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-3 sm:py-3.5 rounded-full text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                            Continue to Website
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
