import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';

interface HeroProps {
    onRegisterClick: () => void;
    onVolunteerClick: () => void;
}

const Hero: React.FC<HeroProps> = ({ onRegisterClick, onVolunteerClick }) => {
    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black">
            {/* Video Background */}
            <div className="absolute inset-0 w-full h-full">
                {/* Dark overlay for text readability */}
                <div className="absolute inset-0 bg-black/50 z-10" />
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover opacity-60"
                >
                    <source src="/videos/hero-reel.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 z-20" />
            </div>

            <Navbar onRegisterClick={onRegisterClick} />

            {/* Content */}
            <div className="relative z-30 text-center space-y-6 md:space-y-8 px-4 mt-20 max-w-7xl mx-auto w-full">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="inline-flex items-center space-x-3 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 md:px-5 md:py-2 backdrop-blur-md"
                >
                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-gray-300 text-[10px] md:text-sm tracking-[0.2em] font-medium font-mono">ROMANS 13:11</span>
                </motion.div>

                <div className="relative flex items-center justify-center py-6 md:py-10">
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="text-[18vw] md:text-[14rem] lg:text-[18rem] leading-[0.8] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500 font-heading select-none filter drop-shadow-2xl z-10"
                    >
                        T.I.M.E
                    </motion.h1>

                    {/* '26 Badge */}
                    <motion.div
                        initial={{ opacity: 0, rotate: 0, scale: 0 }}
                        animate={{ opacity: 1, rotate: 12, scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.8 }}
                        className="absolute top-0 right-2 md:right-10 lg:right-20 rotate-12 bg-orange-500 text-black font-black text-2xl md:text-6xl px-2 py-1 md:px-4 md:py-2 rounded-md md:rounded-lg transform hover:rotate-0 transition-transform duration-300 cursor-default shadow-[0_0_30px_rgba(249,115,22,0.6)] border-2 md:border-4 border-white/20 z-20 font-heading"
                    >
                        '26
                    </motion.div>

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
                    The Incredible Me Emerging
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1 }}
                    className="pt-8 md:pt-12 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 w-full max-w-sm md:max-w-none mx-auto"
                >
                    <Button
                        size="lg"
                        className="w-full md:w-auto h-auto bg-white text-black hover:bg-gray-100 px-8 py-4 md:px-12 md:py-6 text-lg md:text-xl rounded-full font-bold tracking-wide transition-all transform hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                        onClick={onRegisterClick}
                    >
                        SECURE YOUR SEAT
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        className="w-full md:w-auto h-auto border-white/20 text-white bg-transparent hover:bg-white/10 px-8 py-4 md:px-12 md:py-6 text-lg md:text-xl rounded-full font-bold tracking-wide backdrop-blur-sm transition-all hover:border-white/50"
                        onClick={onVolunteerClick}
                    >
                        BECOME A VOLUNTEER
                    </Button>
                </motion.div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2, duration: 1 }}
                className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 md:gap-3 z-30"
            >
                <span className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] text-gray-400">Scroll</span>
                <motion.div
                    animate={{ height: [0, 40, 0], y: [0, 0, 20] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-[1px] bg-gradient-to-b from-white to-transparent"
                />
            </motion.div>
        </section>
    );
};

export default Hero;
