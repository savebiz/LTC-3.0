"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Loader2 } from "lucide-react"

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
import { VOLUNTEER_DEPARTMENTS, REGIONS_AND_PROVINCES, LAGOS_REGIONS, OGUN_REGIONS } from "@/constants"
import { getJaroWinklerDistance, cleanNameForComparison, normalizePhone, normalizeEmail } from "@/lib/similarity"
import { DuplicateWarningModal } from "../ui/DuplicateWarningModal"

const volunteerSchema = z.object({
    fullName: z.string().min(2, { message: "Required" }),
    email: z.string().email(),
    phone: z.string().min(10),
    age: z.preprocess(
        (val) => (val === "" || val === null || val === undefined) ? null : Number(val),
        z.number().nullable()
    ).optional(),
    gender: z.enum(["Male", "Female"]),
    region: z.string().min(1, { message: "Select a region" }),
    province: z.string().optional(),
    otherRegionSpecified: z.string().optional(),
    role: z.enum(["Teenager", "Teacher"]),
    department: z.string().min(1, { message: "Select a department" }),
    experience: z.string().optional(),
}).superRefine((data, ctx) => {
    // 1. Role-based age validation
    if (data.role === "Teenager") {
        if (data.age === null || data.age === undefined || isNaN(data.age)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Required",
                path: ["age"],
            });
        } else if (data.age < 9 || data.age > 19) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please enter a valid age for a teenage volunteer (9–19).",
                path: ["age"],
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
});

