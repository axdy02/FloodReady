"use client";
import { useEffect, useState } from "react";
export function ImagePreview({ file }: { file: File | null }) { const [url, setUrl] = useState<string | null>(null); useEffect(() => { if (file === null) { setUrl(null); return; } const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]); return url ? <img src={url} alt="Selected flood evidence" /> : null; }
