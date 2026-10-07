import { publicPageMetadata } from "@/lib/seo/metadata";
import { Metadata } from "next";
import BrandPartnershipForm from "./BrandPartnershipForm";

export const metadata: Metadata = publicPageMetadata("/get-started/apply");

export default function BrandPartnershipApplyPage() {
  return <BrandPartnershipForm />;
}
