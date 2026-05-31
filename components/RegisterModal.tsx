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
import { ComingSoonDelegate } from "./forms/ComingSoonDelegate";
import { EVENT_DETAILS } from "@/constants";

interface RegisterModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultTab?: "delegate" | "volunteer";
}

export default function RegisterModal({ open, onOpenChange, defaultTab = "delegate" }: RegisterModalProps) {
    const [activeTab, setActiveTab] = useState(defaultTab);

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
                    <TabsContent value="delegate" className="py-4">
                        <DelegateRegistrationForm
                            onSuccess={reset}
                            onStepChange={(step) => setIsLocked(step !== 'form')}
                        />
                    </TabsContent>
                    <TabsContent value="volunteer">
                        <VolunteerRegistrationForm onSuccess={reset} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
