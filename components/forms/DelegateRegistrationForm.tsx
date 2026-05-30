"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { supabase } from "@/lib/supabase";
import { TEEN_ROLES, EXEC_LEVELS, LAGOS_REGIONS, OGUN_REGIONS, REGIONS_AND_PROVINCES } from "@/constants"
import imageCompression from 'browser-image-compression';

const delegateSchema = z.object({
    fullName: z.string().min(2, { message: "Required" }),
    email: z.string().email(),
    phone: z.string().min(10),
    category: z.enum(["Teenager", "Teacher / Adult"]),
    age: z.preprocess(
        (val) => (val === "" || val === null || val === undefined) ? null : Number(val),
        z.number().nullable()
    ).optional(),
    gender: z.enum(["Male", "Female"]),
    region: z.string().min(1, { message: "Select a region" }),
    province: z.string().optional(),
    otherRegionSpecified: z.string().optional(),
    role: z.enum(["Member", "Worker", "Teens Executive"]),
    execLevel: z.enum(["Parish", "Zone", "Area", "Province", "Region"]).optional(),
    execPosition: z.string().optional(),
    
    registrationType: z.enum(["individual", "group"]),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    groupName: z.string().optional(),
    groupCoordinatorName: z.string().optional(),
    groupCoordinatorPhone: z.string().optional(),
}).superRefine((data, ctx) => {
    // 1. Category & Age validation
    if (data.category === "Teenager") {
        if (data.age === null || data.age === undefined || isNaN(data.age)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Required",
                path: ["age"],
            });
        } else if (data.age < 13 || data.age > 19) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please enter a valid age for a teenage delegate (13–19).",
                path: ["age"],
            });
        }
    }
    // 1. Executive Role validation
    if (data.role === "Teens Executive") {
        if (!data.execLevel) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Select executive level",
                path: ["execLevel"],
            });
        }
        if (!data.execPosition || data.execPosition.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Required",
                path: ["execPosition"],
            });
        }
    }

    // 2. Region / Province validation
    if (data.region === "Other (Outside Lagos/Ogun)") {
        if (!data.otherRegionSpecified || data.otherRegionSpecified.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please specify your Region / Continent",
                path: ["otherRegionSpecified"],
            });
        }
    } else {
        if (!data.province || data.province.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Select a province",
                path: ["province"],
            });
        }
    }

    // 3. Registration Type conditional validations
    if (data.registrationType === "individual") {
        if (!data.emergencyContactName || data.emergencyContactName.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Required",
                path: ["emergencyContactName"],
            });
        }
        if (!data.emergencyContactPhone || data.emergencyContactPhone.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Required",
                path: ["emergencyContactPhone"],
            });
        }
    } else if (data.registrationType === "group") {
        if (!data.groupName || data.groupName.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Required",
                path: ["groupName"],
            });
        }
        if (!data.groupCoordinatorName || data.groupCoordinatorName.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Required",
                path: ["groupCoordinatorName"],
            });
        }
        if (!data.groupCoordinatorPhone || data.groupCoordinatorPhone.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Required",
                path: ["groupCoordinatorPhone"],
            });
        }
    }
});

