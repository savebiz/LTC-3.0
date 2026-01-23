import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RegisterModal from './components/RegisterModal';
import RegistrationSuccessPage from "./components/RegistrationSuccessPage";
import AdminPage from "./AdminPage";

// Sections
import Hero from '@/components/sections/Hero';
import Info from '@/components/sections/Info';
import Gallery from '@/components/sections/Gallery';
import Legacy from '@/components/sections/Legacy';
import Footer from '@/components/sections/Footer';

const App: React.FC = () => {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div className="bg-black min-h-screen text-white font-sans selection:bg-orange-500/30">

            <Hero onRegisterClick={() => setIsRegisterOpen(true)} />

            <Info />

            <Gallery />

            <Legacy />

            <Footer />

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

