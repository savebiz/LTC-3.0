import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RegisterModal from './components/RegisterModal';
import RegistrationSuccessPage from "./components/RegistrationSuccessPage";
import AdminPage from "./AdminPage";
import DebugPage from "./components/DebugPage";
import CheckStatus from "./components/CheckStatus";

// Sections
import Hero from '@/components/sections/Hero';
import Info from '@/components/sections/Info';
import Gallery from '@/components/sections/Gallery';
import Legacy from '@/components/sections/Legacy';
import Footer from '@/components/sections/Footer';

const App: React.FC = () => {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerTab, setRegisterTab] = useState<"delegate" | "volunteer">("delegate");

  const openRegister = () => {
    setRegisterTab("delegate");
    setIsRegisterOpen(true);
  };

  const openVolunteer = () => {
    setRegisterTab("volunteer");
    setIsRegisterOpen(true);
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div className="bg-black min-h-screen text-white font-sans selection:bg-orange-500/30">

            <Hero onRegisterClick={openRegister} onVolunteerClick={openVolunteer} />

            <Info />

            <Gallery />

            <Legacy />

            <Footer onRegisterClick={openRegister} onVolunteerClick={openVolunteer} />

            <RegisterModal
              open={isRegisterOpen}
              onOpenChange={setIsRegisterOpen}
              defaultTab={registerTab}
            />
          </div>
        } />
        <Route path="/registration-success" element={<RegistrationSuccessPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/debug-env" element={<DebugPage />} />
        <Route path="/check-status" element={<CheckStatus />} />
      </Routes>
    </Router>
  );
};

export default App;

