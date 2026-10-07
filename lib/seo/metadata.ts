import type { Metadata } from 'next';
import pages from './pages.json';
export const SEO_ORIGIN='https://www.gameofcreators.com';
export function publicPageMetadata(path:string):Metadata {
 const p=pages.find(p=>p.path===path);if(!p)throw new Error('Unreviewed public SEO page: '+path);
 return {title:p.title,description:p.description,alternates:{canonical:p.canonical},
 openGraph:{type:'website',siteName:'Game of Creators',locale:'en_US',title:p.title,description:p.description,url:p.canonical,images:[{url:p.image,width:p.width,height:p.height,alt:p.alt,type:'image/png'}]},
 twitter:{card:'summary_large_image',title:p.title,description:p.description,images:[{url:p.image,alt:p.alt}],creator:'@gameofcreators'},
 robots:{index:true,follow:true,googleBot:{index:true,follow:true,'max-image-preview':'large'}}};
}
export function pageSchema(path:string){const p=pages.find(p=>p.path===path);if(!p)throw new Error('Unreviewed schema');return {'@context':'https://schema.org','@type':path==='/about'?'AboutPage':path==='/contact'?'ContactPage':'WebPage',name:p.title,description:p.description,url:p.canonical,image:p.image,isPartOf:{'@type':'WebSite',name:'Game of Creators',url:SEO_ORIGIN+'/'} };}
