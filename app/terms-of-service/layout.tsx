import { publicPageMetadata, pageSchema } from "@/lib/seo/metadata";
export const metadata = publicPageMetadata("/terms-of-service");
export default function SeoLayout({children}:{children:React.ReactNode}){return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(pageSchema("/terms-of-service")).replace(/</g,"\\u003c")}} />{children}</>;}
