import React from 'react';
import { motion } from 'framer-motion';
import { EVENT_DETAILS } from '@/constants';
import { Calendar, MapPin, Sparkles } from 'lucide-react';

const Info: React.FC = () => {

    const items = [
        {
            title: "DATE",
            value: EVENT_DETAILS.date,
            icon: Calendar,
            gradient: "from-blue-500/20 to-blue-900/5",
            border: "group-hover:border-blue-500/50",
            iconColor: "text-blue-500",
            glow: "bg-blue-500/10"
        },
        {
            title: "VENUE",
            value: EVENT_DETAILS.venue,
            icon: MapPin,
            gradient: "from-purple-500/20 to-purple-900/5",
            border: "group-hover:border-purple-500/50",
            iconColor: "text-purple-500",
            glow: "bg-purple-500/10"
        },
        {
            title: "THEME",
            value: "The Incredible Me Emerging",
            icon: Sparkles,
            gradient: "from-orange-500/20 to-orange-900/5",
            border: "group-hover:border-orange-500/50",
            iconColor: "text-orange-500",
            glow: "bg-orange-500/10"
        }
    ];

    return (
        <section className="py-20 md:py-32 px-4 relative bg-black overflow-hidden">
            {/* Background Texture */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none" />

            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {items.map((item, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ delay: i * 0.1, duration: 0.6 }}
                        className={`group relative h-full flex flex-col justify-between p-8 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl transition-all duration-300 ${item.border}`}
                    >
                        {/* Internal Glow */}
                        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                        {/* Ambient Glow (Always Visible) */}
                        <div className={`absolute -right-20 -top-20 w-60 h-60 rounded-full blur-[80px] ${item.glow} opacity-30 group-hover:opacity-60 transition-opacity duration-500`} />

                        <div className="relative z-10 flex flex-col h-full gap-8">
                            <div className="flex justify-between items-start">
                                <span className={`p-4 rounded-xl bg-white/5 border border-white/5 ${item.iconColor}/20`}>
                                    <item.icon className={`w-6 h-6 ${item.iconColor}`} />
                                </span>
                                {/* Gigantic Background Watermark Icon */}
                                <item.icon className={`absolute -bottom-6 -right-6 w-48 h-48 opacity-5 -rotate-12 ${item.iconColor}`} />
                            </div>

                            <div>
                                <h3 className={`text-xs font-mono tracking-[0.2em] font-bold mb-3 uppercase ${item.iconColor}`}>{item.title}</h3>
                                <p className="text-2xl md:text-3xl font-heading font-bold text-white leading-tight">
                                    {item.value}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
};

export default Info;
