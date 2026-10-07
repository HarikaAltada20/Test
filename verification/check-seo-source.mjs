import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const read=f=>readFileSync(f,'utf8'),hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
const exceptions=JSON.parse(read('verification/original-upload-exceptions.json'));for(const [file,sha]of Object.entries(exceptions))if(existsSync(file))assert.equal(hash(file),sha);
const originals=JSON.parse(read('verification/original-files.json'));
for(const [file,sha] of Object.entries(originals))assert.equal(hash(file),sha,'Original product source changed: '+file);
const originalConfig=JSON.parse(read('verification/original-sources/vercel.json.txt')),runtimeConfig=JSON.parse(read('vercel.json'));
if(JSON.stringify(runtimeConfig)!==JSON.stringify(originalConfig))console.log('Provider build config comparison: '+JSON.stringify({originalKeys:Object.keys(originalConfig),runtimeKeys:Object.keys(runtimeConfig),sameOriginalCrons:JSON.stringify(runtimeConfig.crons)===JSON.stringify(originalConfig.crons)}));
assert.deepEqual(runtimeConfig,originalConfig,'Original provider configuration changed');
const original=f=>read('verification/original-sources/'+f+'.txt');
const stripMetadata=s=>s.replace(/^import \{ publicPageMetadata(?:, SEO_ORIGIN)? \} from "@\/lib\/seo\/metadata";\n/m,'').replace(/export const metadata: Metadata = (?:\{[\s\S]*?\n\}|publicPageMetadata\([^;]+\));/,'OWNED_METADATA');
for(const f of ['app/layout.tsx','app/page.tsx','app/brands/page.tsx','app/creators/page.tsx','app/pricing/page.tsx','app/get-started/page.tsx','app/get-started/apply/page.tsx'])assert.equal(stripMetadata(read(f)),stripMetadata(original(f)),'Original render/auth/forms changed: '+f);
assert.equal(read('components/CtcBanner.tsx').replaceAll('<h2','<h1').replaceAll('</h2>','</h1>'),original('components/CtcBanner.tsx'));
assert.equal(read('app/instagram-connection-faq/page.tsx').replace('<h1\n','<h2\n').replace('</h1>','</h2>'),original('app/instagram-connection-faq/page.tsx'));
assert.equal(stripMetadata(read('app/blog/page.tsx')).replace('SEO_ORIGIN','process.env.NEXT_PUBLIC_APP_URL'),stripMetadata(original('app/blog/page.tsx')));
let article=read('app/blog/[id]/page.tsx').replace('import { SEO_ORIGIN } from "@/lib/seo/metadata";\n','').replaceAll('SEO_ORIGIN','process.env.NEXT_PUBLIC_APP_URL').replaceAll('`${siteUrl}/social/blog.png`','`${siteUrl}/goc_ogc.png`').replace('...(post.thumbnail ? {} : { width: 1200, height: 630 }),','width: 1200,\n          height: 630,').replace('datePublished: post.published_at || undefined,','datePublished: post.published_at || post.created_at,\n    dateModified: post.published_at || post.created_at,');
assert.equal(article,original('app/blog/[id]/page.tsx'),'Original blog queries/content/forms changed');
const brandSource=original('app/brands/BrandsClient.tsx'),brandHeading=Array.from(brandSource.matchAll(/<h1\b[\s\S]*?<\/h1>/g))[1][0];
assert.equal(read('app/brands/BrandsClient.tsx').replace(brandHeading.replace('<h1','<h2').replace('</h1>','</h2>'),brandHeading),brandSource,'Original brands content/handlers changed');
const pkg=JSON.parse(read('package.json')),base=JSON.parse(original('package.json'));delete pkg.scripts.prebuild;assert.deepEqual(pkg,base,'Original dependencies/scripts changed');
const direct=JSON.parse(read('verification/original-runtime-versions.json')).versions;
for(const [name,version] of Object.entries(direct))assert.equal(JSON.parse(read('node_modules/'+name+'/package.json')).version,version,'Pinned direct runtime version changed: '+name);
assert.equal(JSON.parse(read('node_modules/next/package.json')).version,'15.5.26');
// Existing provider pnpm regenerates its originally empty lock; Git upload is verified separately.
const pages=JSON.parse(read('lib/seo/pages.json'));assert.equal(pages.length,13);assert.equal(new Set(pages.map(p=>p.sha256)).size,13);
const require=createRequire(import.meta.url),ts=require('typescript'),helpers={};
runInNewContext(ts.transpileModule(read('lib/seo/metadata.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,{exports:helpers,require:path=>{assert.equal(path,'./pages.json');return pages;}});
for(const p of pages){const m=helpers.publicPageMetadata(p.path);assert.equal(m.title,p.title);assert.equal(m.description,p.description);assert.equal(m.alternates.canonical,p.canonical);assert.equal(m.openGraph.url,p.canonical);assert.equal(m.openGraph.images[0].url,p.image);assert.equal(m.twitter.images[0].url,p.image);assert.equal(m.robots.index,true);assert.equal(helpers.pageSchema(p.path).url,p.canonical);}
assert.throws(()=>helpers.publicPageMetadata('/unreviewed-page'));
for(const p of pages){assert(p.title.length<66&&p.description.length<165&&p.alt);const file='public'+new URL(p.image).pathname;assert.equal(hash(file),p.sha256);const png=readFileSync(file);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);assert.equal(p.canonical,'https://www.gameofcreators.com'+p.path);if(p.path!=='/')assert(existsSync('app'+p.path+'/layout.tsx'));}
assert(read('lib/seo/metadata.ts').includes("index:true"));assert(read('app/layout.tsx').includes('robots:{index:false'));assert(!/openGraph:|twitter:|alternates:/.test(read('app/layout.tsx').split('export default')[0]));
const map=read('app/sitemap.ts');assert(!/new Date\(\)|\/auth\/|\/signup|\/login/.test(map));assert(map.includes('pages.map(page=>({url:page.canonical}))'));
console.log(JSON.stringify({protectedOriginalFiles:Object.keys(originals).length,publicPages:13,newCards:12,originalHomepageArtwork:true,originalFormsPaymentsCampaignsAuth:true,originalContentTypographyAssets:true,originalDependencyDeclarations:true,privateDefaultNoindex:true,realCanonicalSitemap:true}));
