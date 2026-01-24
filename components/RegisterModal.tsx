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
import { EVENT_DETAILS } from "@/constants";

interface RegisterModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultTab?: "delegate" | "volunteer";
}

export default function RegisterModal({ open, onOpenChange, defaultTab = "delegate" }: RegisterModalProps) {
    const [activeTab, setActiveTab] = useState(defaultTab);


    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (open) {
            setActiveTab(defaultTab);
        }
    }, [open, defaultTab]);

    const handleSuccess = () => {
        setSuccess(true);
        // Optional: Close after a delay or show success screen
        // For now, we remain open to show 'success' state, but let's just close it for simplicity or switch content.
        // Actually, showing a success message inside the modal is better.
    };

    const [isLocked, setIsLocked] = useState(false);

    const reset = () => {
        setSuccess(false);
        setIsLocked(false);
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={(open) => {
            // Prevent closing if locked (optional, but good UX to warn or allow closing but not switching)
            // For now, we allow closing but reset everything.
            if (!open) reset();
        }}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => {
                // Prevent outside click close if locked to avoid accidental data loss? 
                // User asked for tab locking, not modal locking. Let's keep modal closeable for now.
            }}>
                {success ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <DialogTitle>Registration Successful!</DialogTitle>
                        <DialogDescription>
                            Welcome to {EVENT_DETAILS.shortName}. We have sent a confirmation email to you.
                        </DialogDescription>
                        <button onClick={reset} className="text-sm text-primary underline">Close</button>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Secure Your Spot</DialogTitle>
                            <DialogDescription>
                                Join us for {EVENT_DETAILS.fullTheme}. Register as a delegate or join the workforce.
                            </DialogDescription>
                        </DialogHeader>
                        <Tabs defaultValue="delegate" value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="delegate" disabled={isLocked && activeTab !== "delegate"}>Delegate</TabsTrigger>
                                <TabsTrigger value="volunteer" disabled={isLocked && activeTab !== "volunteer"}>Volunteer</TabsTrigger>
                            </TabsList>
                            <TabsContent value="delegate">
                                <DelegateRegistrationForm
                                    onSuccess={handleSuccess}
                                    onStepChange={(step) => setIsLocked(step !== 'form')}
                                />
                            </TabsContent>
                            <TabsContent value="volunteer">
                                <VolunteerRegistrationForm onSuccess={handleSuccess} />
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
