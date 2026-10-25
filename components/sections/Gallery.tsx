import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Instagram, ExternalLink } from 'lucide-react';
import { GALLERY_RECAP } from '@/constants';

const Gallery: React.FC = () => {
    return (
        <section className="py-20 md:py-32 px-4 bg-zinc-950/50">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-end mb-10 md:mb-16 px-2 md:px-4 border-l-2 border-orange-500 pl-4 md:pl-6">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className="text-4xl md:text-8xl font-black font-heading tracking-tight mb-2 md:mb-4 text-white">
                            Core <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-300">Memories</span>
                        </h2>
                        <p className="text-base md:text-xl text-gray-400 max-w-md font-light">Fragments of time from our last convergence.</p>
                        <div className="inline-flex items-center gap-2 mt-4 bg-white/5 border border-white/10 text-zinc-300 px-3.5 py-1.5 rounded-full text-xs font-mono">
                            <span className="text-orange-400 font-bold">OFFICIAL MEDIA ARCHIVE</span>
                            <span className="text-zinc-600">|</span>
                            <span>Full Livestream & Official Reel Available</span>
                        </div>
                    </motion.div>
                    <a
                        href="https://www.instagram.com/rccg.c3tc/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden md:flex"
                    >
                        <Button variant="link" className="text-orange-400 hover:text-orange-300 text-lg group">
                            See More Images <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </a>
                </div>

                {/* Media Showcase: YouTube Livestream & Instagram Reel */}
                <div className="mb-12 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 16:9 YouTube Livestream Embed Player (Takes 2 cols on lg) */}
                        <div className="lg:col-span-2 relative rounded-3xl overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl">
                            <div className="relative w-full pt-[56.25%]">
                                <iframe
                                    src="https://www.youtube-nocookie.com/embed/ZCQCEWcHXzA"
                                    title="C3TC '26 Full Livestream Replay"
                                    className="absolute inset-0 w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                />
                            </div>
                            <div className="p-4 sm:p-5 bg-zinc-900/80 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/5">
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-white font-heading">
                                        C3TC '26 Full Livestream Replay
                                    </h3>
                                    <p className="text-xs text-zinc-400">
                                        Live from Glory Arena, Redemption City • Over 5,000 gathered
                                    </p>
                                </div>
                                <a
                                    href="https://www.youtube.com/live/ZCQCEWcHXzA"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-xs gap-1.5 shrink-0">
                                        <ExternalLink className="w-3.5 h-3.5" /> Open on YouTube
                                    </Button>
                                </a>
                            </div>
                        </div>

                        {/* Official Instagram Reel Showcase Card */}
                        <div className="flex flex-col justify-between p-6 sm:p-8 rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
                            
                            <div className="space-y-4 relative z-10">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-mono font-bold">
                                    <Instagram className="w-3.5 h-3.5" />
                                    <span>OFFICIAL REEL</span>
                                </div>
                                <h3 className="text-2xl font-black text-white font-heading leading-tight">
                                    The Energy, Praise & Moments Captured
                                </h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    Watch the viral recap reel on Instagram highlighting the atmosphere, choreography, and spiritual impact of C3TC '26.
                                </p>
                            </div>

                            <div className="pt-6 relative z-10">
                                <a
                                    href="https://www.instagram.com/reel/DettbnYti8w/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                >
                                    <Button className="w-full bg-gradient-to-r from-pink-600 via-purple-600 to-orange-500 hover:opacity-90 text-white rounded-2xl font-bold py-6 gap-2 shadow-lg shadow-pink-500/20 text-sm">
                                        <Play className="w-4 h-4 fill-current" /> Watch Reel on Instagram
                                    </Button>
                                </a>
                                <p className="text-[11px] text-zinc-500 text-center mt-2.5 font-mono">
                                    Follow @rccg.c3tc for full photo drops
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 h-auto md:h-[90vh]">
                    {GALLERY_RECAP.map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className={`relative group overflow-hidden rounded-2xl bg-zinc-900 min-h-[250px] md:min-h-0 ${i === 0 ? 'md:col-span-2 md:row-span-2 h-[300px] md:h-auto' : ''
                                }`}
                        >
                            <img
                                src={item.url}
                                alt={item.caption}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 filter brightness-[0.7] group-hover:brightness-100"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6 md:p-8">
                                <span className="text-orange-500 text-[10px] md:text-xs font-mono tracking-widest uppercase mb-1 md:mb-2">LTC 2.0 Recap</span>
                                <h3 className="text-lg md:text-2xl font-bold font-heading text-white">{item.caption}</h3>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-8 flex justify-center md:hidden">
                    <a
                        href="https://www.instagram.com/rccg.c3tc/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button variant="link" className="text-orange-400 hover:text-orange-300 text-lg group">
                            See More Images <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </a>
                </div>
            </div>
        </section>
    );
};

export default Gallery;
