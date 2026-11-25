import { redirect } from "next/navigation";

export default function Home() {
  // The patient registration form is the primary entry point.
  // Anyone who opens the link lands directly on the fill-up form.
  redirect("/patient");
}
