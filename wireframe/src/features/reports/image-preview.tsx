"use client";

import { useEffect, useState } from "react";

export function ImagePreview({ file }: { file: File | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file === null) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  if (url === null) return null;
  return <img src={url} alt="Selected flood evidence preview" className="mt-3 max-h-72 w-full rounded-md border border-slate-300 bg-slate-100 object-contain" />;
}
