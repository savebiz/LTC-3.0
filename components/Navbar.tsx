import React, { useState, useEffect } from 'react';
import { EVENT_DETAILS } from '../constants';
import { Button } from '@/components/ui/button';

interface NavbarProps { onRegisterClick: () => void; }

const Navbar: React.FC<NavbarProps> = ({ onRegisterClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasScrolledOnce, setHasScrolledOnce] = useState(false);
  const [isFirstReveal, setIsFirstReveal] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 40;
      setIsScrolled(scrolled);
      if (scrolled && !hasScrolledOnce) {
        setHasScrolledOnce(true);
        setIsFirstReveal(true);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasScrolledOnce]);

  useEffect(() => {
    if (isFirstReveal) {
      const timer = setTimeout(() => {
        setIsFirstReveal(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isFirstReveal]);

  return (
    <>
      {/* Inject one-shot keyframe animation style */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInSticky {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}} />

      <nav 
        className={`fixed top-0 left-0 w-full z-40 transition-all duration-300 ${
          isScrolled 
            ? 'py-2 bg-zinc-950/80 border-b border-white/10 shadow-sm md:bg-white/70 md:border-white/20' 
            : 'py-4 md:py-6 bg-transparent'
        }`}
        style={
          isScrolled 
            ? {
                WebkitBackdropFilter: 'blur(12px)',
                backdropFilter: 'blur(12px)',
                ...(isFirstReveal ? { animation: 'fadeInSticky 250ms ease-out forwards' } : {})
              } 
            : undefined
        }
      >
        <div className={`absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-600 via-purple-600 to-orange-500 ${isScrolled ? 'opacity-100' : 'opacity-0'} transition-opacity`}></div>

        <div className="container mx-auto px-6 flex justify-between items-center relative">
          {/* Desktop Logo Container */}
          <a href="#" className="hidden md:flex items-center gap-3">
            <div className="bg-white p-1 rounded-md shadow-sm transition-all duration-300 flex items-center justify-center">
              <img
                src="/logos/DTCE_Logo.png"
                alt="DTCE Logo"
                className={`w-auto object-contain transition-all duration-300 ${
                  isScrolled ? 'h-6 md:h-7' : 'h-10 md:h-12'
                }`}
              />
            </div>
            <div className={`w-[1px] transition-all duration-300 ${
              isScrolled 
                ? 'h-[20px] bg-zinc-700/30' 
                : 'h-[30px] bg-white/30'
            }`} />
            <img
              src={isScrolled ? "/logos/LTC_Logo.png" : "/logos/LTC_Logo_white.png"}
              alt="C3TC Logo"
              className={`w-auto object-contain transition-all duration-300 ${
                isScrolled ? 'h-8 md:h-9' : 'h-12 md:h-14'
              }`}
            />
          </a>

          {/* Mobile Left Side Logo Container */}
          <div className="flex md:hidden items-center">
            {isScrolled ? (
              <a href="#" className="flex items-center gap-2">
                <div className="bg-white p-0.5 rounded shadow-sm flex items-center justify-center">
                  <img
                    src="/logos/DTCE_Logo.png"
                    alt="DTCE Logo"
                    className="h-6 w-auto object-contain"
                  />
                </div>
                <div className="w-[1px] h-[16px] bg-white/20 self-center mx-1" />
                <img
                  src="/logos/LTC_Logo_white.png"
                  alt="C3TC Logo"
                  className="h-6 w-auto object-contain"
                />
              </a>
            ) : (
              <a href="#" className="bg-white p-1 rounded-md shadow-sm flex items-center justify-center">
                <img
                  src="/logos/DTCE_Logo.png"
                  alt="DTCE Logo"
                  className="h-10 w-auto object-contain"
                />
              </a>
            )}
          </div>

          {/* Desktop Navigation Items */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="/check-status"
              className={`font-bold tracking-wider text-sm transition-all hover:text-orange-500 hover:scale-105 ${isScrolled ? 'text-zinc-800' : 'text-zinc-200'}`}
            >
              CHECK STATUS
            </a>
            <Button onClick={onRegisterClick} size="lg" className="rounded-full font-bold tracking-wider">REGISTER</Button>
          </div>

          {/* Mobile Right Side Logo/Buttons */}
          <div className="flex md:hidden items-center">
            {isScrolled ? (
              <div className="flex items-center gap-2">
                <a
                  href="/check-status"
                  className="font-bold tracking-wider text-[11px] text-white hover:text-orange-500 transition-colors py-2 px-1"
                >
                  STATUS
                </a>
                <Button 
                  onClick={onRegisterClick} 
                  size="sm" 
                  className="rounded-full font-bold tracking-wider text-[10px] px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md active:scale-95 transition-all h-7"
                >
                  REGISTER
                </Button>
              </div>
            ) : (
              <a href="#">
                <img
                  src="/logos/LTC_Logo_white.png"
                  alt="C3TC Logo"
                  className="h-10 w-auto object-contain"
                />
              </a>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
