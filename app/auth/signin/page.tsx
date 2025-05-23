import SignInPage from "@/components/auth/SignInPage";
import { createClient } from "@/utils/supabase/server"; // Import server client
import { redirect } from "next/navigation"; // Import redirect

export default async function page({ searchParams }: { searchParams: Promise<{ verification: string }> }) {
  const supabase = await createClient(); // AWAIIT Create server client instance
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard"); // Redirect if user is logged in
  }

  const { verification } = await searchParams;
  return <SignInPage verification={verification} />;
}
