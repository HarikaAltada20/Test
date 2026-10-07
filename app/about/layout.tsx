import { publicPageMetadata, pageSchema } from "@/lib/seo/metadata";
export const metadata = publicPageMetadata("/about");
export default function SeoLayout({children}:{children:React.ReactNode}){return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(pageSchema("/about")).replace(/</g,"\\u003c")}} />{children}</>;}