export function DelegateRegistrationForm({ onSuccess, onStepChange }: {
    onSuccess: () => void;
    onStepChange?: (step: 'form' | 'payment' | 'upload') => void;
}) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [registrationData, setRegistrationData] = useState<any>(null); // Store reg data after initial save
    const [step, setStep] = useState<'form' | 'payment' | 'upload'>('form');
    const [uploading, setUploading] = useState(false);

    const [delegates, setDelegates] = useState<any[]>([]);

    const form = useForm<z.infer<typeof delegateSchema>>({
        resolver: zodResolver(delegateSchema),
        defaultValues: { 
            fullName: "", email: "", phone: "", category: "Teenager", age: 15, region: "", province: "", otherRegionSpecified: "", role: "Member", 
            registrationType: "individual", emergencyContactName: "", emergencyContactPhone: "",
            groupName: "", groupCoordinatorName: "", groupCoordinatorPhone: ""
        },
    })
    const watchRole = form.watch("role")
    const watchRegion = form.watch("region")
    const watchRegType = form.watch("registrationType")
    const watchCategory = form.watch("category")

    // Update provinces when region changes
    const provinces = (watchRegion && watchRegion !== "Other (Outside Lagos/Ogun)") ? REGIONS_AND_PROVINCES[watchRegion] || [] : []

    const totalAmount = delegates.reduce((sum, d) => sum + (d.category === "Teenager" ? 1000 : 1500), 0);

    async function performSubmit(delegatesList: any[]) {
        if (delegatesList.length === 0) {
            alert("Please add at least one delegate.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = delegatesList.map(d => ({
                full_name: d.fullName,
                email: d.email,
                phone: d.phone,
                gender: d.gender,
                age: d.age,
                region: d.region,
                province: d.province,
                other_region_specified: d.otherRegionSpecified,
                registration_type: form.getValues("registrationType"),
                emergency_contact_name: form.getValues("registrationType") === "individual" ? form.getValues("emergencyContactName") : null,
                emergency_contact_phone: form.getValues("registrationType") === "individual" ? form.getValues("emergencyContactPhone") : null,
                group_name: form.getValues("registrationType") === "group" ? form.getValues("groupName") : null,
                group_coordinator_name: form.getValues("registrationType") === "group" ? form.getValues("groupCoordinatorName") : null,
                group_coordinator_phone: form.getValues("registrationType") === "group" ? form.getValues("groupCoordinatorPhone") : null,
                type: 'delegate',
                status: 'pending_payment',
                amount_due: d.category === "Teenager" ? 1000 : 1500,
                category: d.category === "Teenager" ? "teenager" : "teacher",
            }));

            const { data: regData, error: regError } = await supabase
                .from('registrations')
                .insert(payload)
                .select();

            if (regError) throw regError;

            console.log("Registrations Saved:", regData);
            setRegistrationData(regData);
            setStep('payment');
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

    async function submitBatch() {
        const currentName = form.getValues("fullName");
        const currentEmail = form.getValues("email");
        
        let finalDelegates = [...delegates];
        
        if (currentName.trim() || currentEmail.trim()) {
            const isValid = await form.trigger([
                "fullName", "email", "phone", "category", "age", "gender", 
                "region", "province", "otherRegionSpecified", "role", "execLevel", "execPosition"
            ]);
            
            if (!isValid) return;
            
            const values = form.getValues();
            finalDelegates.push({
                fullName: values.fullName,
                email: values.email,
                phone: values.phone,
                category: values.category,
                age: values.category === "Teenager" ? values.age : null,
                gender: values.gender,
                region: values.region,
                province: values.region === "Other (Outside Lagos/Ogun)" ? "Other" : values.province,
                otherRegionSpecified: values.region === "Other (Outside Lagos/Ogun)" ? values.otherRegionSpecified : null,
                role: values.role,
                execLevel: values.role === "Teens Executive" ? values.execLevel : null,
                execPosition: values.role === "Teens Executive" ? values.execPosition : null,
            });
        }

        await performSubmit(finalDelegates);
    }

    async function addDelegateToList() {
        const isValid = await form.trigger([
            "fullName", "email", "phone", "category", "age", "gender", 
            "region", "province", "otherRegionSpecified", "role", "execLevel", "execPosition"
        ]);
        
        if (!isValid) return;
        
        const values = form.getValues();
        const newDelegate = {
            fullName: values.fullName,
            email: values.email,
            phone: values.phone,
            category: values.category,
            age: values.category === "Teenager" ? values.age : null,
            gender: values.gender,
            region: values.region,
            province: values.region === "Other (Outside Lagos/Ogun)" ? "Other" : values.province,
            otherRegionSpecified: values.region === "Other (Outside Lagos/Ogun)" ? values.otherRegionSpecified : null,
            role: values.role,
            execLevel: values.role === "Teens Executive" ? values.execLevel : null,
            execPosition: values.role === "Teens Executive" ? values.execPosition : null,
        };
        
        setDelegates(prev => [...prev, newDelegate]);
        
        // Reset form inputs for delegate section
        form.setValue("fullName", "");
        form.setValue("email", "");
        form.setValue("phone", "");
        form.setValue("category", "Teenager");
        form.setValue("age", 15);
        form.setValue("gender", undefined as any);
        form.setValue("region", "");
        form.setValue("province", "");
        form.setValue("otherRegionSpecified", "");
        form.setValue("role", "Member");
        form.setValue("execLevel", undefined);
        form.setValue("execPosition", "");
        
        form.clearErrors([
            "fullName", "email", "phone", "category", "age", "gender", 
            "region", "province", "otherRegionSpecified", "role", "execLevel", "execPosition"
        ]);
    }

    async function handleManualPaymentConfirmation() {
        setIsSubmitting(true);
        try {
            if (registrationData) {
                const regList = Array.isArray(registrationData) ? registrationData : [registrationData];
                const ids = regList.map((r: any) => r.id);
                const firstId = regList[0].id;

                const { error } = await supabase
                    .from('registrations')
                    .update({ status: 'pending_verification' })
                    .in('id', ids);

                if (error) throw error;

                await supabase.from('payments').insert([{
                    registration_id: firstId,
                    amount: totalAmount,
                    provider: 'manual_transfer',
                    reference: `MANUAL-${Date.now()}`,
                    status: 'pending'
                }]);
            }
            setStep('upload');
            onStepChange?.('upload');
        } catch (error: any) {
            console.error("Payment Confirmation Error:", error);
            alert("Failed to confirm payment: " + (error.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    }

    async function onSubmit(data: z.infer<typeof delegateSchema>) {
        const singleDelegate = {
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            category: data.category,
            age: data.category === "Teenager" ? data.age : null,
            gender: data.gender,
            region: data.region,
            province: data.region === "Other (Outside Lagos/Ogun)" ? "Other" : data.province,
            otherRegionSpecified: data.region === "Other (Outside Lagos/Ogun)" ? data.otherRegionSpecified : null,
            role: data.role,
            execLevel: data.role === "Teens Executive" ? data.execLevel : null,
            execPosition: data.role === "Teens Executive" ? data.execPosition : null,
        };
        
        await performSubmit([...delegates, singleDelegate]);
    }

    if (step === 'payment') {
        return (
            <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🏦</span>
                    </div>
                    <h3 className="font-heading font-bold text-xl">Complete Your Registration</h3>
                    <p className="text-sm text-muted-foreground">Please make a transfer of <span className="font-bold text-black">₦{totalAmount.toLocaleString()}</span> to the account below.</p>
                </div>                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 space-y-4">
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
                        <span className="font-medium text-right">Continent 3 Teens Conference</span>
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

                                const regList = Array.isArray(registrationData) ? registrationData : [registrationData];
                                const firstId = regList[0].id;
                                const firstReg = regList[0];
                                const ids = regList.map((r: any) => r.id);

                                const fileName = `${firstId}.${fileExt}`;
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
                                    .in('id', ids);

                                if (dbError) throw dbError;

                                onSuccess();
                                const redirectUrl = new URL('/registration-success', window.location.origin);
                                redirectUrl.searchParams.set('type', 'delegate');
                                redirectUrl.searchParams.set('reference', firstId);
                                redirectUrl.searchParams.set('name', firstReg.full_name);
                                redirectUrl.searchParams.set('regId', firstId);
                                window.location.href = redirectUrl.toString();

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
                    <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem><FormLabel>I am registering as a</FormLabel>
                            <Select 
                                onValueChange={(val) => {
                                    field.onChange(val);
                                    if (val === "Teacher / Adult") {
                                        form.setValue("age", null);
                                    }
                                }} 
                                defaultValue={field.value}
                            >
                                <FormControl><SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Teenager">Teenager</SelectItem>
                                    <SelectItem value="Teacher / Adult">Teacher / Adult</SelectItem>
                                </SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="gender" render={({ field }) => (
                        <FormItem><FormLabel>Gender</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select Gender" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                </SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )} />
                    {watchCategory === "Teenager" && (
                        <FormField control={form.control} name="age" render={({ field }) => (
                            <FormItem><FormLabel>Age</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="number" 
                                        placeholder="E.g. 15"
                                        {...field} 
                                        value={field.value ?? ""} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            field.onChange(val === "" ? null : Number(val));
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    )}
                </div>
                <FormField control={form.control} name="registrationType" render={({ field }) => (
                    <FormItem className="space-y-3"><FormLabel className="font-semibold">How are you registering?</FormLabel>
                        <FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-row space-x-6">
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="individual" /></FormControl><FormLabel className="font-normal">Individual</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="group" /></FormControl><FormLabel className="font-normal">Part of a Group</FormLabel>
                                </FormItem>
                            </RadioGroup>
                        </FormControl><FormMessage /></FormItem>
                )} />

                {watchRegType === "individual" && (
                    <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-4 animate-in fade-in duration-300">
                        <h4 className="font-bold text-xs text-slate-500 uppercase tracking-widest">Emergency Contact</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="emergencyContactName" render={({ field }) => (
                                <FormItem><FormLabel>Emergency Contact Name</FormLabel><FormControl><Input placeholder="E.g. Parent or Guardian Name" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="emergencyContactPhone" render={({ field }) => (
                                <FormItem><FormLabel>Emergency Contact Phone Number</FormLabel><FormControl><Input placeholder="080..." {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                    </div>
                )}

                {watchRegType === "group" && (
                    <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-4 animate-in fade-in duration-300">
                        <h4 className="font-bold text-xs text-slate-500 uppercase tracking-widest">Group Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name="groupName" render={({ field }) => (
                                <FormItem><FormLabel>Group / Parish Name</FormLabel><FormControl><Input placeholder="E.g. Dominion Sanctuary" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="groupCoordinatorName" render={({ field }) => (
                                <FormItem><FormLabel>Group Coordinator Full Name</FormLabel><FormControl><Input placeholder="E.g. Pastor Samuel" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="groupCoordinatorPhone" render={({ field }) => (
                                <FormItem><FormLabel>Group Coordinator Phone</FormLabel><FormControl><Input placeholder="080..." {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <p className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-xl p-4 mt-2">
                            Each person in the group should register individually. Your coordinator will make a consolidated payment on behalf of the group.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="region" render={({ field }) => (
                        <FormItem><FormLabel>Region</FormLabel>
                            <Select 
                                onValueChange={(val) => {
                                    field.onChange(val);
                                    if (val === "Other (Outside Lagos/Ogun)") {
                                        form.setValue("province", "");
                                    } else {
                                        form.setValue("otherRegionSpecified", "");
                                    }
                                }} 
                                defaultValue={field.value}
                            >
                                <FormControl><SelectTrigger><SelectValue placeholder="Select Region" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Lagos</SelectLabel>
                                        {LAGOS_REGIONS.map(r => (
                                            <SelectItem key={r} value={r}>{r}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                    <SelectGroup>
                                        <SelectLabel>Ogun</SelectLabel>
                                        {OGUN_REGIONS.map(r => (
                                            <SelectItem key={r} value={r}>{r}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                    <SelectSeparator />
                                    <SelectItem value="Other (Outside Lagos/Ogun)">Other (Outside Lagos/Ogun)</SelectItem>
                                </SelectContent>
                            </Select><FormMessage /></FormItem>
                    )} />

                    {watchRegion === "Other (Outside Lagos/Ogun)" ? (
                        <FormField control={form.control} name="otherRegionSpecified" render={({ field }) => (
                            <FormItem><FormLabel>Please specify your Region / Continent</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Region 5 / Europe" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    ) : (
                        <FormField control={form.control} name="province" render={({ field }) => (
                            <FormItem><FormLabel>Province</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""} disabled={!watchRegion}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select Province" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {provinces.map(p => (
                                            <SelectItem key={p} value={p}>{p}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select><FormMessage /></FormItem>
                        )} />
                    )}
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
                <div className="flex gap-4 pt-2">
                    <Button 
                        type="button" 
                        onClick={addDelegateToList} 
                        variant="outline" 
                        className="flex-1 h-12 text-slate-700 border-zinc-300 hover:bg-zinc-50"
                    >
                        ➕ Add Person to List
                    </Button>
                </div>

                {delegates.length > 0 && (
                    <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3 animate-in fade-in duration-300">
                        <h4 className="font-bold text-xs text-slate-500 uppercase tracking-widest flex justify-between">
                            <span>Delegates List ({delegates.length})</span>
                            <span className="text-slate-800 font-mono font-bold">Total: ₦{totalAmount.toLocaleString()}</span>
                        </h4>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                            {delegates.map((d, index) => (
                                <div key={index} className="flex justify-between items-center bg-white p-3 border border-zinc-100 rounded-xl shadow-sm text-sm">
                                    <div className="space-y-0.5">
                                        <p className="font-semibold text-slate-800">{d.fullName}</p>
                                        <p className="text-xs text-muted-foreground">{d.category} • {d.role}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-medium text-slate-700">
                                            ₦{(d.category === "Teenager" ? 1000 : 1500).toLocaleString()}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDelegates(prev => prev.filter((_, i) => i !== index));
                                            }}
                                            className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors text-base leading-none border-0 bg-transparent cursor-pointer"
                                            title="Remove"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {delegates.length === 0 ? (
                    <Button type="submit" className="w-full h-12 text-base" disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Proceed to Payment"}
                    </Button>
                ) : (
                    <Button 
                        type="button" 
                        onClick={submitBatch} 
                        className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white" 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving List...</> : `Proceed to Payment (Total: ₦${totalAmount.toLocaleString()})`}
                    </Button>
                )}
            </form>
        </Form>
    )
}
