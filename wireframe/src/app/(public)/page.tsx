import { redirect } from "next/navigation";

export default function PublicLandingPage(): never {
  return redirect("/map");
}
