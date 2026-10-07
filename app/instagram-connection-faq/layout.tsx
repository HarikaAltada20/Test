import { publicPageMetadata, pageSchema } from "@/lib/seo/metadata";
export const metadata = publicPageMetadata("/instagram-connection-faq");
export default function SeoLayout({children}:{children:React.ReactNode}){return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(pageSchema("/instagram-connection-faq")).replace(/</g,"\\u003c")}} />{children}</>;}
