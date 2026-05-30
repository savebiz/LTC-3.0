import React, { useState, useEffect } from 'react';
import { EVENT_DETAILS } from '../constants';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface NavbarProps { onRegisterClick: () => void; }

const Navbar: React.FC<NavbarProps> = ({ onRegisterClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      
      {/* Click overlay to close mobile dropdown */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-transparent w-screen h-screen md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <div className="container mx-auto px-6 flex justify-between items-center relative">
        <a href="#" className="flex items-center gap-3">
          <img
            src={isScrolled ? "/logos/LTC_Logo.png" : "/logos/LTC_Logo_white.png"}
            alt="C3TC Logo"
            className={`${isScrolled 
              ? 'h-6 max-w-[45%] md:h-10 md:max-w-none' 
              : 'h-8 max-w-[50%] md:h-16 md:max-w-none'
            } w-auto object-contain transition-all duration-300`}
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

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center z-50">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }} 
            className={`p-2 focus:outline-none transition-colors ${
              isScrolled ? 'text-zinc-800' : 'text-zinc-200'
            }`}
            aria-label="Toggle Menu"
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute top-16 right-6 w-48 bg-black/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl z-40 animate-in fade-in slide-in-from-top-3 duration-200 flex flex-col gap-2 md:hidden">
            <a 
              href="/check-status"
              className="w-full text-left px-4 py-3 text-sm font-bold tracking-wider text-zinc-200 hover:text-orange-500 hover:bg-white/5 rounded-xl transition-all"
              onClick={() => setIsMenuOpen(false)}
            >
              Status
            </a>
            <button 
              onClick={() => {
                setIsMenuOpen(false);
                onRegisterClick();
              }}
              className="w-full text-left px-4 py-3 text-sm font-bold tracking-wider text-zinc-200 hover:text-orange-500 hover:bg-white/5 rounded-xl transition-all"
            >
              Register
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
export default Navbar;
