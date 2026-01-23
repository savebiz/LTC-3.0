
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import RegisterModal from './components/RegisterModal';
import RegistrationSuccessPage from "./components/RegistrationSuccessPage";
import AdminPage from "./AdminPage";
import { GALLERY_RECAP, EVENT_DETAILS, LINKS } from './constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const App: React.FC = () => {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div className="bg-black min-h-screen text-white font-sans selection:bg-orange-500/30">
            {/* HERO SECTION */}
            <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
              {/* Video Background */}
              <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay pointer-events-none">
                <source src="/videos/hero-reel.mp4" type="video/mp4" />
              </video>

              <Navbar onRegisterClick={() => setIsRegisterOpen(true)} />

              {/* Content */}
              <div className="relative z-10 text-center space-y-8 px-4 mt-20">
                <div className="inline-flex items-center space-x-2 bg-black/60 border border-white/10 rounded-full px-4 py-1.5 mb-6 backdrop-blur-md animate-fade-in-down">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                  <span className="text-gray-300 text-sm tracking-widest font-medium">ROMANS 13:11</span>
                </div>

                <div className="relative flex items-center justify-center">
                  <h1 className="text-[12rem] md:text-[16rem] leading-none font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500 font-heading select-none filter drop-shadow-2xl relative z-10">
                    T.I.M.E
                  </h1>

                  {/* '26 Badge */}
                  <div className="absolute top-4 right-4 md:-right-8 lg:-right-16 rotate-12 bg-orange-500 text-black font-black text-4xl md:text-6xl px-4 py-2 rounded-lg transform hover:rotate-0 transition-transform duration-300 cursor-default shadow-lg border-4 border-white/20 z-20">
                    '26
                  </div>

                  <div className="absolute -top-10 -right-10 w-64 h-64 bg-orange-500/20 rounded-full blur-[100px] animate-pulse"></div>
                  <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
                </div>

                <p className="text-2xl md:text-3xl font-light text-gray-300 tracking-[0.5em] uppercase animate-fade-in-up">
                  The Incredible Me Emerging
                </p>

                <div className="pt-8 flex flex-col md:flex-row items-center justify-center gap-6">
                  <Button
                    size="lg"
                    className="bg-white text-black hover:bg-gray-200 px-10 py-7 text-lg rounded-full font-bold tracking-wide transition-all transform hover:scale-105"
                    onClick={() => setIsRegisterOpen(true)}
                  >
                    SECURE YOUR SEAT
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white/20 text-white hover:bg-white/10 px-10 py-7 text-lg rounded-full tracking-wide backdrop-blur-sm"
                  >
                    WATCH TRAILER
                  </Button>
                </div>
              </div>

              {/* Scroll Indicator */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50 animate-bounce">
                <span className="text-[10px] uppercase tracking-widest">Scroll</span>
                <div className="w-[1px] h-12 bg-gradient-to-b from-white to-transparent"></div>
              </div>
            </section>

            {/* INFO SECTION */}
            <section className="py-32 px-4 relative">
              <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-900/50 to-black pointer-events-none"></div>
              <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                {[
                  { title: "DATE", value: EVENT_DETAILS.date, icon: "📅" },
                  { title: "VENUE", value: EVENT_DETAILS.venue, icon: "📍" },
                  { title: "THEME", value: "The Incredible Me Emerging", icon: "✨" }
                ].map((item, i) => (
                  <div key={i} className="group p-8 border-t border-white/10 hover:border-orange-500/50 transition-colors duration-500">
                    <span className="text-2xl mb-4 block filter grayscale group-hover:grayscale-0 transition-all">{item.icon}</span>
                    <h3 className="text-gray-500 text-sm tracking-widest mb-2">{item.title}</h3>
                    <p className="text-2xl md:text-3xl font-heading font-bold text-white group-hover:text-orange-400 transition-colors">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* GALLERY SECTION (Cinematic Bento Grid) */}
            <section className="py-32 px-4 bg-zinc-950/50">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-end mb-16 px-4 border-l-2 border-orange-500 pl-6">
                  <div>
                    <h2 className="text-5xl md:text-7xl font-black font-heading tracking-tight mb-4">Core Memories</h2>
                    <p className="text-xl text-gray-400 max-w-md">Fragments of time from our last convergence.</p>
                  </div>
                  <Button variant="link" className="text-orange-400 hover:text-orange-300 text-lg group">
                    View Full Gallery <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[120vh] md:h-[80vh]">
                  {GALLERY_RECAP.map((item, i) => (
                    <div
                      key={i}
                      className={`relative group overflow-hidden rounded-sm ${i === 0 ? 'md:col-span-2 md:row-span-2' : ''
                        }`}
                    >
                      <img
                        src={item.url}
                        alt={item.caption}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 filter brightness-75 group-hover:brightness-100"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                        <span className="text-orange-500 text-xs tracking-widest uppercase mb-2">LTC 2.0 Recap</span>
                        <h3 className="text-2xl font-bold font-heading">{item.alt}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* OUR LEGACY / ABOUT */}
            <section className="py-32 px-4 flex items-center justify-center min-h-[50vh]">
              <div className="max-w-4xl mx-auto text-center space-y-8">
                <h2 className="text-4xl md:text-6xl font-bold font-heading">A Legacy of <span className="text-transparent bg-clip-text bg-gradient-brand">Excellence</span></h2>
                <p className="text-xl text-gray-400 leading-relaxed">
                  Lagos Teens Conference is more than an event; it's a movement.
                  For over a decade, we have been shaping the minds that will shape the future.
                </p>
              </div>
            </section>

            {/* FOOTER */}
            <footer className="border-t border-white/10 py-20 px-4">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-center md:text-left">
                  <h4 className="text-2xl font-black font-heading text-gradient-brand">LTC 3.0</h4>
                  <p className="text-gray-500 text-sm mt-2">© 2026 Lagos Teens Conference</p>
                </div>
                <div className="flex gap-8 text-sm text-gray-400">
                  {LINKS.map(link => (
                    <a key={link.label} href={link.url} className="hover:text-white transition-colors uppercase tracking-widest text-xs">{link.label}</a>
                  ))}
                </div>
              </div>
            </footer>

            <RegisterModal open={isRegisterOpen} onOpenChange={setIsRegisterOpen} />
          </div>
        } />
        <Route path="/registration-success" element={<RegistrationSuccessPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
};

export default App;
