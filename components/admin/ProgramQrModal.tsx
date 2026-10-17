import React, { useState, useRef } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { 
    X, Download, Copy, Check, ExternalLink, QrCode, 
    Sparkles, Printer, Smartphone, Info 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProgramQrModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProgramQrModal({ isOpen, onClose }: ProgramQrModalProps) {
    const defaultUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/program` 
        : 'https://continent3teens.cc/program';

    const [targetUrl, setTargetUrl] = useState('https://continent3teens.cc/program');
    const [copied, setCopied] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(targetUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadPng = () => {
        setIsDownloading(true);
        try {
            const canvas = canvasRef.current?.querySelector('canvas');
            if (!canvas) return;

            // Generate high-res download
            const imageUri = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `C3TC26_Day_Program_QR_HighRes.png`;
            link.href = imageUri;
            link.click();
        } catch (err) {
            console.error('Failed to download PNG QR code:', err);
        } finally {
            setIsDownloading(false);
        }
    };

    const downloadSvg = () => {
        try {
            const svgElement = document.getElementById('c3tc-program-qr-svg');
            if (!svgElement) return;

            const serializer = new XMLSerializer();
            const source = serializer.serializeToString(svgElement);
            const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.download = `C3TC26_Day_Program_QR_Vector.svg`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download SVG QR code:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* MODAL HEADER */}
                <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                            <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                                Arena Day-Program QR Code
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30">
                                    C3TC '26
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400">
                                High-resolution printable QR code for arena banners & screen displays
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* MODAL BODY */}
                <div className="p-6 overflow-y-auto space-y-5">
                    {/* QR CODE CARD WITH BRANDED FRAME */}
                    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-xl mx-auto w-full max-w-xs text-center border-4 border-orange-500/30">
                        <div className="mb-2">
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 block font-heading">
                                CONTINENT 3 TEENS CONFERENCE
                            </span>
                            <span className="text-[9px] font-bold text-orange-600 block tracking-wider">
                                SCAN FOR LIVE PROGRAM & DECLARATIONS
                            </span>
                        </div>

                        {/* Interactive SVG Display */}
                        <div className="p-2.5 bg-white rounded-xl">
                            <QRCodeSVG
                                id="c3tc-program-qr-svg"
                                value={targetUrl}
                                size={200}
                                level="H"
                                includeMargin={true}
                            />
                        </div>

                        {/* Hidden High-Resolution 2000px Canvas for 300 DPI Export */}
                        <div ref={canvasRef} className="hidden">
                            <QRCodeCanvas
                                value={targetUrl}
                                size={2000}
                                level="H"
                                includeMargin={true}
                            />
                        </div>

                        <div className="mt-2 text-slate-600 text-[10px] font-mono font-medium">
                            glory arena • redemption city
                        </div>
                    </div>

                    {/* TARGET URL & QUICK COPY */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                            Target Destination URL
                        </label>
                        <div className="flex items-center gap-2">
                            <Input
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                className="bg-slate-950 border-slate-800 text-xs font-mono text-slate-200 h-10"
                            />
                            <Button
                                onClick={handleCopy}
                                size="sm"
                                variant="outline"
                                className="h-10 px-3 border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-slate-200 shrink-0"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </Button>
                            <a
                                href={targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="h-10 px-3 rounded-lg border border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-slate-200 flex items-center justify-center shrink-0"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* USAGE RECOMMENDATIONS */}
                    <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs space-y-1.5 text-slate-300">
                        <div className="flex items-center gap-1.5 text-orange-400 font-bold">
                            <Printer className="w-3.5 h-3.5" />
                            <span>Publicity & Media Team Guidelines</span>
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px] leading-relaxed">
                            <li><strong className="text-slate-200">Stage & Arena Displays:</strong> Use <strong>SVG (Vector)</strong> for projectors and LED backdrops so it scales infinitely without blur.</li>
                            <li><strong className="text-slate-200">Roll-Up Banners & Flyers:</strong> Use <strong>High-Res PNG (300 DPI)</strong> for crisp print clarity even from a distance.</li>
                            <li><strong className="text-slate-200">No Delegate Login Required:</strong> Scanning this opens the interactive mobile program instantly for all 3,500+ attendees.</li>
                        </ul>
                    </div>

                    {/* DOWNLOAD ACTIONS */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <Button
                            onClick={downloadPng}
                            disabled={isDownloading}
                            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs h-11 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-[0.98]"
                        >
                            <Download className="w-4 h-4" />
                            <span>Download PNG (300 DPI)</span>
                        </Button>

                        <Button
                            onClick={downloadSvg}
                            variant="outline"
                            className="w-full border-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs h-11 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            <Download className="w-4 h-4 text-orange-400" />
                            <span>Download Vector SVG</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
