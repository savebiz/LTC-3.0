import React from 'react';
import { LINKS } from '@/constants';

const Footer: React.FC = () => {
    return (
        <footer className="border-t border-white/5 py-20 px-4 bg-black">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
                <div className="text-center md:text-left">
                    <h4 className="text-3xl font-black font-heading text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-orange-500">LTC 3.0</h4>
                    <p className="text-zinc-500 text-sm mt-3">© 2026 Lagos Teens Conference. All rights reserved.</p>
                </div>

                <div className="flex flex-wrap justify-center gap-8 md:gap-12 text-sm text-gray-500">
                    {LINKS.map(link => (
                        <a
                            key={link.label}
                            href={link.url}
                            className="hover:text-white transition-colors uppercase tracking-[0.2em] text-xs font-medium"
                        >
                            {link.label}
                        </a>
                    ))}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
