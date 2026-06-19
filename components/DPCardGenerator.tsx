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

// Measured pixel coordinates of circular photo cutouts and rectangular name banners on the 724x1024px templates.
const TEMPLATE_COORDS = {
    blue: {
        circle: { x: 368.5, y: 517.0, r: 152.0 },
        rect: { x: 111, y: 701, w: 519, h: 70 }
    },
    orange: {
        circle: { x: 368.5, y: 517.0, r: 146.0 },
        rect: { x: 104, y: 692, w: 516, h: 71 }
    }
};

export default function DPCardGenerator({ registrants, darkMode = false }: DPCardGeneratorProps) {
    const [selectedRegIndex, setSelectedRegIndex] = useState(0);
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [showPhotoOptions, setShowPhotoOptions] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [canShare, setCanShare] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Template states
    const [templateVariant, setTemplateVariant] = useState<'blue' | 'orange'>('blue');
    const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(null);
    
    // Photo alignment and zoom manipulation states
    const [scale, setScale] = useState(1.0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    
    // Pinch-to-zoom support for mobile viewports
    const [isPinching, setIsPinching] = useState(false);
    const [initialTouchDist, setInitialTouchDist] = useState(0);
    const [initialScale, setInitialScale] = useState(1.0);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const galleryInputRef = useRef<HTMLInputElement | null>(null);
    const activeObjectUrlRef = useRef<string | null>(null);

    // Cache template images on mount to avoid redundant loads
    const blueTemplateRef = useRef<HTMLImageElement | null>(null);
    const orangeTemplateRef = useRef<HTMLImageElement | null>(null);

    // Detect device type & Web Share API support
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

        // Preload templates
        const blueImg = new Image();
        blueImg.onload = () => {
            blueTemplateRef.current = blueImg;
            if (templateVariant === 'blue') {
                setTemplateImage(blueImg);
            }
        };
        blueImg.src = '/DP_Blue.png';

        const orangeImg = new Image();
        orangeImg.onload = () => {
            orangeTemplateRef.current = orangeImg;
            if (templateVariant === 'orange') {
                setTemplateImage(orangeImg);
            }
        };
        orangeImg.src = '/DP_Orange.png';

        // Cleanup Object URL on unmount
        return () => {
            if (activeObjectUrlRef.current) {
                console.log("DPCardGenerator: Unmounting, revoking active Object URL:", activeObjectUrlRef.current);
                URL.revokeObjectURL(activeObjectUrlRef.current);
            }
        };
    }, []);

    // Load templates when variant is toggled
    useEffect(() => {
        if (templateVariant === 'blue' && blueTemplateRef.current) {
            setTemplateImage(blueTemplateRef.current);
        } else if (templateVariant === 'orange' && orangeTemplateRef.current) {
            setTemplateImage(orangeTemplateRef.current);
        }
    }, [templateVariant]);

    // Redraw canvas if selected delegate, image, scale, offsets, or template loads
    useEffect(() => {
        if (templateImage) {
            drawCanvas();
        }
    }, [templateImage, selectedImage, selectedRegIndex, scale, offset, templateVariant]);

    // Add passive: false wheel event listener directly to canvas to prevent default page scrolling while zooming
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const preventDefaultWheel = (e: WheelEvent) => {
            if (selectedImage) {
                e.preventDefault();
            }
        };

        canvas.addEventListener('wheel', preventDefaultWheel, { passive: false });
        return () => {
            canvas.removeEventListener('wheel', preventDefaultWheel);
        };
    }, [selectedImage]);

    // Helper to scale client coordinate shifts to canvas coordinates (724x1024px grid)
    const getCanvasScaleRatio = () => {
        const canvas = canvasRef.current;
        if (!canvas) return 1;
        return canvas.width / canvas.offsetWidth;
    };

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

        if (activeObjectUrlRef.current) {
            console.log("DPCardGenerator: Revoking old object URL:", activeObjectUrlRef.current);
            URL.revokeObjectURL(activeObjectUrlRef.current);
        }

        const objectUrl = URL.createObjectURL(file);
        activeObjectUrlRef.current = objectUrl;
        console.log("DPCardGenerator: Created object URL:", objectUrl);

        const img = new Image();
        img.onload = () => {
            setSelectedImage(img);
            setScale(1.0);
            setOffset({ x: 0, y: 0 });
            setShowPhotoOptions(false);
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

    // Mouse Interactions for Crop Dragging
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!selectedImage) return;
        setIsDragging(true);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        const scaleRatio = getCanvasScaleRatio();
        
        setDragStart({
            x: clientX * scaleRatio - offset.x,
            y: clientY * scaleRatio - offset.y
        });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDragging || !selectedImage) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        const scaleRatio = getCanvasScaleRatio();

        setOffset({
            x: clientX * scaleRatio - dragStart.x,
            y: clientY * scaleRatio - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Touch Interactions for mobile viewports (supports pinch-to-zoom + dragging)
    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (!selectedImage) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const scaleRatio = getCanvasScaleRatio();

        if (e.touches.length === 1) {
            setIsDragging(true);
            const touch = e.touches[0];
            const clientX = touch.clientX - rect.left;
            const clientY = touch.clientY - rect.top;
            setDragStart({
                x: clientX * scaleRatio - offset.x,
                y: clientY * scaleRatio - offset.y
            });
        } else if (e.touches.length === 2) {
            setIsDragging(false);
            setIsPinching(true);
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            setInitialTouchDist(dist);
            setInitialScale(scale);
        }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (!selectedImage) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const scaleRatio = getCanvasScaleRatio();

        if (isDragging && e.touches.length === 1) {
            const touch = e.touches[0];
            const clientX = touch.clientX - rect.left;
            const clientY = touch.clientY - rect.top;
            setOffset({
                x: clientX * scaleRatio - dragStart.x,
                y: clientY * scaleRatio - dragStart.y
            });
        } else if (isPinching && e.touches.length === 2) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            if (initialTouchDist > 0) {
                const factor = dist / initialTouchDist;
                setScale(Math.max(0.5, Math.min(5.0, initialScale * factor)));
            }
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        setIsPinching(false);
    };

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        if (!selectedImage) return;
        const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
        setScale(prev => Math.max(0.5, Math.min(5.0, prev * zoomFactor)));
    };

    const drawCanvas = async () => {
        if (!templateImage || !canvasRef.current) return;
        setIsDrawing(true);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setIsDrawing(false);
            return;
        }

        // Output matches the precise template resolution
        canvas.width = 724;
        canvas.height = 1024;

        // Layer 1 - Draw pre-designed PNG base layer
        ctx.drawImage(templateImage, 0, 0, 724, 1024);

        const coords = TEMPLATE_COORDS[templateVariant];

        // Layer 2 - Composite delegate photo inside circular cutout
        if (selectedImage) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(coords.circle.x, coords.circle.y, coords.circle.r, 0, Math.PI * 2);
            ctx.clip();

            const imgWidth = selectedImage.width;
            const imgHeight = selectedImage.height;
            const baseScale = Math.max((coords.circle.r * 2) / imgWidth, (coords.circle.r * 2) / imgHeight);
            const drawWidth = imgWidth * baseScale * scale;
            const drawHeight = imgHeight * baseScale * scale;

            const dx = coords.circle.x - drawWidth / 2 + offset.x;
            const dy = coords.circle.y - drawHeight / 2 + offset.y;

            ctx.drawImage(selectedImage, dx, dy, drawWidth, drawHeight);
            ctx.restore();
        }

        // Layer 3 - Draw delegate name inside rectangular banner cutout
        const currentReg = registrants[selectedRegIndex];
        if (currentReg) {
            const fullName = (currentReg.full_name || currentReg.fullName || 'DELEGATE').toUpperCase();
            
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#0f172a'; // Bold dark navy text

            let fontSize = 28;
            ctx.font = `bold ${fontSize}px "Outfit", "Inter", sans-serif`;
            let textWidth = ctx.measureText(fullName).width;
            const maxTextWidth = coords.rect.w - 20;

            while (textWidth > maxTextWidth && fontSize > 12) {
                fontSize -= 1;
                ctx.font = `bold ${fontSize}px "Outfit", "Inter", sans-serif`;
                textWidth = ctx.measureText(fullName).width;
            }

            const textX = coords.rect.x + coords.rect.w / 2;
            const textY = coords.rect.y + coords.rect.h / 2;

            ctx.fillText(fullName, textX, textY);
            ctx.restore();
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

            {/* Template Variant Toggle Buttons */}
            <div className="flex flex-col items-center space-y-2">
                <label className={`text-xs font-black uppercase tracking-wider ${labelColorClass}`}>
                    Choose Template Variant
                </label>
                <div className={`inline-flex p-1 rounded-xl border ${
                    darkMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
                }`}>
                    <button
                        type="button"
                        onClick={() => setTemplateVariant('blue')}
                        className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            templateVariant === 'blue'
                                ? 'bg-[#F97316] text-white shadow-md'
                                : darkMode
                                    ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/40'
                        }`}
                    >
                        Blue Variant
                    </button>
                    <button
                        type="button"
                        onClick={() => setTemplateVariant('orange')}
                        className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            templateVariant === 'orange'
                                ? 'bg-[#F97316] text-white shadow-md'
                                : darkMode
                                    ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/40'
                        }`}
                    >
                        Orange Variant
                    </button>
                </div>
            </div>

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

            {/* Hidden file upload inputs */}
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
                    <div className="relative w-full max-w-[480px] flex flex-col items-center space-y-2">
                        <div className="w-full flex justify-center shadow-2xl rounded-2xl overflow-hidden border border-zinc-800">
                            <canvas
                                ref={canvasRef}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                onWheel={handleWheel}
                                style={{
                                    width: '100%',
                                    maxWidth: isMobile ? '380px' : '480px',
                                    aspectRatio: '724/1024',
                                    cursor: isDragging ? 'grabbing' : 'grab',
                                    touchAction: 'none' // Prevent double-tap zooming on mobile
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
                        <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase animate-pulse">
                            💡 Drag photo to reposition · Scroll or pinch to zoom
                        </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[480px]">
                        {canShare && (
                            <Button
                                onClick={handleShareWhatsApp}
                                className="flex-1 h-12 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm md:text-base active:scale-95 cursor-pointer"
                            >
                                <Share2 size={18} /> Share to WhatsApp
                            </Button>
                        )}
                        <Button
                            onClick={handleSaveImage}
                            className={`flex-1 h-12 bg-transparent border-2 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm md:text-base active:scale-95 cursor-pointer ${
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

            {/* Select Photo Source Modal */}
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
