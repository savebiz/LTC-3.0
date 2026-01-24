"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { supabase } from "@/lib/supabase";
import { TEEN_ROLES, EXEC_LEVELS } from "@/constants"
import { REGIONS_AND_PROVINCES } from "../../constants";
import imageCompression from 'browser-image-compression';

const delegateSchema = z.object({
    fullName: z.string().min(2, { message: "Required" }),
    email: z.string().email(),
    phone: z.string().min(10),
    age: z.coerce.number().min(10).max(25),
    gender: z.enum(["Male", "Female"]),
    region: z.string().min(1, { message: "Select a region" }),
    province: z.string().min(1, { message: "Select a province" }),
    role: z.enum(["Member", "Worker", "Teens Executive"]),
    execLevel: z.enum(["Parish", "Zone", "Area", "Province", "Region"]).optional(),
    execPosition: z.string().optional(),
}).refine((data) => {
    if (data.role === "Teens Executive") {
        return !!data.execLevel && !!data.execPosition;
    }
    return true;
}, { message: "Level and Position required", path: ["execLevel"] });

export function DelegateRegistrationForm({ onSuccess, onStepChange }: {
    onSuccess: () => void;
    onStepChange?: (step: 'form' | 'payment' | 'upload') => void;
}) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [registrationData, setRegistrationData] = useState<any>(null); // Store reg data after initial save
    const [step, setStep] = useState<'form' | 'payment' | 'upload'>('form');
    const [uploading, setUploading] = useState(false);

    const form = useForm<z.infer<typeof delegateSchema>>({
        resolver: zodResolver(delegateSchema),
        defaultValues: { fullName: "", email: "", phone: "", age: 15, region: "", province: "", role: "Member" },
    })
    const watchRole = form.watch("role")
    const watchRegion = form.watch("region")

    // Update provinces when region changes
    const provinces = watchRegion ? REGIONS_AND_PROVINCES[watchRegion] || [] : []

    async function handleManualPaymentConfirmation() {
        setIsSubmitting(true);
        try {
            if (registrationData?.id) {
                // Update status to pending_verification
                const { error } = await supabase
                    .from('registrations')
                    .update({ status: 'pending_verification' })
                    .eq('id', registrationData.id);

                if (error) throw error;

                // Log payment attempt (optional, but good for tracking)
                await supabase.from('payments').insert([{
                    registration_id: registrationData.id,
                    amount: 2000,
                    provider: 'manual_transfer',
                    reference: `MANUAL-${Date.now()}`,
                    status: 'pending'
                }]);
            }
            setStep('upload');
            onStepChange?.('upload');
            // onSuccess(); // Moved to after upload
            // window.location.href = '/registration-success'; // Moved to after upload
        } catch (error: any) {
            console.error("Payment Confirmation Error:", error);
            alert("Failed to confirm payment: " + (error.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    }

    async function onSubmit(data: z.infer<typeof delegateSchema>) {
        setIsSubmitting(true);
        try {
            // 1. Save to Supabase
            const { data: regData, error: regError } = await supabase
                .from('registrations')
                .insert([
                    {
                        full_name: data.fullName,
                        email: data.email,
                        phone: data.phone,
                        gender: data.gender,
                        age: data.age,
                        region: data.region,
                        province: data.province,
                        type: 'delegate',
                        status: 'pending_payment'
                    }
                ])
                .select()
                .single();

            if (regError) throw regError;

            console.log("Registration Saved:", regData);
            setRegistrationData(regData);
            setRegistrationData(regData);
            setStep('payment'); // Move to payment step
            onStepChange?.('payment');

        } catch (error: any) {
            console.error("FULL Registration Error:", error);
            let errorMessage = "Unknown error";

            if (error?.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            } else if (error?.error_description) {
                errorMessage = error.error_description;
            }

            if (errorMessage.includes("AbortError")) {
                errorMessage = "Network request timed out or was blocked. Please check your internet connection or disable ad-blockers.";
            }

            alert("Failed to register: " + errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    }

    if (step === 'payment') {
        return (
            <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🏦</span>
                    </div>
                    <h3 className="font-heading font-bold text-xl">Complete Your Registration</h3>
                    <p className="text-sm text-muted-foreground">Please make a transfer of <span className="font-bold text-black">₦2,000</span> to the account below.</p>
                </div>

                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
                        <span className="text-sm text-muted-foreground">Bank Name</span>
                        <span className="font-medium">GTBank</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
                        <span className="text-sm text-muted-foreground">Account Number</span>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-lg">0000000000</span>
                            {/* Copy button could go here */}
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                        <span className="text-sm text-muted-foreground">Account Name</span>
                        <span className="font-medium text-right">Lagos Teens Conference</span>
                    </div>
                </div>

                <Button
                    onClick={handleManualPaymentConfirmation}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "I have made the transfer"}
                </Button>

                <p className="text-xs text-center text-muted-foreground px-4">
                    Clicking the button above will mark your registration as pending verification. You will receive a confirmation once verified.
                </p>
            </div>
        );
    }

    if (step === 'upload') {
        return (
            <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">📤</span>
                    </div>
                    <h3 className="font-heading font-bold text-xl">Upload Payment Proof</h3>
                    <p className="text-sm text-muted-foreground">Please upload a screenshot of your transfer receipt to complete registration.</p>
                </div>

                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 flex flex-col items-center justify-center border-dashed border-2">
                    <Input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={async (e) => {
                            if (!e.target.files || e.target.files.length === 0) return;
                            setUploading(true);
                            try {
                                let file = e.target.files[0];
                                const fileExt = file.name.split('.').pop()?.toLowerCase();
                                const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt || '');

                                // Compress if it's an image
                                if (isImage) {
                                    console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
                                    const options = {
                                        maxSizeMB: 0.2, // 200KB target
                                        maxWidthOrHeight: 1920,
                                        useWebWorker: true
                                    };
                                    try {
                                        const compressedFile = await imageCompression(file, options);
                                        console.log(`Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
                                        file = compressedFile; // Replace original file with compressed one
                                    } catch (err) {
                                        console.error('Compression failed:', err);
                                        // Continue with original file if compression fails? 
                                        // Or alert? Let's log and continue to avoid blocking user.
                                    }
                                }

                                const fileName = `${registrationData.id}.${fileExt}`;
                                const filePath = `${fileName}`;

                                const { error: uploadError } = await supabase.storage
                                    .from('payment_receipts')
                                    .upload(filePath, file);

                                if (uploadError) throw uploadError;

                                const { data: { publicUrl } } = supabase.storage
                                    .from('payment_receipts')
                                    .getPublicUrl(filePath);

                                const { error: dbError } = await supabase
                                    .from('registrations')
                                    .update({
                                        receipt_url: publicUrl,
                                        status: 'pending_verification'
                                    })
                                    .eq('id', registrationData.id);

                                if (dbError) throw dbError;

                                onSuccess();
                                window.location.href = '/registration-success';

                            } catch (error: any) {
                                console.error('Upload Error:', error);
                                alert('Failed to upload receipt: ' + error.message);
                            } finally {
                                setUploading(false);
                            }
                        }}
                        disabled={uploading}
                    />
                    <p className="text-xs text-muted-foreground mt-4">Supported formats: JPG, PNG, PDF, Screenshots</p>
                </div>

                <div className="text-center">
                    {uploading && <p className="text-blue-600 font-bold animate-pulse">Compressing & Uploading...</p>}
                </div>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="fullName" render={({ field }) => (
                        <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Samuel Ade" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="hello@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="080..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="age" render={({ field }) => (
                            <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="gender" render={({ field }) => (
                            <FormItem><FormLabel>Gender</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                                </Select><FormMessage /></FormItem>
                        )} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="region" render={({ field }) => (
                        <FormItem><FormLabel>Region</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select Region" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {Object.keys(REGIONS_AND_PROVINCES).map(r => (
                                        <SelectItem key={r} value={r}>{r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select><FormMessage /></FormItem>
                    )} />

                    <FormField control={form.control} name="province" render={({ field }) => (
                        <FormItem><FormLabel>Province</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!watchRegion}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select Province" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {provinces.map(p => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select><FormMessage /></FormItem>
                    )} />
                </div>

                <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem className="space-y-3"><FormLabel>Role</FormLabel>
                        <FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                {TEEN_ROLES.map((role) => (
                                    <FormItem key={role} className="flex items-center space-x-3 space-y-0">
                                        <FormControl><RadioGroupItem value={role} /></FormControl><FormLabel className="font-normal">{role}</FormLabel>
                                    </FormItem>
                                ))}
                            </RadioGroup>
                        </FormControl><FormMessage /></FormItem>
                )} />
                {watchRole === "Teens Executive" && (
                    <div className="p-4 bg-muted/50 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                        <FormField control={form.control} name="execLevel" render={({ field }) => (
                            <FormItem><FormLabel>Level</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select Level" /></SelectTrigger></FormControl>
                                    <SelectContent>{EXEC_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="execPosition" render={({ field }) => (
                            <FormItem><FormLabel>Position</FormLabel><FormControl><Input placeholder="President" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                )}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Proceed to Payment"}
                </Button>
            </form>
        </Form>
    )
}
