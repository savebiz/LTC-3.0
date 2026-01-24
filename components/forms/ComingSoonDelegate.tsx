import { motion } from "framer-motion";
import { Sparkles, CalendarClock } from "lucide-react";

export function ComingSoonDelegate() {
    return (
        <div className="relative w-full overflow-hidden text-center perspective-1000">
            {/* Main Card Container - Darker background for better contrast */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative z-10 mx-auto overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/80 p-8 shadow-2xl backdrop-blur-xl sm:p-12 ring-1 ring-white/5"
            >
                {/* Background Dynamic Gradients - Reduced opacity significantly */}
                <div className="absolute inset-0 z-0 opacity-20">
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 1],
                            rotate: [0, 45, 0],
                        }}
                        transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                        className="absolute -top-[50%] -left-[50%] h-[200%] w-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(139,92,246,0.15)_120deg,rgba(249,115,22,0.15)_240deg,transparent_360deg)]"
                    />
                </div>

                {/* Internal Shimmer/Noise Texture Overlay */}
                <div className="absolute inset-0 z-0 bg-noise opacity-[0.05] mix-blend-overlay pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center space-y-8">
                    {/* Icon Container with Glow */}
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            delay: 0.2,
                        }}
                        className="relative group"
                    >
                        {/* Outer Glow Ring */}
                        <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-violet-600/20 to-orange-500/20 blur-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Icon Circle */}
                        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-black border border-white/10 shadow-lg ring-1 ring-white/5">
                            <Sparkles className="h-10 w-10 text-transparent bg-clip-text bg-gradient-to-tr from-violet-400 to-orange-400 fill-white/10" />
                        </div>
                    </motion.div>

                    {/* Text block */}
                    <div className="space-y-4 max-w-md">
                        <motion.h3
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-3xl font-bold tracking-tight text-white sm:text-4xl drop-shadow-lg"
                        >
                            Registration <br className="hidden sm:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-400">
                                Opening Soon
                            </span>
                        </motion.h3>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="text-lg text-zinc-300 leading-relaxed font-medium drop-shadow-md"
                        >
                            We're putting the final touches on an incredible experience. Get ready to define your future.
                        </motion.p>
                    </div>

                    {/* 'Check back later' Pill */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="inline-flex items-center space-x-2.5 rounded-full border border-white/10 bg-white/5 py-3 px-8 backdrop-blur-md ring-1 ring-white/10 shadow-lg hover:bg-white/10 hover:border-white/20 transition-all cursor-default"
                    >
                        <CalendarClock className="h-5 w-5 text-orange-400" />
                        <span className="text-sm font-semibold text-gray-100 tracking-wide">
                            Check back later
                        </span>
                    </motion.div>
                </div>
            </motion.div>

            {/* Bottom Glow Reflection - Reduced */}
            <div className="absolute -bottom-20 left-1/2 h-40 w-[60%] -translate-x-1/2 rounded-[100%] bg-violet-600/10 blur-3xl pointer-events-none" />
        </div>
    );
}
