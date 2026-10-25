import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Play, Instagram, ArrowUpRight, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import CountdownTimer from '@/components/CountdownTimer';

interface HeroProps {
    onRegisterClick: () => void;
    onVolunteerClick: () => void;
}

const Hero: React.FC<HeroProps> = ({ onRegisterClick, onVolunteerClick }) => {
    const [showConcludedModal, setShowConcludedModal] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowConcludedModal(true);
        }, 700);
        return () => clearTimeout(timer);
    }, []);
    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black pb-12 md:pb-0">
            {/* Video Background */}
            <div className="absolute inset-0 w-full h-full">
                {/* Dark overlay for text readability */}
                <div className="absolute inset-0 bg-black/50 z-10" />
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    poster="/images/hero-poster.webp"
                    className="w-full h-full object-cover opacity-60"
                >
                    <source src="/videos/hero-reel.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 z-20" />
            </div>

            <Navbar onRegisterClick={onRegisterClick} />

            {/* Content */}
            <div className="relative z-30 text-center space-y-6 md:space-y-10 px-4 pt-24 sm:pt-32 md:pt-40 pb-16 md:pb-24 max-w-7xl mx-auto w-full">
                

                <div className="relative flex items-center justify-center py-6 md:py-10">
                    <div className="relative inline-block">
                        <motion.h1
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="text-[clamp(3.5rem,13vw,13rem)] leading-[0.8] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500 font-heading select-none filter drop-shadow-2xl z-10"
                        >
                            T.I.M.E
                        </motion.h1>

                        {/* '26 Badge */}
                        <motion.div
                            initial={{ opacity: 0, rotate: 0, scale: 0 }}
                            animate={{ opacity: 1, rotate: 12, scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, delay: 0.8 }}
                            className="absolute -top-1 -right-2 sm:-top-2 sm:-right-4 md:-top-4 md:-right-12 rotate-12 bg-orange-500 text-black font-black text-[10px] sm:text-xl md:text-3xl px-1.5 py-0.5 md:px-3 md:py-1 rounded-[3px] sm:rounded-md transform hover:rotate-0 transition-transform duration-300 cursor-default shadow-[0_0_10px_rgba(249,115,22,0.3)] md:shadow-[0_0_20px_rgba(249,115,22,0.4)] border border-white/10 md:border-2 border-white/20 z-20 font-heading"
                        >
                            '26
                        </motion.div>
                    </div>

                    {/* Glow Effects */}
                    <div className="absolute -top-10 -right-10 md:-top-20 md:-right-20 w-48 h-48 md:w-96 md:h-96 bg-orange-500/20 rounded-full blur-[80px] md:blur-[120px] animate-pulse" />
                    <div className="absolute -bottom-10 -left-10 md:-bottom-20 md:-left-20 w-48 h-48 md:w-96 md:h-96 bg-blue-500/20 rounded-full blur-[80px] md:blur-[120px] animate-pulse delay-1000" />
                </div>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="text-base md:text-4xl font-light text-gray-300 tracking-[0.2em] md:tracking-[0.3em] uppercase font-sans mix-blend-plus-lighter px-4"
                >
                    The Incredible Me Evolving
                </motion.p>

                {/* Pop-Up Modal for Conference Concluded Thank You Notice */}
                {showConcludedModal && (
                    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="relative w-full max-w-md bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border border-orange-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(249,115,22,0.25)] text-center space-y-4">
                            {/* Close button */}
                            <button
                                onClick={() => setShowConcludedModal(false)}
                                className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px] sm:text-xs font-mono font-bold tracking-wider uppercase">
                                CONFERENCE CONCLUDED • THANK YOU!
                            </div>

                            <h3 className="text-xl sm:text-2xl font-black text-white font-heading tracking-tight leading-snug">
                                C3TC '26 Was Historic!
                            </h3>

                            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                                Over <strong className="text-white font-bold">5,000 teenagers, coordinators, and teachers</strong> gathered across Continent 3 at Glory Arena, Redemption City. The Incredible You is Evolving.
                            </p>

                            <div className="pt-2 space-y-2.5">
                                <a
                                    href="/#gallery"
                                    onClick={() => setShowConcludedModal(false)}
                                    className="block w-full"
                                >
                                    <Button className="w-full bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 hover:opacity-90 text-white rounded-2xl font-bold py-5 text-xs sm:text-sm shadow-md gap-2">
                                        <Play className="w-4 h-4 fill-current" /> Watch Conference Broadcast
                                    </Button>
                                </a>
                                <a
                                    href="/program"
                                    onClick={() => setShowConcludedModal(false)}
                                    className="block w-full"
                                >
                                    <Button variant="outline" className="w-full border-white/20 text-zinc-200 hover:text-white hover:bg-white/10 rounded-2xl font-bold py-5 text-xs sm:text-sm">
                                        Explore Program Souvenir
                                    </Button>
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* Official Instagram Reel Callout Badge (No glowing dot) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.9 }}
                    className="flex justify-center pt-2"
                >
                    <a
                        href="https://www.instagram.com/reel/DettbnYti8w/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/40 text-zinc-300 hover:text-white transition-all text-xs font-mono group"
                    >
                        <Instagram className="w-3.5 h-3.5 text-pink-400" />
                        <span>Watch Official Event Reel on Instagram</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-pink-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1 }}
                    className="pt-4 md:pt-6 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 w-full max-w-sm md:max-w-none mx-auto"
                >
                    <a
                        href="/#gallery"
                        className="w-full md:w-auto"
                    >
                        <Button
                            size="lg"
                            className="w-full md:w-auto h-auto bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 text-white hover:from-red-500 hover:to-amber-400 px-8 py-4 md:px-10 md:py-5 text-base md:text-lg rounded-full font-bold tracking-wide transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(239,68,68,0.3)] cursor-pointer flex items-center justify-center gap-2"
                        >
                            <Play className="w-5 h-5 fill-current" /> WATCH CONFERENCE BROADCAST
                        </Button>
                    </a>
                    <a href="/program" className="w-full md:w-auto">
                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full md:w-auto h-auto border-white/20 text-white bg-white/5 hover:bg-white/10 hover:text-white px-8 py-4 md:px-10 md:py-5 text-base md:text-lg rounded-full font-bold tracking-wide backdrop-blur-sm transition-all hover:border-white/50 cursor-pointer"
                        >
                            EXPLORE PROGRAM SOUVENIR
                        </Button>
                    </a>
                </motion.div>
            </div>
        </section>
    );
};

export default Hero;
