import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useDialog } from '../ui/DialogProvider';
import { Plus, Trash2, Loader2, Users } from 'lucide-react';

export default function SettingsPage() {
    const { toast } = useDialog();
    const [volunteers, setVolunteers] = useState<string[]>([]);
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Fetch current volunteers list
    async function fetchSettings() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .eq('key', 'checkin_volunteers')
                .single();

            if (!error && data && Array.isArray(data.value)) {
                setVolunteers(data.value);
            } else {
                // If not seeded yet, default list
                const defaultList = ["Registration Team Lead", "Victor Sabo", "Volunteer Name 1", "Volunteer Name 2"];
                setVolunteers(defaultList);
            }
        } catch (err: any) {
            console.error('Failed to load check-in settings:', err);
            toast.error('Error Loading Settings', 'Could not read volunteer configuration.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchSettings();
    }, []);

    // Save list helper
    async function saveVolunteerList(updatedList: string[]) {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': 'C3TC@admin2026'
                },
                body: JSON.stringify({
                    key: 'checkin_volunteers',
                    value: updatedList
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP error ${res.status}`);
            }

            setVolunteers(updatedList);
            toast.success('Settings Saved', 'Volunteer list updated successfully.');
        } catch (err: any) {
            console.error('Failed to update volunteer list settings:', err);
            toast.error('Failed to Save', err.message || 'Settings database write failed.');
        } finally {
            setSaving(false);
        }
    }

    // Add Name Handler
    const handleAddVolunteer = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanName = newName.trim();
        if (!cleanName) return;

        if (volunteers.some(v => v.toLowerCase() === cleanName.toLowerCase())) {
            toast.error('Duplicate Name', 'This volunteer name is already in the list.');
            return;
        }

        const updated = [...volunteers, cleanName];
        await saveVolunteerList(updated);
        setNewName('');
    };

    // Remove Name Handler
    const handleRemoveVolunteer = async (nameToRemove: string) => {
        const updated = volunteers.filter(v => v !== nameToRemove);
        await saveVolunteerList(updated);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-3">
                <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
                <p className="text-sm text-slate-500">Loading settings configuration...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold font-heading text-slate-800">Admin Settings</h2>
                <p className="text-sm text-slate-500">Manage admin portal configurations and operator identities.</p>
            </div>

            <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Users size={20} className="text-orange-500" />
                        Check-in Volunteers List
                    </CardTitle>
                    <p className="text-xs text-slate-400 font-medium">
                        Configure the pre-populated list of authorized volunteers displayed on the admin login screen.
                    </p>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Add form */}
                    <form onSubmit={handleAddVolunteer} className="flex gap-2">
                        <Input
                            placeholder="Enter volunteer full name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            disabled={saving}
                            className="flex-1 h-11 border-slate-200 focus:border-orange-500 focus:ring-orange-500 rounded-xl"
                            maxLength={50}
                        />
                        <Button
                            type="submit"
                            disabled={saving || !newName.trim()}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 px-5 rounded-xl flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 transition-all"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />}
                            Add Volunteer
                        </Button>
                    </form>

                    {/* Volunteers list */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Volunteers ({volunteers.length})</h4>
                        {volunteers.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 border border-dashed rounded-xl bg-slate-50/50">
                                No check-in volunteers configured. Logins will default to write-in.
                            </div>
                        ) : (
                            <div className="divide-y border rounded-xl divide-slate-100 border-slate-200 overflow-hidden bg-white">
                                {volunteers.map((name) => (
                                    <div key={name} className="flex items-center justify-between py-3 px-4 hover:bg-slate-50/40 transition-colors">
                                        <span className="text-sm font-semibold text-slate-700">{name}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveVolunteer(name)}
                                            disabled={saving}
                                            className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 active:scale-95 transition-all cursor-pointer"
                                            title={`Remove ${name}`}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
