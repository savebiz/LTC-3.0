import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';

interface HeroProps {
    onRegisterClick: () => void;
}

const Hero: React.FC<HeroProps> = ({ onRegisterClick }) => {
    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
            {/* Video Background */}
            <div className="absolute inset-0 w-full h-full">
                <div className="absolute inset-0 bg-black/40 z-10 mix-blend-overlay" />
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover opacity-60 mix-blend-overlay"
                >
                    <source src="/videos/hero-reel.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-background z-20" />
            </div>

            <Navbar onRegisterClick={onRegisterClick} />

            {/* Content */}
            <div className="relative z-30 text-center space-y-8 px-4 mt-20 max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="inline-flex items-center space-x-3 bg-white/5 border border-white/10 rounded-full px-5 py-2 backdrop-blur-md"
                >
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-gray-300 text-xs md:text-sm tracking-[0.2em] font-medium font-mono">ROMANS 13:11</span>
                </motion.div>

                <div className="relative flex items-center justify-center py-10">
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="text-[6rem] sm:text-[10rem] md:text-[14rem] lg:text-[18rem] leading-[0.8] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500 font-heading select-none filter drop-shadow-2xl z-10"
                    >
                        T.I.M.E
                    </motion.h1>

                    {/* '26 Badge */}
                    <motion.div
                        initial={{ opacity: 0, rotate: 0, scale: 0 }}
                        animate={{ opacity: 1, rotate: 12, scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.8 }}
                        className="absolute top-0 right-4 md:right-10 lg:right-20 rotate-12 bg-orange-500 text-black font-black text-4xl md:text-6xl px-4 py-2 rounded-lg transform hover:rotate-0 transition-transform duration-300 cursor-default shadow-[0_0_30px_rgba(249,115,22,0.6)] border-4 border-white/20 z-20 font-heading"
                    >
                        '26
                    </motion.div>

                    {/* Glow Effects */}
                    <div className="absolute -top-20 -right-20 w-96 h-96 bg-orange-500/20 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] animate-pulse delay-1000" />
                </div>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="text-xl md:text-4xl font-light text-gray-300 tracking-[0.3em] uppercase font-sans mix-blend-plus-lighter"
                >
                    The Incredible Me Emerging
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1 }}
                    className="pt-12 flex flex-col md:flex-row items-center justify-center gap-6"
                >
                    <Button
                        size="lg"
                        className="h-auto bg-white text-black hover:bg-gray-100 px-12 py-6 text-xl rounded-full font-bold tracking-wide transition-all transform hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                        onClick={onRegisterClick}
                    >
                        SECURE YOUR SEAT
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        className="h-auto border-white/20 text-white hover:bg-white/10 px-12 py-6 text-xl rounded-full tracking-wide backdrop-blur-sm transition-all hover:border-white/50"
                    >
                        WATCH TRAILER
                    </Button>
                </motion.div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2, duration: 1 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-30"
            >
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Scroll</span>
                <motion.div
                    animate={{ height: [0, 60, 0], y: [0, 0, 20] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-[1px] bg-gradient-to-b from-white to-transparent"
                />
            </motion.div>
        </section>
    );
};

export default Hero;
