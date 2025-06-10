import SignInPage from "@/components/auth/SignInPage";
import { createClient } from "@/utils/supabase/server"; // Import server client
import { redirect } from "next/navigation"; // Import redirect

export default function SignIn() {
  return <SignInPage />;
}
