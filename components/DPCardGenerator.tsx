import React, { useState, useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Camera, Download, Share2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Registrant {
    full_name?: string;
    fullName?: string;
    category: string;
}

interface DPCardGeneratorProps {
    registrants: Registrant[];
    darkMode?: boolean;
}

export default function DPCardGenerator({ registrants, darkMode = false }: DPCardGeneratorProps) {
    const [selectedRegIndex, setSelectedRegIndex] = useState(0);
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [showPhotoOptions, setShowPhotoOptions] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [canShare, setCanShare] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const galleryInputRef = useRef<HTMLInputElement | null>(null);
    const dtceLogoRef = useRef<HTMLImageElement | null>(null);
    const c3tcLogoRef = useRef<HTMLImageElement | null>(null);
    const activeObjectUrlRef = useRef<string | null>(null);

    // Detect if device is mobile & Web Share API support
    useEffect(() => {
        setIsMounted(true);
        const checkDevice = () => {
            const ua = navigator.userAgent || '';
            const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
            const mobile = mobileRegex.test(ua) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            setIsMobile(mobile);

            if (navigator.share && navigator.canShare) {
                try {
                    const testFile = new File([], 'test.png', { type: 'image/png' });
                    if (navigator.canShare({ files: [testFile] })) {
                        setCanShare(true);
                    }
                } catch (e) {
                    setCanShare(false);
                }
            }
        };
        checkDevice();

        // Cleanup Object URL on unmount
        return () => {
            if (activeObjectUrlRef.current) {
                console.log("DPCardGenerator: Unmounting, revoking active Object URL:", activeObjectUrlRef.current);
                URL.revokeObjectURL(activeObjectUrlRef.current);
            }
        };
    }, []);

    // Load logo images on mount
    useEffect(() => {
        let loadedCount = 0;
        const onLogoLoad = () => {
            loadedCount++;
            if (loadedCount === 2 && selectedImage) {
                drawCanvas();
            }
        };

        const imgDtce = new Image();
        imgDtce.onload = () => {
            dtceLogoRef.current = imgDtce;
            onLogoLoad();
        };
        imgDtce.src = '/logos/DTCE_Junior_Church_Revised-bg.png';

        const imgC3tc = new Image();
        imgC3tc.onload = () => {
            c3tcLogoRef.current = imgC3tc;
            onLogoLoad();
        };
        imgC3tc.src = '/logos/LTC_Logo_white.png';
    }, []);

    // Redraw canvas if selected delegate, image, or fonts load
    useEffect(() => {
        if (selectedImage) {
            drawCanvas();
        }
    }, [selectedImage, selectedRegIndex]);

    // Hook to redraw when document fonts load
    useEffect(() => {
        if (document.fonts) {
            document.fonts.ready.then(() => {
                if (selectedImage) {
                    drawCanvas();
                }
            });
        }
    }, [selectedImage]);

    const handlePhotoAreaClick = () => {
        if (isMobile) {
            setShowPhotoOptions(true);
        } else {
            galleryInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        console.log("DPCardGenerator: handleFileChange selected file:", file ? { name: file.name, type: file.type, size: file.size } : null);
        if (!file) return;

        // Check for unsupported HEIC/HEIF files
        const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || 
                       /\.(heic|heif)$/i.test(file.name);
        if (isHeic) {
            console.warn("DPCardGenerator: HEIC/HEIF format is not natively supported by browser <img> decoding:", file.name);
            alert("This photo format (.heic/.heif) isn't supported. Please select a JPEG or PNG image, or use 'Take a Selfie' instead.");
            return;
        }

        // Validation - support common extensions on mobile as fallback
        const isImage = file.type.startsWith('image/') || 
                        /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
        if (!isImage) {
            console.warn("DPCardGenerator: Invalid file selected:", file.type, file.name);
            alert('Invalid file format. Please upload a JPEG, PNG, or WEBP image.');
            return;
        }

        const maxSize = 15 * 1024 * 1024; // 15MB limit
        if (file.size > maxSize) {
            alert('File size exceeds the 15MB limit. Please upload a smaller image.');
            return;
        }

        // Memory-efficient Object URL logic (revoked on unmount/re-load to prevent premature garbage collection rendering failures on iOS)
        if (activeObjectUrlRef.current) {
            console.log("DPCardGenerator: Revoking old object URL:", activeObjectUrlRef.current);
            URL.revokeObjectURL(activeObjectUrlRef.current);
        }

        const objectUrl = URL.createObjectURL(file);
        activeObjectUrlRef.current = objectUrl;
        console.log("DPCardGenerator: Created object URL:", objectUrl);

        const img = new Image();
        img.onload = () => {
            console.log("DPCardGenerator: Image element loaded successfully via object URL. Size:", img.width, "x", img.height);
            setSelectedImage(img);
            setShowPhotoOptions(false);
            // DO NOT revoke objectUrl here. Mobile browsers garbage-collect the blob pixels if revoked before drawImage executes.
        };
        img.onerror = (err) => {
            console.error("DPCardGenerator: Image element load failed for object URL:", objectUrl, err);
            alert("This photo format isn't supported. Please select a JPEG or PNG image, or use 'Take a Selfie' instead.");
            if (activeObjectUrlRef.current === objectUrl) {
                URL.revokeObjectURL(objectUrl);
                activeObjectUrlRef.current = null;
            }
        };
        img.src = objectUrl;
    };

    const drawCanvas = async () => {
        if (!selectedImage || !canvasRef.current) return;
        setIsDrawing(true);

        // Subtle delay so loader is visible to user
        await new Promise((resolve) => setTimeout(resolve, 80));

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setIsDrawing(false);
            return;
        }

        // Exact portrait canvas composition (1080 x 1350px)
        canvas.width = 1080;
        canvas.height = 1350;

        const centerX = 540;
        const centerY = 580;

        // Layer 1 - Vibrant C3TC Radial Burst Background
        const rayColors = [
            { light: '#FB923C', dark: '#EA580C' }, // Orange (base #F97316)
            { light: '#60A5FA', dark: '#2563EB' }, // Blue (base #3B82F6)
            { light: '#4ADE80', dark: '#16A34A' }, // Green (base #22C55E)
            { light: '#F87171', dark: '#DC2626' }  // Red (base #EF4444)
        ];

        const numRays = 80;
        const rayAngle = (2 * Math.PI) / numRays;
        const maxRadius = 1500; // Extend past corners

        for (let i = 0; i < numRays; i++) {
            const angleStart = i * rayAngle;
            const angleEnd = (i + 1) * rayAngle;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, maxRadius, angleStart, angleEnd);
            ctx.closePath();

            const colorInfo = rayColors[i % rayColors.length];
            ctx.fillStyle = (i % 2 === 0) ? colorInfo.light : colorInfo.dark;
            ctx.fill();
        }

        // Radial gradient overlay for center glow & outer vignette depth
        const bgGrad = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, 850);
        bgGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        bgGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0)');
        bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1080, 1350);

        // Layer 2 - Center Crop & Mask photo circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 290, 0, Math.PI * 2);
        ctx.clip();

        const imgWidth = selectedImage.width;
        const imgHeight = selectedImage.height;
        const scale = Math.max(580 / imgWidth, 580 / imgHeight);
        const w = imgWidth * scale;
        const h = imgHeight * scale;
        const x = centerX - w / 2;
        const y = centerY - h / 2;

        try {
            console.log("DPCardGenerator: drawCanvas calling drawImage. Size:", selectedImage.width, "x", selectedImage.height);
            ctx.drawImage(selectedImage, x, y, w, h);
            console.log("DPCardGenerator: drawCanvas drawImage call succeeded");
        } catch (drawErr) {
            console.error("DPCardGenerator: drawCanvas drawImage failed:", drawErr);
        }
        ctx.restore();

        // 6px white circular border
        ctx.beginPath();
        ctx.arc(centerX, centerY, 290, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Layer 3 - Decorative Segmented Ring (C3TC Segment Colors)
        const gap = 0.08; // small gaps in radians

        // Top-Right Quadrant Arc: Blue (#3B82F6)
        ctx.beginPath();
        ctx.arc(centerX, centerY, 310, -Math.PI / 2 + gap, 0 - gap);
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 14;
        ctx.stroke();

        // Bottom-Right Quadrant Arc: Red (#EF4444)
        ctx.beginPath();
        ctx.arc(centerX, centerY, 310, 0 + gap, Math.PI / 2 - gap);
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 14;
        ctx.stroke();

        // Bottom-Left Quadrant Arc: Green (#22C55E)
        ctx.beginPath();
        ctx.arc(centerX, centerY, 310, Math.PI / 2 + gap, Math.PI - gap);
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 14;
        ctx.stroke();

        // Top-Left Quadrant Arc: Orange (#F97316)
        ctx.beginPath();
        ctx.arc(centerX, centerY, 310, Math.PI + gap, (3 * Math.PI) / 2 - gap);
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 14;
        ctx.stroke();

        // Layer 4 - Center Aligned Top Logo Bar
        if (dtceLogoRef.current && c3tcLogoRef.current) {
            // Draw central divider at X = 540
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(540, 55);
            ctx.lineTo(540, 105);
            ctx.stroke();

            // DTCE logo on left (height 50px, width ~55px, right aligned to 540 - 18 = 522)
            ctx.drawImage(dtceLogoRef.current, 467, 55, 55, 50);

            // C3TC logo on right (height 50px, width ~133px, left aligned to 540 + 18 = 558)
            ctx.drawImage(c3tcLogoRef.current, 558, 55, 133, 50);
        }

        // Layer 5 - Curved Text "I WILL BE ATTENDING" along top arc of circle
        const archText = "I WILL BE ATTENDING";
        ctx.font = '900 52px "Outfit", "Inter", "Helvetica Neue", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        const textRadius = 355;
        const charAngles = [];
        for (let i = 0; i < archText.length; i++) {
            charAngles.push(ctx.measureText(archText[i]).width / textRadius);
        }

        const charSpacing = 0.018; // in radians
        const totalAngle = charAngles.reduce((sum, angle) => sum + angle, 0) + (archText.length - 1) * charSpacing;
        let currentAngle = -Math.PI / 2 - totalAngle / 2;

        for (let i = 0; i < archText.length; i++) {
            const char = archText[i];
            const halfCharAngle = charAngles[i] / 2;
            const drawAngle = currentAngle + halfCharAngle;

            const tx = centerX + Math.cos(drawAngle) * textRadius;
            const ty = centerY + Math.sin(drawAngle) * textRadius;

            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(drawAngle + Math.PI / 2);

            // Outlined stroke
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 10;
            ctx.lineJoin = 'round';
            ctx.strokeText(char, 0, 0);

            // Fill
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(char, 0, 0);

            ctx.restore();

            currentAngle += charAngles[i] + charSpacing;
        }

        // Layer 6 - Text and Name Banner Composition
        const currentReg = registrants[selectedRegIndex];
        if (currentReg) {
            const fullName = (currentReg.full_name || currentReg.fullName || 'DELEGATE').toUpperCase();

            // Gradient name banner filled shape
            const bannerGrad = ctx.createLinearGradient(140, 0, 940, 0);
            bannerGrad.addColorStop(0, '#F97316'); // C3TC Orange
            bannerGrad.addColorStop(1, '#EF4444'); // C3TC Red

            ctx.save();
            // Drop shadow for the name banner
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 6;

            ctx.fillStyle = bannerGrad;
            ctx.beginPath();
            ctx.roundRect(140, 910, 800, 84, 16);
            ctx.fill();
            ctx.restore();

            // White border outline
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(140, 910, 800, 84, 16);
            ctx.stroke();

            // Render Full Name (auto-scaled to fit banner)
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let nameFontSize = 44;
            ctx.font = `900 ${nameFontSize}px "Outfit", "Inter", sans-serif`;
            let textWidth = ctx.measureText(fullName).width;

            while (textWidth > 720 && nameFontSize > 22) {
                nameFontSize -= 2;
                ctx.font = `900 ${nameFontSize}px "Outfit", "Inter", sans-serif`;
                textWidth = ctx.measureText(fullName).width;
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(fullName, centerX, 952);

            // Layer 7 - Closing Line "SEE YOU AT T.I.M.E '26"
            ctx.font = '900 52px "Outfit", "Inter", "Helvetica Neue", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Outline
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.lineWidth = 10;
            ctx.lineJoin = 'round';
            ctx.strokeText("SEE YOU AT T.I.M.E '26", centerX, 1070);

            // Fill
            ctx.fillStyle = '#F97316';
            ctx.fillText("SEE YOU AT T.I.M.E '26", centerX, 1070);

            // Layer 8 - Footer Strip (Date, Venue, website URL)
            // Slate-900 background strip
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(0, 1230, 1080, 120);

            // Top orange accent line
            ctx.fillStyle = '#F97316';
            ctx.fillRect(0, 1230, 1080, 4);

            // DATE details (left aligned)
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#94A3B8';
            ctx.font = 'bold 16px "Outfit", "Inter", sans-serif';
            ctx.fillText('DATE', 80, 1270);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = '900 28px "Outfit", "Inter", sans-serif';
            ctx.fillText('FRI. 19TH SEP. 2026', 80, 1305);

            // VENUE details (right aligned)
            ctx.textAlign = 'right';
            ctx.fillStyle = '#94A3B8';
            ctx.font = 'bold 16px "Outfit", "Inter", sans-serif';
            ctx.fillText('VENUE', 1000, 1270);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = '900 28px "Outfit", "Inter", sans-serif';
            ctx.fillText('GLORY ARENA, OGUN STATE', 1000, 1305);

            // Website URL (center aligned)
            ctx.textAlign = 'center';
            ctx.fillStyle = '#F97316';
            ctx.font = 'bold 16px "Outfit", sans-serif';
            ctx.fillText('continent3teens.cc', centerX, 1335);
        }

        setIsDrawing(false);
    };

    const handleSaveImage = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const currentReg = registrants[selectedRegIndex];
        const fullName = currentReg?.full_name || currentReg?.fullName || 'DELEGATE';
        const firstName = fullName.trim().split(/\s+/)[0];

        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `C3TC-TIME26-${firstName}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    };

    const handleShareWhatsApp = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const currentReg = registrants[selectedRegIndex];
        const fullName = currentReg?.full_name || currentReg?.fullName || 'DELEGATE';
        const firstName = fullName.trim().split(/\s+/)[0];

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const file = new File([blob], `C3TC-TIME26-${firstName}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: "I'm going to C3TC T.I.M.E '26!",
                        text: "Join me at the Continent 3 Teens Conference! Register at continent3teens.cc",
                    });
                } catch (err) {
                    console.error('Web Share failed, falling back to download:', err);
                    handleSaveImage();
                }
            } else {
                handleSaveImage();
            }
        }, 'image/png');
    };

    // Color/Styles based on page background context
    const labelColorClass = darkMode ? 'text-zinc-400' : 'text-zinc-500';
    const titleColorClass = darkMode
        ? 'bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent'
        : 'text-[#0A1628]';
    const cardBgClass = darkMode
        ? 'bg-zinc-950/40 border-zinc-800/80'
        : 'bg-zinc-50/60 border-zinc-200';

    return (
        <div className={`mt-8 pt-6 border-t ${darkMode ? 'border-zinc-800/60' : 'border-zinc-200'} space-y-6 w-full`}>
            {/* Header Title & Subtitle */}
            <div className="text-center space-y-1.5">
                <h3 className={`text-xl md:text-2xl font-black font-heading ${titleColorClass}`}>
                    🎉 Create Your T.I.M.E '26 DP
                </h3>
                <p className="text-xs md:text-sm text-zinc-400 font-medium">
                    Add your photo and share that you're going!
                </p>
            </div>

            {/* Motivational copy */}
            <p className={`text-xs md:text-sm text-center leading-relaxed max-w-md mx-auto ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>
                Your DP, your announcement. Let your friends know you're part of something incredible. 📸
            </p>

            {/* Select dropdown if multiple delegates in batch */}
            {registrants.length > 1 && (
                <div className={`p-4 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 ${cardBgClass}`}>
                    <div className="space-y-0.5">
                        <label className={`text-xs font-bold uppercase tracking-wide ${labelColorClass}`}>
                            Select Delegate
                        </label>
                        <p className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            Choose who to generate the DP card for
                        </p>
                    </div>
                    <select
                        value={selectedRegIndex}
                        onChange={(e) => setSelectedRegIndex(Number(e.target.value))}
                        className={`h-11 px-3 py-1.5 rounded-xl text-sm border font-medium focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all ${
                            darkMode
                                ? 'bg-zinc-900 border-zinc-800 text-white'
                                : 'bg-white border-zinc-200 text-zinc-800'
                        }`}
                    >
                        {registrants.map((reg, idx) => (
                            <option key={idx} value={idx}>
                                {reg.full_name || reg.fullName}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* File upload hidden inputs (accessible, visually hidden to allow programmatic/native focus on all mobile browsers) */}
            <input
                type="file"
                id="dp-gallery-input"
                ref={galleryInputRef}
                accept="image/*"
                onChange={handleFileChange}
                style={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: '0',
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0, 0, 0, 0)',
                    whiteSpace: 'nowrap',
                    border: '0',
                    opacity: 0,
                }}
            />
            <input
                type="file"
                id="dp-camera-input"
                ref={cameraInputRef}
                accept="image/*"
                capture="user"
                onChange={handleFileChange}
                style={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: '0',
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0, 0, 0, 0)',
                    whiteSpace: 'nowrap',
                    border: '0',
                    opacity: 0,
                }}
            />

            {/* Tap to upload area */}
            <div className="flex flex-col items-center justify-center space-y-3">
                <div
                    onClick={handlePhotoAreaClick}
                    className={`w-36 h-36 rounded-full border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative ${
                        selectedImage
                            ? 'border-emerald-500'
                            : 'border-zinc-500 hover:border-orange-500 hover:bg-orange-500/5'
                    } ${darkMode ? 'bg-zinc-900/50' : 'bg-zinc-50'}`}
                >
                    {selectedImage ? (
                        <img
                            src={selectedImage.src}
                            alt="Preview"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-4">
                            <Camera className="w-8 h-8 text-zinc-400 mb-1" />
                            <span className="text-[11px] font-bold text-zinc-400 leading-tight">
                                Tap to add
                                <br />
                                your photo
                            </span>
                        </div>
                    )}
                </div>

                {selectedImage && (
                    <button
                        onClick={handlePhotoAreaClick}
                        className="text-xs text-orange-400 hover:text-orange-300 font-bold tracking-wide transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                        <RefreshCw size={12} /> Change Photo
                    </button>
                )}
            </div>

            {/* Preview & Action Buttons (Visible only if photo selected) */}
            {selectedImage && (
                <div className="space-y-6 animate-in fade-in duration-300 flex flex-col items-center">
                    {/* Live Preview canvas container */}
                    <div className="relative w-full max-w-[480px] flex justify-center shadow-2xl rounded-2xl overflow-hidden border border-zinc-800">
                        <canvas
                            ref={canvasRef}
                            style={{
                                width: '100%',
                                maxWidth: isMobile ? '380px' : '480px',
                                aspectRatio: '4/5',
                            }}
                            className="block bg-[#0A1628] rounded-2xl"
                        />
                        {isDrawing && (
                            <div className="absolute inset-0 bg-[#0A1628]/85 flex flex-col items-center justify-center space-y-2">
                                <Loader2 className="w-9 h-9 text-orange-500 animate-spin" />
                                <p className="text-xs text-zinc-400 font-medium tracking-wide">
                                    Generating your DP Card...
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action buttons (stacked on mobile, side-by-side on desktop) */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[480px]">
                        {canShare && (
                            <Button
                                onClick={handleShareWhatsApp}
                                className="flex-1 h-12 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm md:text-base active:scale-95"
                            >
                                <Share2 size={18} /> Share to WhatsApp
                            </Button>
                        )}
                        <Button
                            onClick={handleSaveImage}
                            className={`flex-1 h-12 bg-transparent border-2 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm md:text-base active:scale-95 ${
                                darkMode
                                    ? 'border-zinc-300 text-zinc-200 hover:bg-zinc-800'
                                    : 'border-[#0A1628] text-[#0A1628] hover:bg-[#0A1628] hover:text-white'
                            }`}
                        >
                            <Download size={18} /> Save Image
                        </Button>
                    </div>
                </div>
            )}

            {/* Privacy Note */}
            <p className={`text-[10px] text-center tracking-wide leading-relaxed ${darkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Your photo is never uploaded to our servers. It is processed entirely on your device.
            </p>

            {/* Select Photo Source Modal (using Radix UI Dialog primitives so it integrates with Radix's event system and blocks click-throughs correctly) */}
            <DialogPrimitive.Root open={showPhotoOptions && isMounted} onOpenChange={setShowPhotoOptions}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay 
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                        style={{
                            zIndex: 999999,
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            pointerEvents: 'auto',
                        }}
                    />
                    <DialogPrimitive.Content
                        className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl text-center focus:outline-none"
                        style={{
                            zIndex: 999999,
                            pointerEvents: 'auto',
                        }}
                    >
                        <div className="space-y-1">
                            <h4 className="text-lg font-bold text-white tracking-tight">Select Photo Source</h4>
                            <p className="text-xs text-zinc-500">Take a selfie or upload from files</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            {/* Programmatically trigger file inputs on native button click. We do NOT close the modal immediately here to prevent mobile browsers from canceling the picker due to unmounting/focus loss. */}
                            <button
                                type="button"
                                onClick={() => {
                                    console.log("DPCardGenerator: Triggering camera selfie input");
                                    cameraInputRef.current?.click();
                                }}
                                className="h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center cursor-pointer transition-all active:scale-95 text-sm md:text-base"
                            >
                                📸 Take a Selfie
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    console.log("DPCardGenerator: Triggering gallery upload input");
                                    galleryInputRef.current?.click();
                                }}
                                className="h-12 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 text-sm md:text-base"
                            >
                                🖼️ Choose from Gallery
                            </button>
                            <Button
                                variant="ghost"
                                onClick={() => setShowPhotoOptions(false)}
                                className="h-12 text-zinc-500 hover:text-zinc-300 font-medium"
                            >
                                Cancel
                            </Button>
                        </div>
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </div>
    );
}
