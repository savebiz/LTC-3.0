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
import { EVENT_DETAILS } from "@/constants";
import { useDialog } from "@/components/ui/DialogProvider";

interface RegisterModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultTab?: "delegate" | "volunteer";
}

export default function RegisterModal({ open, onOpenChange, defaultTab = "delegate" }: RegisterModalProps) {
    const [activeTab, setActiveTab] = useState<"delegate">("delegate");
    const { toast } = useDialog();

    useEffect(() => {
        if (open) {
            // Always force delegate tab since volunteer is closed
            setActiveTab("delegate");
        }
    }, [open, defaultTab]);

    const [isLocked, setIsLocked] = useState(false);

    const reset = () => {
        setIsLocked(false);
        onOpenChange(false);
    }

    const handleVolunteerTabClick = () => {
        toast.info(
            'Volunteer Registration Closed',
            'Thank you for your interest in serving at C3TC T.I.M.E \'26! Volunteer registration is officially closed.'
        );
    };

    return (
        <Dialog open={open} onOpenChange={(open) => {
            if (!open) reset();
        }}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => {
            }}>
                <DialogHeader>
                    <DialogTitle>Secure Your Spot</DialogTitle>
                    <DialogDescription>
                        Join us for {EVENT_DETAILS.fullTheme}. Online registration closes Sept 13 (onsite registration opens Sept 19 at the venue).
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="delegate" value={activeTab} onValueChange={() => {/* Prevent tab switching */}} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-11 bg-[#f3f4f6] p-[4px] rounded-full md:inline-flex md:h-9 md:bg-muted md:p-1 md:rounded-lg">
                        <TabsTrigger 
                            value="delegate" 
                            className="w-full h-full rounded-full transition-all duration-150 ease-in-out flex items-center justify-center text-slate-500 font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.1)] md:w-auto md:h-auto md:rounded-md md:px-3 md:py-1 md:text-sm md:font-medium md:text-muted-foreground md:data-[state=active]:bg-background md:data-[state=active]:text-foreground md:data-[state=active]:shadow"
                        >
                            Delegate
                        </TabsTrigger>
                        <TabsTrigger 
                            value="volunteer" 
                            disabled
                            onClick={(e) => {
                                e.preventDefault();
                                handleVolunteerTabClick();
                            }}
                            onPointerDown={(e) => {
                                e.preventDefault();
                                handleVolunteerTabClick();
                            }}
                            className="w-full h-full rounded-full transition-all duration-150 ease-in-out flex items-center justify-center text-slate-400 font-medium cursor-not-allowed opacity-60 md:w-auto md:h-auto md:rounded-md md:px-3 md:py-1 md:text-sm md:font-medium md:text-muted-foreground gap-1.5"
                        >
                            Volunteer
                            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full leading-none">
                                Closed
                            </span>
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="delegate" className="py-4">
                        <DelegateRegistrationForm
                            onSuccess={reset}
                            onStepChange={(step) => setIsLocked(step !== 'form')}
                        />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
