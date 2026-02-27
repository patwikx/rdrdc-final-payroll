import { redirect } from "next/navigation";

// Default page for users without business unit - redirect to setup
export default function RootPage() {
  redirect("/setup");
}