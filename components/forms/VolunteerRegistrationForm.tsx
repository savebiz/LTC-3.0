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
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { supabase } from "@/lib/supabase";
import { VOLUNTEER_DEPARTMENTS, REGIONS_AND_PROVINCES } from "@/constants"

const volunteerSchema = z.object({
    fullName: z.string().min(2, { message: "Required" }),
    email: z.string().email(),
    phone: z.string().min(10),
    age: z.coerce.number().min(10).max(100),
    gender: z.enum(["Male", "Female"]),
    region: z.string().min(1, { message: "Select a region" }),
    province: z.string().min(1, { message: "Select a province" }),
    role: z.enum(["Teenager", "Teacher"]),
    department: z.string().min(1, { message: "Select a department" }),
    experience: z.string().optional(),
})

export function VolunteerRegistrationForm({ onSuccess }: { onSuccess: () => void }) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<z.infer<typeof volunteerSchema>>({
        resolver: zodResolver(volunteerSchema),
        defaultValues: { fullName: "", email: "", phone: "", age: 18, region: "", province: "", role: "Teenager", department: "" },
    })
    const watchRegion = form.watch("region")
    const provinces = watchRegion ? REGIONS_AND_PROVINCES[watchRegion] || [] : []

    async function onSubmit(values: z.infer<typeof volunteerSchema>) {
        setIsSubmitting(true)
        try {
            const { error } = await supabase.from('volunteers').insert([
                {
                    full_name: values.fullName,
                    email: values.email,
                    phone: values.phone,
                    age: values.age,
                    gender: values.gender,
                    region: values.region,
                    province: values.province,
                    role: values.role, // 'Teenager' or 'Teacher' stored directly
                    department: values.department,
                    status: 'pending' // Default status
                }
            ]);

            if (error) throw error;

            // onSuccess(); // Skip success modal to avoid flash, just redirect
            window.location.href = '/registration-success?type=volunteer';
        } catch (error: any) {
            console.error("Volunteer Registration Error:", error);
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
                        <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
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
                    <FormItem className="space-y-3"><FormLabel>I am a...</FormLabel>
                        <FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-row space-x-4">
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="Teenager" /></FormControl><FormLabel className="font-normal">Teenager</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="Teacher" /></FormControl><FormLabel className="font-normal">Teacher</FormLabel>
                                </FormItem>
                            </RadioGroup>
                        </FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="department" render={({ field }) => (
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
        </Form>
    )
}
