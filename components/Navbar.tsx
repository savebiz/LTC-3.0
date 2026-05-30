import React, { useState, useEffect } from 'react';
import { EVENT_DETAILS } from '../constants';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface NavbarProps { onRegisterClick: () => void; }

const Navbar: React.FC<NavbarProps> = ({ onRegisterClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 left-0 w-full z-40 transition-all duration-300 ${isScrolled ? 'py-2 bg-white/70 border-b border-white/20 shadow-sm' : 'py-6 bg-transparent'}`}
      style={isScrolled ? {
        WebkitBackdropFilter: 'blur(12px)',
        backdropFilter: 'blur(12px)'
      } : undefined}
    >
      <div className={`absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-600 via-purple-600 to-orange-500 ${isScrolled ? 'opacity-100' : 'opacity-0'} transition-opacity`}></div>
      <div className="container mx-auto px-6 flex justify-between items-center relative">
        <a href="#" className="flex items-center gap-3">
          <img
            src={isScrolled ? "/logos/LTC_Logo.png" : "/logos/LTC_Logo_white.png"}
            alt="C3TC Logo"
            className={`${isScrolled ? 'h-8 md:h-10' : 'h-12 md:h-16'} w-auto object-contain transition-all duration-300`}
          />
        </a>
        <div className="hidden md:flex items-center gap-8">
          <a
            href="/check-status"
            className={`font-bold tracking-wider text-sm transition-all hover:text-orange-500 hover:scale-105 ${isScrolled ? 'text-zinc-800' : 'text-zinc-200'}`}
          >
            CHECK STATUS
          </a>
          <Button onClick={onRegisterClick} size="lg" className="rounded-full font-bold tracking-wider">REGISTER</Button>
        </div>
        <div className="md:hidden flex items-center gap-4">
          <a
            href="/check-status"
            className={`font-bold tracking-wider text-xs transition-all hover:text-orange-500 ${isScrolled ? 'text-zinc-800' : 'text-zinc-200'}`}
          >
            STATUS
          </a>
          <Button onClick={onRegisterClick} size="sm" className="rounded-full font-bold tracking-wider text-xs px-4">REGISTER</Button>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
