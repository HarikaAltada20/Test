import { publicPageMetadata, pageSchema } from "@/lib/seo/metadata";
export const metadata = publicPageMetadata("/privacy-policy");
export default function SeoLayout({children}:{children:React.ReactNode}){return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(pageSchema("/privacy-policy")).replace(/</g,"\\u003c")}} />{children}</>;}
