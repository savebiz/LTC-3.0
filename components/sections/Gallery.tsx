import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { GALLERY_RECAP } from '../../../constants';

const Gallery: React.FC = () => {
    return (
        <section className="py-20 md:py-32 px-4 bg-zinc-950/50">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-end mb-16 px-4 border-l-2 border-orange-500 pl-6">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className="text-5xl md:text-8xl font-black font-heading tracking-tight mb-4 text-white">
                            Core <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-300">Memories</span>
                        </h2>
                        <p className="text-xl text-gray-400 max-w-md font-light">Fragments of time from our last convergence.</p>
                    </motion.div>
                    <Button variant="link" className="text-orange-400 hover:text-orange-300 text-lg group hidden md:flex">
                        View Full Gallery <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-3 md:grid-rows-2 gap-4 h-[150vh] md:h-[90vh]">
                    {GALLERY_RECAP.map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className={`relative group overflow-hidden rounded-2xl bg-zinc-900 ${i === 0 ? 'md:col-span-2 md:row-span-2' : ''
                                }`}
                        >
                            <img
                                src={item.url}
                                alt={item.caption}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 filter brightness-[0.7] group-hover:brightness-100"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                                <span className="text-orange-500 text-xs font-mono tracking-widest uppercase mb-2">LTC 2.0 Recap</span>
                                <h3 className="text-2xl font-bold font-heading text-white">{item.alt}</h3>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-8 flex justify-center md:hidden">
                    <Button variant="link" className="text-orange-400 hover:text-orange-300 text-lg group">
                        View Full Gallery <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            </div>
        </section>
    );
};

export default Gallery;
