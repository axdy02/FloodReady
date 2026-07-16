import { redirect } from "next/navigation";

export default function DashboardPage(): never {
  return redirect("/map");
}
