import SignInPage from "@/components/auth/SignInPage";

export default async function page({ searchParams }: { searchParams: Promise<{ verification: string }> }) {
  const { verification } = await searchParams;
  return <SignInPage verification={verification} />;
}
