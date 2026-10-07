import { publicPageMetadata, pageSchema } from "@/lib/seo/metadata";
export default function SeoLayout({children}:{children:React.ReactNode}){return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(pageSchema("/get-started/apply")).replace(/</g,"\\u003c")}} />{children}</>;}
