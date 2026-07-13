"use client";

import { Button } from "@/components/ui/button";
import { AsyncState } from "@/components/shared/async-state";

export function ErrorState({ title, description, retry }: { title: string; description: string; retry?: () => void }) {
  return <AsyncState title={title}><p>{description}</p>{retry ? <Button type="button" onClick={retry}>Try again</Button> : null}</AsyncState>;
}
