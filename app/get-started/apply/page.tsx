import { Metadata } from "next";
import BrandPartnershipForm from "./BrandPartnershipForm";

export const metadata: Metadata = {
  title: "Brand Partnership Application | Game Of Creators",
  description:
    "Apply for a free brand partnership trial. We have 8,000+ creators ready to make your brand go viral.",
  alternates: {
    canonical: "https://gameofcreators.com/get-started/apply",
  },
};

export default function BrandPartnershipApplyPage() {
  return <BrandPartnershipForm />;
}
