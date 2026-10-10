import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DelegateRegistrationForm } from "./forms/DelegateRegistrationForm";
import { VolunteerRegistrationForm } from "./forms/VolunteerRegistrationForm";
import { EVENT_DETAILS, IS_VOLUNTEER_REGISTRATION_CLOSED, isRegistrationClosed } from "@/constants";

interface RegisterModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultTab?: "delegate" | "volunteer";
}

export default function RegisterModal({ open, onOpenChange, defaultTab = "delegate" }: RegisterModalProps) {
    const [activeTab, setActiveTab] = useState<"delegate" | "volunteer">(defaultTab);

    useEffect(() => {
        if (open) {
            setActiveTab(defaultTab);
        }
    }, [open, defaultTab]);

    const [isLocked, setIsLocked] = useState(false);

    const reset = () => {
        setIsLocked(false);
        onOpenChange(false);
    }

    // Automated shutdown after deadline passes (Sunday, Oct 11, 11:59 PM WAT)
    if (isRegistrationClosed()) {
        return (
            <Dialog open={open} onOpenChange={(open) => {
                if (!open) reset();
            }}>
                <DialogContent className="sm:max-w-[540px] text-center py-8 px-6 space-y-6">
                    <div className="w-16 h-16 rounded-full bg-orange-500/10 border-2 border-orange-500/20 text-orange-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                        🔒
                    </div>
                    <div className="space-y-2">
                        <DialogTitle className="text-2xl font-bold font-heading text-slate-900">
                            Online Registration Closed
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                            Online registration for <strong>{EVENT_DETAILS.name} ({EVENT_DETAILS.shortName})</strong> closed on <strong>Sunday, October 11, 2026 at 11:59 PM WAT</strong>.
                        </DialogDescription>
                    </div>

                    <div className="p-4 bg-orange-50 border border-orange-200/60 rounded-2xl text-left text-xs text-slate-700 space-y-1.5 shadow-sm">
                        <p className="font-bold text-orange-600 uppercase tracking-wider text-[11px]">🏟️ Onsite Registration Available:</p>
                        <p className="leading-relaxed">
                            If you missed online registration, onsite registration will open on <strong>Saturday, October 17, 2026</strong> at <strong>Glory Arena, Redemption City</strong>.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <a 
                            href="/check-status" 
                            className="flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white transition-colors text-center shadow-md flex items-center justify-center"
                        >
                            Check Registration Status
                        </a>
                        <button 
                            onClick={() => reset()} 
                            className="py-3 px-5 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={(open) => {
            if (!open) reset();
        }}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => {
            }}>
                <DialogHeader>
                    <DialogTitle>Secure Your Spot</DialogTitle>
                    <DialogDescription>
                        Join us for {EVENT_DETAILS.fullTheme}. Online registration closes Oct 11 (onsite registration opens Oct 17 at the venue).
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="delegate" value={activeTab} onValueChange={(val) => setActiveTab(val as "delegate" | "volunteer")} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-11 bg-[#f3f4f6] p-[4px] rounded-full md:inline-flex md:h-9 md:bg-muted md:p-1 md:rounded-lg">
                        <TabsTrigger 
                            value="delegate" 
                            disabled={isLocked && activeTab !== "delegate"}
                            className="w-full h-full rounded-full transition-all duration-150 ease-in-out flex items-center justify-center text-slate-500 font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.1)] md:w-auto md:h-auto md:rounded-md md:px-3 md:py-1 md:text-sm md:font-medium md:text-muted-foreground md:data-[state=active]:bg-background md:data-[state=active]:text-foreground md:data-[state=active]:shadow"
                        >
                            Delegate
                        </TabsTrigger>
                        <TabsTrigger 
                            value="volunteer" 
                            disabled={isLocked && activeTab !== "volunteer"}
                            className="w-full h-full rounded-full transition-all duration-150 ease-in-out flex items-center justify-center text-slate-500 font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.1)] md:w-auto md:h-auto md:rounded-md md:px-3 md:py-1 md:text-sm md:font-medium md:text-muted-foreground md:data-[state=active]:bg-background md:data-[state=active]:text-foreground md:data-[state=active]:shadow"
                        >
                            Volunteer {IS_VOLUNTEER_REGISTRATION_CLOSED && <span className="ml-1 text-[10px] opacity-75 font-normal">(Closed)</span>}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="delegate" className="py-4">
                        <DelegateRegistrationForm
                            onSuccess={reset}
                            onStepChange={(step) => setIsLocked(step !== 'form')}
                        />
                    </TabsContent>
                    <TabsContent value="volunteer" className="py-4">
                        <VolunteerRegistrationForm 
                            onSuccess={reset} 
                            onSwitchToDelegate={() => setActiveTab("delegate")}
                        />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
