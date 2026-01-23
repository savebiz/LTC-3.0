"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { usePaystackPayment } from "react-paystack"
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

export function DelegateRegistrationForm({ onSuccess }: { onSuccess: () => void }) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [readyToPay, setReadyToPay] = useState(false);
    const [paymentConfig, setPaymentConfig] = useState<any>({
        reference: (new Date()).getTime().toString(),
        email: "",
        amount: 200000,
        publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ""
    });

    const form = useForm<z.infer<typeof delegateSchema>>({
        resolver: zodResolver(delegateSchema),
        defaultValues: { fullName: "", email: "", phone: "", age: 15, region: "", province: "", role: "Member" },
    })
    const watchRole = form.watch("role")
    const watchRegion = form.watch("region")

    // Update provinces when region changes
    const provinces = watchRegion ? REGIONS_AND_PROVINCES[watchRegion] || [] : []

    // Paystack Hook
    const initializePayment = usePaystackPayment(paymentConfig);

    async function handlePaymentSuccess(reference: any) {
        console.log("Payment Successful", reference);
        const regId = paymentConfig.metadata?.registrationId;
        if (regId) {
            await supabase.from('registrations').update({ status: 'confirmed' }).eq('id', regId);
            await supabase.from('payments').insert([{
                registration_id: regId,
                amount: 2000,
                provider: 'paystack',
                reference: reference.reference,
                status: 'success'
            }]);
        }
        onSuccess();
        window.location.href = '/registration-success';
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

            // 2. Setup Payment Config
            const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

            if (!paystackKey || paystackKey.includes('your_paystack_key')) {
                // SIMULATION MODE
                await supabase.from('registrations').update({ status: 'confirmed' }).eq('id', regData.id);
                // alert("Registration Successful! \n\n(Simulated Mode: Payment marked as confirmed).");
                onSuccess(); // Close modal
                window.location.href = '/registration-success';
            } else {
                // REAL PAYSTACK MODE
                setPaymentConfig({
                    reference: (new Date()).getTime().toString(),
                    email: data.email,
                    amount: 200000, // 2000 NGN in kobo
                    publicKey: paystackKey,
                    metadata: {
                        registrationId: regData.id,
                        fullName: data.fullName,
                        phone: data.phone
                    }
                });
                setReadyToPay(true);
            }

        } catch (error: any) {
            console.error("Registration Error:", error);
            alert("Failed to register: " + (error.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
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
                {!readyToPay ? (
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Proceed to Payment"}
                    </Button>
                ) : (
                    <Button
                        type="button"
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                            initializePayment(handlePaymentSuccess, () => alert("Payment cancelled."));
                        }}
                    >
                        Pay ₦2,000 Now
                    </Button>
                )}
            </form>
        </Form>
    )
}
