import { AsyncState } from "@/components/shared/async-state";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <AsyncState title={title}><p>{description}</p></AsyncState>;
}
