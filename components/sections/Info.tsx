import React from 'react';
import { motion } from 'framer-motion';
import { EVENT_DETAILS } from '@/constants';
import { Calendar, MapPin, Sparkles } from 'lucide-react';

const Info: React.FC = () => {

    const items = [
        { title: "DATE", value: EVENT_DETAILS.date, icon: Calendar, color: "text-blue-400" },
        { title: "VENUE", value: EVENT_DETAILS.venue, icon: MapPin, color: "text-purple-400" },
        { title: "THEME", value: "The Incredible Me Emerging", icon: Sparkles, color: "text-orange-400" }
    ];

    return (
        <section className="py-20 md:py-32 px-4 relative bg-background">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {items.map((item, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ delay: i * 0.1, duration: 0.6 }}
                        whileHover={{ y: -5, transition: { duration: 0.2 } }}
                        className="group relative p-8 md:p-10 rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-xl overflow-hidden hover:bg-zinc-800/40 transition-colors"
                    >
                        {/* Gradient Blob on Hover */}
                        <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${item.color === 'text-orange-400' ? 'from-orange-500/20' : item.color === 'text-blue-400' ? 'from-blue-500/20' : 'from-purple-500/20'} to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                        <item.icon className={`w-8 h-8 md:w-10 md:h-10 mb-6 ${item.color} opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300`} />

                        <h3 className="text-gray-500 text-xs font-mono tracking-widest mb-3 uppercase">{item.title}</h3>
                        <p className="text-2xl md:text-3xl font-heading font-bold text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all">
                            {item.value}
                        </p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
};

export default Info;
