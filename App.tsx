import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const RegisterModal = lazy(() => import('./components/RegisterModal'));
const RegistrationSuccessPage = lazy(() => import('./components/RegistrationSuccessPage'));
const AdminPage = lazy(() => import('./AdminPage'));
const DebugPage = lazy(() => import('./components/DebugPage'));
const CheckStatus = lazy(() => import('./components/CheckStatus'));

// Sections
import Hero from '@/components/sections/Hero';
import Info from '@/components/sections/Info';
import Gallery from '@/components/sections/Gallery';
import Legacy from '@/components/sections/Legacy';
import Footer from '@/components/sections/Footer';

import { DialogProvider } from './components/ui/DialogProvider';

const PageLoader: React.FC = () => (
  <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
    <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
    <span className="text-xs font-mono text-gray-400">Loading...</span>
  </div>
);

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
    <DialogProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
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
            <Route path="/admin/checkin" element={<AdminPage initialPage="checkin" />} />
            <Route path="/admin/express-register" element={<AdminPage initialPage="express-register" />} />
            <Route path="/debug-env" element={<DebugPage />} />
            <Route path="/check-status" element={<CheckStatus />} />
          </Routes>
        </Suspense>
      </Router>
    </DialogProvider>
  );
};

export default App;

