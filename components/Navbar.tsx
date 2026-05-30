import React, { useState, useEffect } from 'react';
import { EVENT_DETAILS } from '../constants';
import { Button } from '@/components/ui/button';
import { Menu, X, Clock, Ticket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavbarProps { onRegisterClick: () => void; }

const Navbar: React.FC<NavbarProps> = ({ onRegisterClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scrolling when drawer is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

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
            className={`${isScrolled 
              ? 'h-8 max-w-[45%] md:h-10 md:max-w-none' 
              : 'h-11 max-w-[50%] md:h-16 md:max-w-none'
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
            onClick={() => setIsMenuOpen(true)} 
            className={`p-2 focus:outline-none transition-colors ${
              isScrolled ? 'text-zinc-800' : 'text-zinc-200'
            }`}
            aria-label="Open Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Drawer + Overlay via AnimatePresence */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              {/* Left Overlay (50% Width) */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-y-0 left-0 w-1/2 bg-black/60 backdrop-blur-sm z-50 md:hidden cursor-pointer"
                onClick={() => setIsMenuOpen(false)}
              />

              {/* Right Drawer (50% Width) */}
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "tween", ease: "easeOut", duration: 0.25 }}
                className="fixed inset-y-0 right-0 w-1/2 bg-[#090d16] border-l border-orange-500/80 z-50 flex flex-col p-5 shadow-2xl md:hidden text-white overflow-y-auto"
              >
                {/* Header with Logo & Close Icon */}
                <div className="flex justify-between items-center mb-6 pr-2">
                  <img 
                    src="/logos/LTC_Logo_white.png" 
                    alt="C3TC Logo" 
                    className="h-7 w-auto object-contain"
                  />
                  <button 
                    onClick={() => setIsMenuOpen(false)} 
                    className="text-zinc-400 hover:text-white transition-colors p-1"
                    aria-label="Close Menu"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Divider Line */}
                <div className="border-t border-white/10 mb-6" />

                {/* Navigation Items */}
                <div className="flex flex-col gap-4">
                  <a 
                    href="/check-status"
                    onClick={() => setIsMenuOpen(false)}
                    className="h-14 flex items-center gap-3 px-4 rounded-xl text-sm font-bold tracking-wider text-zinc-300 hover:text-orange-500 hover:bg-orange-500/10 active:scale-98 transition-all"
                  >
                    <Clock className="w-5 h-5 text-orange-500" />
                    <span>Check Status</span>
                  </a>
                  
                  <button 
                    onClick={() => {
                      setIsMenuOpen(false);
                      onRegisterClick();
                    }}
                    className="h-14 flex items-center gap-3 px-4 rounded-xl text-sm font-bold tracking-wider text-zinc-300 hover:text-orange-500 hover:bg-orange-500/10 active:scale-98 transition-all text-left w-full"
                  >
                    <Ticket className="w-5 h-5 text-orange-500" />
                    <span>Register</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};
export default Navbar;
