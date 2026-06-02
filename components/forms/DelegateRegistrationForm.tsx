"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Loader2, Upload, X, FileText } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

import { Button } from "@/components/ui/button"
import { useDialog } from "../ui/DialogProvider"
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
    role: z.enum(["Member", "Worker", "Teens Executive"]).optional(),
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
    // 2. Executive Role validation (Teenager only)
    if (data.category === "Teenager") {
        if (!data.role) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Required",
                path: ["role"],
            });
        } else if (data.role === "Teens Executive") {
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
    const { toast } = useDialog()
    const [registrationData, setRegistrationData] = useState<any>(null); // Store reg data after initial save
    const [step, setStep] = useState<'step1' | 'step2' | 'step3' | 'upload'>('step1');
    const [paymentRef, setPaymentRef] = useState('');
    const [paymentRefError, setPaymentRefError] = useState('');

    const [paymentMethod] = useState<'bank_transfer'>('bank_transfer');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState('');
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    const [delegates, setDelegates] = useState<any[]>([]);

    const [qrSize, setQrSize] = useState(180);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const handleResize = () => {
                setQrSize(window.innerWidth >= 768 ? 220 : 180);
            };
            handleResize();
            window.addEventListener("resize", handleResize);
            
            setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
            
            return () => window.removeEventListener("resize", handleResize);
        }
    }, []);

    const handleFileSelection = (file: File) => {
        setFileError('');
        if (file.size > 5 * 1024 * 1024) {
            setFileError('File too large. Please upload a file under 5MB.');
            return;
        }
        const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            setFileError('Invalid file type. Please upload a JPG, PNG, or PDF.');
            return;
        }
        setSelectedFile(file);
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setFilePreview(url);
        } else {
            setFilePreview(null);
        }
    };

    const handleRemoveFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (filePreview) {
            URL.revokeObjectURL(filePreview);
        }
        setSelectedFile(null);
        setFilePreview(null);
        setFileError('');
    };

    const form = useForm<z.infer<typeof delegateSchema>>({
        resolver: zodResolver(delegateSchema) as any,
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

    async function proceedToPayment() {
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
            finalDelegates.push(newDelegate);
            setDelegates(finalDelegates);
            
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

        if (finalDelegates.length === 0) {
            await form.trigger(["fullName", "email", "phone", "category", "gender", "region"]);
            return;
        }

        setStep('step2');
        onStepChange?.('payment');
    }

    async function performSubmit() {
        if (delegates.length === 0) {
            toast.error("Registration failed. Please try again.", "Please add at least one delegate.");
            return;
        }

        if (paymentMethod === 'bank_transfer') {
            if (!paymentRef.trim()) {
                setPaymentRefError("Reference / teller number is required.");
                return;
            }
            if (!selectedFile) {
                setFileError("Please upload your payment receipt to continue.");
                return;
            }
        }

        setIsSubmitting(true);
        let insertedIds: string[] = [];
        const batchId = self.crypto.randomUUID();
        try {
            let receiptUrl = null;

            if (paymentMethod === 'bank_transfer' && selectedFile) {
                const fileExt = selectedFile.name.split('.').pop() || 'jpg';
                const fileName = `${batchId}-receipt.${fileExt}`;

                // Upload to Supabase Storage before inserting registration
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('payment_receipts')
                    .upload(fileName, selectedFile, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (uploadError) {
                    throw new Error("Receipt upload failed. Please try again.");
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('payment_receipts')
                    .getPublicUrl(fileName);
                receiptUrl = urlData.publicUrl;
            }

            const payload = delegates.map(d => ({
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
                amount_due: d.category === "Teenager" ? 1000 : 1500,
                category: d.category === "Teenager" ? "teenager" : "teacher",
                // Redesigned columns:
                batch_id: batchId,
                payment_method: 'bank_transfer',
                payment_reference: paymentRef.trim(),
                payment_status: 'pending',
                receipt_url: receiptUrl
            }));

            const { data: regData, error: regError } = await supabase
                .from('registrations')
                .insert(payload)
                .select();

            if (regError) throw regError;

            insertedIds = regData.map((r: any) => r.id);

            console.log("Registrations Saved:", regData);
            
            // Log registration_created for each delegate in the batch (non-blocking)
            if (regData && regData.length > 0) {
                try {
                    const auditLogs = regData.map((r: any) => ({
                        action: 'registration_created',
                        registration_id: r.id,
                        batch_reference: r.batch_reference,
                        registrant_name: r.full_name,
                        performed_by: 'self',
                        device_info: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
                        new_value: {
                            id: r.id,
                            full_name: r.full_name,
                            category: r.category,
                            batch_reference: r.batch_reference,
                            payment_status: r.payment_status,
                            amount_due: r.amount_due
                        }
                    }));
                    
                    supabase.from('audit_log').insert(auditLogs).then(({ error }) => {
                        if (error) console.error("Error inserting audit logs for registration:", error);
                    });
                } catch (e) {
                    console.error("Failed to build audit logs for registration:", e);
                }
            }

            setRegistrationData(regData);
            setStep('step3');
            onStepChange?.('upload');
        } catch (error: any) {
            console.error("FULL Submit Error:", error);
            // Delete uploaded storage file if insertion fails
            if (paymentMethod === 'bank_transfer' && selectedFile) {
                const fileExt = selectedFile.name.split('.').pop() || 'jpg';
                const fileName = `${batchId}-receipt.${fileExt}`;
                await supabase.storage.from('payment_receipts').remove([fileName]).catch(e => console.error("Error removing uploaded file on rollback:", e));
            }
            // Rollback inserted registrations to prevent orphaned records without receipt
            if (insertedIds.length > 0) {
                await supabase.from('registrations').delete().in('id', insertedIds);
            }
            toast.error("Receipt upload failed. Please try again.", error?.message || "Unknown error");
        } finally {
            setIsSubmitting(false);
        }
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
                    .update({ payment_status: 'pending' })
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
            toast.error("Failed to confirm payment", error.message || "Unknown error");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function onSubmit(data: z.infer<typeof delegateSchema>) {
        await addDelegateToList();
    }
    if (step === 'step2') {
        return (
            <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🏦</span>
                    </div>
                    <h3 className="font-heading font-bold text-xl">Payment Details</h3>
                    <p className="text-sm text-muted-foreground">Please make a transfer of <span className="font-bold text-black">₦{totalAmount.toLocaleString()}</span> to the account below.</p>
                </div>

                <div className="space-y-4">
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 space-y-4 text-sm">
                        <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
                            <span className="text-zinc-500">Bank Name</span>
                            <span className="font-semibold text-slate-800">ACCESS BANK PLC</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
                            <span className="text-zinc-500">Account Number</span>
                            <span className="font-mono font-bold text-base text-slate-800">1494000251</span>
                        </div>
                        <div className="flex justify-between items-center pb-1">
                            <span className="text-zinc-500">Account Name</span>
                            <span className="font-semibold text-slate-800 text-right">RCCG Region 2 Junior Church (Lagos Family)</span>
                        </div>
                    </div>

                    {/* Teller input */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Enter your transfer reference / teller number</label>
                        <Input
                            type="text"
                            placeholder="e.g. TXN102948573"
                            className={`h-11 ${paymentRefError ? 'border-red-500' : ''}`}
                            value={paymentRef}
                            onChange={(e) => {
                                setPaymentRef(e.target.value);
                                if (e.target.value.trim()) setPaymentRefError('');
                            }}
                        />
                        {paymentRefError && <p className="text-xs text-red-500">{paymentRefError}</p>}
                    </div>

                    {/* Receipt Upload Field */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 block">Upload Payment Receipt</label>
                        <span className="text-xs text-zinc-500 block leading-normal">Upload a screenshot or photo of your transfer confirmation (JPG, PNG, or PDF — max 5MB)</span>
                        
                        {!selectedFile ? (
                            <div 
                                onClick={() => document.getElementById('receipt-upload')?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                        handleFileSelection(e.dataTransfer.files[0]);
                                    }
                                }}
                                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center gap-2 ${
                                    fileError ? 'border-red-500 bg-red-50/10' : 'border-zinc-300 hover:border-blue-500 hover:bg-zinc-50/50'
                                }`}
                            >
                                <Upload className={`w-8 h-8 ${fileError ? 'text-red-500' : 'text-zinc-400'}`} />
                                <p className="text-sm font-semibold text-zinc-700">Tap to upload or drag and drop</p>
                                <input 
                                    type="file" 
                                    id="receipt-upload" 
                                    className="hidden" 
                                    accept="image/jpeg,image/png,application/pdf"
                                    capture={isMobile ? "environment" : undefined}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            handleFileSelection(e.target.files[0]);
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {filePreview ? (
                                            <img 
                                                src={filePreview} 
                                                alt="Receipt preview" 
                                                className="w-12 h-12 object-cover rounded-lg border border-zinc-200 shrink-0"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate" title={selectedFile.name}>
                                                {selectedFile.name}
                                            </p>
                                            <p className="text-xs text-zinc-400">
                                                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleRemoveFile}
                                        className="text-zinc-450 hover:text-red-500 p-1.5 rounded-full hover:bg-zinc-200/50 transition-colors shrink-0 cursor-pointer border-0 bg-transparent"
                                        title="Remove file"
                                        disabled={isSubmitting}
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                {isSubmitting && (
                                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] rounded-xl flex items-center justify-center gap-2">
                                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                        <span className="text-xs font-semibold text-blue-600">Uploading receipt...</span>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {fileError && <p className="text-xs text-red-500 font-medium">{fileError}</p>}
                    </div>
                </div>

                {/* Registrants Summary Card */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-3">
                    <h4 className="font-bold text-xs text-zinc-500 uppercase tracking-wider flex justify-between">
                        <span>Registrants Summary ({delegates.length})</span>
                        <span className="text-zinc-800 font-mono font-bold">Total: ₦{totalAmount.toLocaleString()}</span>
                    </h4>
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                        {delegates.map((d, index) => (
                            <div key={index} className="flex justify-between items-center bg-white p-2 border border-zinc-100 rounded-lg">
                                <div>
                                    <p className="font-semibold text-slate-800">{d.fullName}</p>
                                    <p className="text-[10px] text-zinc-400">{d.category === 'Teenager' ? 'Teenager' : 'Teacher / Adult'}</p>
                                </div>
                                <span className="font-mono font-medium text-slate-600">₦{(d.category === 'Teenager' ? 1000 : 1500).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12 text-slate-700 border-zinc-300 hover:bg-zinc-50 font-bold"
                        onClick={() => {
                            setStep('step1');
                            onStepChange?.('form');
                        }}
                        disabled={isSubmitting}
                    >
                        Back
                    </Button>
                    <Button
                        type="button"
                        className="flex-[2] h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                        onClick={performSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                                {paymentMethod === 'bank_transfer' ? "Uploading & Submitting..." : "Submitting..."}
                            </>
                        ) : "Confirm & Submit"}
                    </Button>
                </div>
            </div>
        );
    }

    if (step === 'step3') {
        const batchRef = registrationData && registrationData.length > 0 ? registrationData[0].batch_reference : 'C3TC-CONFIRMED';
        const qrCodeHash = registrationData && registrationData.length > 0 ? registrationData[0].qr_code_hash : '';
        
        const shareText = "I just registered for the Continent 3 Teens Conference — T.I.M.E '26! 🎉 Join me at Glory Arena, Redemption City of God, Ogun State on Saturday, 19th September 2026. Register at continent3teens.cc";
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

        return (
            <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🎉</span>
                    </div>
                    <h3 className="font-heading font-bold text-xl text-green-600">Registration Submitted!</h3>
                    <p className="text-sm text-muted-foreground">Your registration has been received and is pending verification.</p>
                </div>

                {/* Ticket/Pass Accent Container */}
                <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-2xl text-white">
                    <div className="absolute top-1/2 -left-3 w-6 h-6 bg-white rounded-full transform -translate-y-1/2"></div>
                    <div className="absolute top-1/2 -right-3 w-6 h-6 bg-white rounded-full transform -translate-y-1/2"></div>

                    <div className="text-center border-b border-dashed border-white/20 pb-4 mb-4">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Batch Reference Code</h2>
                        <p className="text-3xl font-black text-orange-400 tracking-wider font-mono mt-1">{batchRef}</p>
                        <p className="text-[10px] text-gray-400 mt-2">Screenshot or note your reference code. You will need it on arrival.</p>
                    </div>

                    {/* QR Code Container */}
                    <div className="flex flex-col items-center justify-center mb-6 mt-2 relative z-10">
                        <div className="bg-white p-3 rounded-2xl inline-block shadow-lg">
                            <QRCodeSVG 
                                value={JSON.stringify({
                                    ref: batchRef,
                                    hash: qrCodeHash
                                })} 
                                size={qrSize} 
                                level="M"
                                includeMargin={true}
                            />
                        </div>
                        <p className="text-xs text-zinc-300 mt-2.5 font-medium tracking-wide">
                            Show this QR code at the venue for check-in
                        </p>
                    </div>

                    <div className="space-y-3 text-sm">
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Event</p>
                            <p className="font-semibold text-white">Continent 3 Teens Conference — T.I.M.E</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Venue</p>
                            <p className="font-semibold text-white">Glory Arena, Redemption City of God, Ogun State</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Date</p>
                            <p className="font-semibold text-white">Saturday, 19th September, 2026</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-1">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Payment Method</p>
                                <p className="font-semibold text-white">Bank Transfer</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Total Paid</p>
                                <p className="font-semibold text-white font-mono">₦{totalAmount.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Full list of registered persons */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-zinc-500 uppercase tracking-wider">Registered Persons</p>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                        {delegates.map((d, index) => (
                            <div key={index} className="flex justify-between items-center py-1.5 border-b border-zinc-100 last:border-b-0">
                                <span className="font-medium text-slate-800">{d.fullName}</span>
                                <span className="text-zinc-500">
                                    {d.category === 'Teenager' ? 'Teenager' : 'Teacher / Adult'} • ₦{(d.category === 'Teenager' ? 1000 : 1500).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Reminder and Status Link */}
                <div className="text-center space-y-3">
                    <p className="text-xs text-zinc-500 leading-relaxed px-2">
                        You will receive an email notification once your payment is verified by the registration team.
                    </p>
                    <div>
                        <a
                            href={`/check-status?ref=${batchRef}`}
                            className="inline-block text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                            Check your registration status anytime at continent3teens.cc/check-status →
                        </a>
                    </div>
                </div>

                <div className="space-y-4 pt-4">
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-full h-12 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold rounded-xl shadow-sm transition-colors text-base"
                    >
                        <svg className="w-5 h-5 mr-2 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.638 1.977 14.168.953 11.54.953c-5.441 0-9.866 4.372-9.87 9.802 0 1.814.492 3.587 1.429 5.161l-.98 3.58 3.687-.956zm11.233-5.836c-.3-.15-1.774-.865-2.048-.963-.274-.1-.474-.15-.674.15-.2.3-.774.963-.948 1.162-.174.2-.347.225-.647.075-.3-.15-1.264-.462-2.408-1.472-.89-.785-1.49-1.755-1.665-2.055-.174-.3-.018-.462.13-.61.135-.133.3-.347.45-.52.15-.174.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.674-1.606-.924-2.196-.243-.58-.49-.5-.674-.51-.174-.01-.374-.01-.574-.01-.2 0-.524.075-.798.375-.274.3-1.047 1.01-1.047 2.463 0 1.453 1.073 2.855 1.223 3.054.15.2 2.112 3.187 5.117 4.469.715.305 1.273.487 1.708.625.718.227 1.372.195 1.888.118.574-.085 1.774-.716 2.023-1.408.249-.693.249-1.285.174-1.408-.075-.125-.275-.2-.575-.35z"/>
                        </svg>
                        Share on WhatsApp
                    </a>
                    
                    <div className="text-center pt-1.5">
                        <button
                            type="button"
                            onClick={onSuccess}
                            className="inline-block text-orange-400 hover:text-orange-300 font-bold text-sm transition-colors cursor-pointer"
                        >
                            ← Back to Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => {
                toast.error("Registration failed. Please try again.", "Please correct the highlighted errors in the form.");
            })} className="space-y-6 py-4">
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
                                        form.setValue("role", undefined);
                                        form.setValue("execLevel", undefined);
                                        form.setValue("execPosition", "");
                                    } else {
                                        form.setValue("role", "Member");
                                    }
                                }} 
                                value={field.value}
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
                    <FormItem className="space-y-3"><FormLabel className="font-semibold text-slate-800">How are you registering?</FormLabel>
                        <FormControl>
                            <div className="flex flex-row flex-wrap items-center gap-6 mt-1.5">
                                <label className="flex items-center space-x-2.5 cursor-pointer font-medium text-sm text-slate-700">
                                    <input 
                                        type="radio" 
                                        name="registrationType" 
                                        value="individual" 
                                        checked={field.value === 'individual'} 
                                        onChange={() => field.onChange('individual')}
                                        className="appearance-none w-4 h-4 rounded-full border border-slate-300 checked:border-orange-500 checked:bg-orange-500 relative cursor-pointer outline-none checked:after:content-[''] checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:w-1.5 checked:after:h-1.5 checked:after:rounded-full checked:after:bg-white transition-all shrink-0"
                                    />
                                    <span>Individual</span>
                                </label>
                                <label className="flex items-center space-x-2.5 cursor-pointer font-medium text-sm text-slate-700">
                                    <input 
                                        type="radio" 
                                        name="registrationType" 
                                        value="group" 
                                        checked={field.value === 'group'} 
                                        onChange={() => field.onChange('group')}
                                        className="appearance-none w-4 h-4 rounded-full border border-slate-300 checked:border-orange-500 checked:bg-orange-500 relative cursor-pointer outline-none checked:after:content-[''] checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:w-1.5 checked:after:h-1.5 checked:after:rounded-full checked:after:bg-white transition-all shrink-0"
                                    />
                                    <span>Part of a Group</span>
                                </label>
                            </div>
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
                                value={field.value || ""}
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

                {watchCategory === "Teenager" && (
                    <>
                        <FormField control={form.control} name="role" render={({ field }) => (
                            <FormItem className="space-y-3"><FormLabel className="font-semibold text-slate-800">Role</FormLabel>
                                <FormControl>
                                    <div className="flex flex-row flex-wrap items-center gap-6 mt-1.5">
                                        {TEEN_ROLES.map((role) => (
                                            <label key={role} className="flex items-center space-x-2.5 cursor-pointer font-medium text-sm text-slate-700">
                                                <input 
                                                    type="radio" 
                                                    name="role" 
                                                    value={role} 
                                                    checked={field.value === role} 
                                                    onChange={() => field.onChange(role)}
                                                    className="appearance-none w-4 h-4 rounded-full border border-slate-300 checked:border-orange-500 checked:bg-orange-500 relative cursor-pointer outline-none checked:after:content-[''] checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:w-1.5 checked:after:h-1.5 checked:after:rounded-full checked:after:bg-white transition-all shrink-0"
                                                />
                                                <span>{role}</span>
                                            </label>
                                        ))}
                                    </div>
                                </FormControl><FormMessage /></FormItem>
                        )} />
                        {watchRole === "Teens Executive" && (
                            <div className="p-4 bg-muted/50 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                                <FormField control={form.control as any} name="execLevel" render={({ field }) => (
                                    <FormItem><FormLabel>Level</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select Level" /></SelectTrigger></FormControl>
                                            <SelectContent>{EXEC_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                        </Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control as any} name="execPosition" render={({ field }) => (
                                    <FormItem><FormLabel>Position</FormLabel><FormControl><Input placeholder="President" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        )}
                    </>
                )}
                <div className="flex gap-4 pt-2">
                    <Button 
                        type="button" 
                        onClick={addDelegateToList} 
                        variant="outline" 
                        className="flex-1 h-12 text-slate-700 border-zinc-300 hover:bg-zinc-50 font-bold"
                    >
                        ➕ Add Person
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

                <Button 
                    type="button" 
                    onClick={proceedToPayment} 
                    className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                    {delegates.length > 0 ? `Proceed to Payment (Total: ₦${totalAmount.toLocaleString()})` : "Proceed to Payment"}
                </Button>
            </form>
        </Form>
    )
}
