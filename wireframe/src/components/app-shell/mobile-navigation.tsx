"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { navigationEntries } from "@/components/app-shell/app-navigation";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const enabled = navigationEntries.filter((entry) => entry.enabled);
  return <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white" variant="outline" size="icon" aria-label="Open navigation"><MenuIcon /></Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>FloodReady</SheetTitle><SheetDescription>Use the available product views.</SheetDescription></SheetHeader>{enabled.length > 0 ? <nav aria-label="Mobile navigation"><ul>{enabled.map((entry) => <li key={entry.href}><a href={entry.href} onClick={() => setOpen(false)}>{entry.label}</a></li>)}</ul></nav> : null}</SheetContent></Sheet>;
}
