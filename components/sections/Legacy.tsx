import React from 'react';
import { motion } from 'framer-motion';

const Legacy: React.FC = () => {
    return (
        <section className="py-20 md:py-32 px-4 flex items-center justify-center min-h-[50vh] md:min-h-[60vh] relative overflow-hidden">
            {/* Background typographic elements */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                <span className="text-[20vw] font-black font-heading text-white leading-none">LEGACY</span>
            </div>

            <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-10 relative z-10">
                <motion.h2
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-3xl md:text-7xl font-bold font-heading text-white"
                >
                    A Legacy of <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500">Excellence</span>
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-base md:text-2xl text-gray-400 leading-relaxed font-light px-4"
                >
                    Lagos Teens Conference is more than an event; it's a divine encounter with purpose.
                    We empower teens with vision, faith, and courage to rise, lead, and make lasting impact. <span className="text-white font-medium">Your journey to greatness begins here. Be part of the movement</span>.
                </motion.p>
            </div>
        </section>
    );
};

export default Legacy;