export function VolunteerRegistrationForm({ onSuccess }: { onSuccess: () => void }) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { toast } = useDialog()

    // Duplicate detection states
    const [duplicateMatches, setDuplicateMatches] = useState<any[]>([])
    const [showDuplicateModal, setShowDuplicateModal] = useState(false)
    const [duplicateMode, setDuplicateMode] = useState<'soft' | 'hard'>('soft')
    const [pendingValues, setPendingValues] = useState<z.infer<typeof volunteerSchema> | null>(null)

    const form = useForm<z.infer<typeof volunteerSchema>>({
        resolver: zodResolver(volunteerSchema) as any,
        defaultValues: { fullName: "", email: "", phone: "", age: 15, region: "", province: "", otherRegionSpecified: "", role: "Teenager", department: "" },
    })
    const watchRegion = form.watch("region")
    const watchRole = form.watch("role")
    const provinces = (watchRegion && watchRegion !== "Other (Outside Lagos/Ogun)") ? REGIONS_AND_PROVINCES[watchRegion] || [] : []

    async function proceedToInsert(values: z.infer<typeof volunteerSchema>, dupAck = false, dupReason: string | null = null) {
        setIsSubmitting(true)
        try {
            const { error } = await supabase.from('volunteers').insert([
                {
                    full_name: values.fullName,
                    email: normalizeEmail(values.email),
                    phone: normalizePhone(values.phone) || values.phone,
                    age: values.role === "Teenager" ? values.age : null,
                    gender: values.gender,
                    region: values.region,
                    province: values.region === "Other (Outside Lagos/Ogun)" ? "Other" : values.province,
                    other_region_specified: values.region === "Other (Outside Lagos/Ogun)" ? values.otherRegionSpecified : null,
                    role: values.role, // 'Teenager' or 'Teacher' stored directly
                    department: values.department,
                    status: 'pending', // Default status
                    duplicate_acknowledged: dupAck,
                    duplicate_flag_reason: dupReason
                }
            ]);

            if (error) throw error;

            window.location.href = '/registration-success?type=volunteer';
        } catch (error: any) {
            console.error("Volunteer Registration Error:", error);
            toast.error("Registration failed. Please try again.", error.message || "Unknown error");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function onSubmit(values: z.infer<typeof volunteerSchema>) {
        // Run duplicate check (fail-closed: if check fails, block submission)
        try {
            const normalizedPhone = normalizePhone(values.phone);
            const normalizedEmailVal = normalizeEmail(values.email);
            const allMatches: any[] = [];
            const seenIds = new Set<string>();

            // Query by phone (if provided)
            if (normalizedPhone) {
                const { data: phoneMatches, error: phoneErr } = await supabase
                    .from('volunteers')
                    .select('*')
                    .eq('phone', normalizedPhone)
                    .neq('status', 'rejected');
                if (phoneErr) throw phoneErr;
                if (phoneMatches) {
                    for (const m of phoneMatches) {
                        if (!seenIds.has(m.id)) { seenIds.add(m.id); allMatches.push(m); }
                    }
                }
            }

            // Query by email (if provided)
            if (normalizedEmailVal) {
                const { data: emailMatches, error: emailErr } = await supabase
                    .from('volunteers')
                    .select('*')
                    .eq('email', normalizedEmailVal)
                    .neq('status', 'rejected');
                if (emailErr) throw emailErr;
                if (emailMatches) {
                    for (const m of emailMatches) {
                        if (!seenIds.has(m.id)) { seenIds.add(m.id); allMatches.push(m); }
                    }
                }
            }

            // Also try matching with the raw phone in case DB hasn't been normalized yet
            const rawPhone = values.phone?.trim();
            if (rawPhone && rawPhone !== normalizedPhone) {
                const { data: rawPhoneMatches, error: rawPhoneErr } = await supabase
                    .from('volunteers')
                    .select('*')
                    .eq('phone', rawPhone)
                    .neq('status', 'rejected');
                if (rawPhoneErr) throw rawPhoneErr;
                if (rawPhoneMatches) {
                    for (const m of rawPhoneMatches) {
                        if (!seenIds.has(m.id)) { seenIds.add(m.id); allMatches.push(m); }
                    }
                }
            }

            if (allMatches.length > 0) {
                const targetNameClean = cleanNameForComparison(values.fullName);
                const scoredMatches = allMatches
                    .map(v => {
                        const existingNameClean = cleanNameForComparison(v.full_name);
                        const similarity = getJaroWinklerDistance(targetNameClean, existingNameClean);
                        return { ...v, similarity };
                    })
                    .filter(v => v.similarity >= 0.80)
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 3);

                if (scoredMatches.length > 0) {
                    const topSimilarity = scoredMatches[0].similarity;
                    setDuplicateMatches(scoredMatches);
                    setPendingValues(values);
                    // ≥95% = hard block, 80-94% = soft warning
                    setDuplicateMode(topSimilarity >= 0.95 ? 'hard' : 'soft');
                    setShowDuplicateModal(true);
                    return;
                }
            }
        } catch (err) {
            console.error("Duplicate check failed:", err);
            toast.error("Could not verify registration. Please try again.", "Network error during verification.");
            return; // Fail-closed: block submission
        }

        await proceedToInsert(values);
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => {
                toast.error("Registration failed. Please try again.", "Please correct the highlighted errors in the form.");
            })} className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control as any} name="fullName" render={({ field }) => (
                        <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control as any} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="hello@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control as any} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="080..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control as any} name="role" render={({ field }) => (
                         <FormItem className="space-y-3"><FormLabel className="font-semibold text-slate-800">I am a...</FormLabel>
                             <FormControl>
                                 <div className="flex flex-row flex-wrap items-center gap-6 mt-1.5 h-11">
                                     <label className="flex items-center space-x-2.5 cursor-pointer font-medium text-sm text-slate-700">
                                         <input 
                                             type="radio" 
                                             name="role" 
                                             value="Teenager" 
                                             checked={field.value === 'Teenager'} 
                                             onChange={() => {
                                                 field.onChange('Teenager');
                                                 form.setValue('age', 15);
                                             }}
                                             className="appearance-none w-4 h-4 rounded-full border border-slate-300 checked:border-orange-500 checked:bg-orange-500 relative cursor-pointer outline-none checked:after:content-[''] checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:w-1.5 checked:after:h-1.5 checked:after:rounded-full checked:after:bg-white transition-all shrink-0"
                                         />
                                         <span>Teenager</span>
                                     </label>
                                     <label className="flex items-center space-x-2.5 cursor-pointer font-medium text-sm text-slate-700">
                                         <input 
                                             type="radio" 
                                             name="role" 
                                             value="Teacher" 
                                             checked={field.value === 'Teacher'} 
                                             onChange={() => {
                                                 field.onChange('Teacher');
                                                 form.setValue('age', null);
                                             }}
                                             className="appearance-none w-4 h-4 rounded-full border border-slate-300 checked:border-orange-500 checked:bg-orange-500 relative cursor-pointer outline-none checked:after:content-[''] checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:w-1.5 checked:after:h-1.5 checked:after:rounded-full checked:after:bg-white transition-all shrink-0"
                                         />
                                         <span>Teacher</span>
                                     </label>
                                 </div>
                             </FormControl><FormMessage /></FormItem>
                     )} />
                 </div>

                <div className={watchRole === "Teenager" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
                    <FormField control={form.control as any} name="gender" render={({ field }) => (
                        <FormItem><FormLabel>Gender</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                            </Select><FormMessage /></FormItem>
                    )} />
                    {watchRole === "Teenager" && (
                        <FormField control={form.control as any} name="age" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Age</FormLabel>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control as any} name="region" render={({ field }) => (
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
                        <FormField control={form.control as any} name="otherRegionSpecified" render={({ field }) => (
                            <FormItem><FormLabel>Please specify your Region / Continent</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Region 5 / Europe" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    ) : (
                        <FormField control={form.control as any} name="province" render={({ field }) => (
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

                <FormField control={form.control as any} name="department" render={({ field }) => (
                    <FormItem><FormLabel>Preferred Department</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {VOLUNTEER_DEPARTMENTS.map(dept => (
                                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select><FormMessage /></FormItem>
                )} />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...</> : "Join Volunteer Force"}
                </Button>
            </form>
            <DuplicateWarningModal
                isOpen={showDuplicateModal}
                type="volunteer"
                matches={duplicateMatches}
                mode={duplicateMode}
                onCancel={() => {
                    setShowDuplicateModal(false);
                    if (pendingValues && duplicateMode === 'soft') {
                        const maskedPhone = pendingValues.phone.length > 4 ? "****" + pendingValues.phone.slice(-4) : pendingValues.phone;
                        const match = duplicateMatches[0];
                        const reason = `Phone/email matched ${maskedPhone}, name similarity: ${Math.round(match.similarity * 100)}%`;
                        proceedToInsert(pendingValues, true, reason);
                    }
                }}
                onClose={() => setShowDuplicateModal(false)}
            />
        </Form>
    )
}
