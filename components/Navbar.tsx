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
    <nav className={`fixed top-0 left-0 w-full z-40 transition-all duration-300 ${isScrolled ? 'py-2 bg-background/95 backdrop-blur-md border-b-2 border-primary shadow-sm' : 'py-6 bg-transparent'}`}>
      <div className={`absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-600 via-purple-600 to-orange-500 ${isScrolled ? 'opacity-100' : 'opacity-0'} transition-opacity`}></div>
      <div className="container mx-auto px-6 flex justify-between items-center relative">
        <a href="#" className="flex items-center gap-3">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2">
            <img src="/logos/LTC_Logo.png" alt="LTC Logo" className="h-12 md:h-16 w-auto object-contain" />
          </div>
        </a>
        <div className="hidden md:flex items-center gap-8">
          <Button onClick={onRegisterClick} size="lg" className="rounded-full font-bold tracking-wider">REGISTER</Button>
        </div>
        <div className="md:hidden">
          <Button onClick={onRegisterClick} size="sm" className="rounded-full font-bold tracking-wider text-xs px-6">REGISTER</Button>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
