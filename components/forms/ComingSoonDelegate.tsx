import { motion } from "framer-motion";
import { Sparkles, CalendarClock } from "lucide-react";

export function ComingSoonDelegate() {
    return (
        <div className="relative w-full overflow-hidden text-center perspective-1000">
            {/* Main Card Container with Glassmorphism */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative z-10 mx-auto overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-xl sm:p-12"
            >
                {/* Background Dynamic Gradients */}
                <div className="absolute inset-0 z-0 opacity-30">
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                        }}
                        transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                        className="absolute -top-[50%] -left-[50%] h-[200%] w-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(168,85,247,0.2)_120deg,rgba(249,115,22,0.2)_240deg,transparent_360deg)]"
                    />
                </div>

                {/* Internal Shimmer/Noise Texture Overlay (Optional subtle texture) */}
                <div className="absolute inset-0 z-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none" />

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
                        className="relative"
                    >
                        {/* Outer Glow Ring */}
                        <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-violet-600/30 to-orange-500/30 blur-xl animate-pulse" />

                        {/* Icon Circle */}
                        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-white/10 shadow-inner">
                            <Sparkles className="h-10 w-10 text-transparent bg-clip-text bg-gradient-to-tr from-violet-400 to-orange-400 fill-white/10" />
                        </div>
                    </motion.div>

                    {/* Text block */}
                    <div className="space-y-4 max-w-md">
                        <motion.h3
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                        >
                            Registration <br className="hidden sm:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-400 drop-shadow-sm">
                                Opening Soon
                            </span>
                        </motion.h3>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="text-lg text-white/60 leading-relaxed"
                        >
                            We're putting the final touches on an incredible experience. Get ready to define your future.
                        </motion.p>
                    </div>

                    {/* 'Check back later' Pill */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="inline-flex items-center space-x-2.5 rounded-full border border-white/5 bg-white/5 py-2.5 px-6 backdrop-blur-md ring-1 ring-white/10 shadow-lg hover:bg-white/10 transition-colors"
                    >
                        <CalendarClock className="h-5 w-5 text-orange-400" />
                        <span className="text-sm font-medium text-gray-200">
                            Check back later
                        </span>
                    </motion.div>
                </div>
            </motion.div>

            {/* Bottom Glow Reflection */}
            <div className="absolute -bottom-20 left-1/2 h-40 w-[80%] -translate-x-1/2 rounded-[100%] bg-violet-500/20 blur-3xl" />
        </div>
    );
}
