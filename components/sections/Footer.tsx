import React from 'react';
import { LINKS, SOCIAL_LINKS } from '@/constants';
import { Instagram, Facebook, Twitter, Music } from 'lucide-react';

interface FooterProps {
    onRegisterClick: () => void;
    onVolunteerClick: () => void;
}

const Footer: React.FC<FooterProps> = ({ onRegisterClick, onVolunteerClick }) => {
    const getIcon = (name: string) => {
        switch (name) {
            case 'Instagram': return <Instagram className="w-5 h-5" />;
            case 'Facebook': return <Facebook className="w-5 h-5" />;
            case 'Twitter': return <Twitter className="w-5 h-5" />; // Lucide Twitter is bird, X icon likely needs custom svg but Twitter icon is recognized.
            case 'Tiktok': return <Music className="w-5 h-5" />; // Using Music as fallback for Tiktok
            default: return null;
        }
    };

    return (
        <footer className="border-t border-white/5 py-20 px-4 bg-black">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
                <div className="text-center md:text-left">
                    <h4 className="text-3xl font-black font-heading text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-orange-500">LTC 3.0</h4>
                    <div className="flex gap-6 mt-6 justify-center md:justify-start">
                        {SOCIAL_LINKS.map(link => (
                            <a
                                key={link.label}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                {getIcon(link.icon || "")}
                            </a>
                        ))}
                    </div>
                    <p className="text-zinc-500 text-sm mt-6">© 2026 Lagos Teens Conference. All rights reserved.</p>
                </div>

                <div className="flex flex-wrap justify-center gap-8 md:gap-12 text-sm text-gray-500">
                    {LINKS.map(link => {
                        const isAction = link.label === "Register" || link.label === "Volunteer";
                        const handleClick = (e: React.MouseEvent) => {
                            if (link.label === "Register") {
                                e.preventDefault();
                                onRegisterClick();
                            } else if (link.label === "Volunteer") {
                                e.preventDefault();
                                onVolunteerClick();
                            }
                        };

                        return isAction ? (
                            <button
                                key={link.label}
                                onClick={handleClick}
                                className="hover:text-white transition-colors uppercase tracking-[0.2em] text-xs font-medium bg-transparent border-none cursor-pointer"
                            >
                                {link.label}
                            </button>
                        ) : (
                            <a
                                key={link.label}
                                href={link.url}
                                className="hover:text-white transition-colors uppercase tracking-[0.2em] text-xs font-medium"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {link.label}
                            </a>
                        );
                    })}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
