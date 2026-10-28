import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {existsSync,statSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const src=process.cwd() + '/src/';
export async function resolve(specifier,context,nextResolve){
 let target=null;
 if(specifier.startsWith('@/')) target=src+specifier.slice(2);
 else if(specifier.startsWith('.') && context.parentURL?.startsWith('file:') && /\.(tsx?|mts)$/.test(context.parentURL)) target=path.resolve(path.dirname(fileURLToPath(context.parentURL)),specifier);
 if(target){for(const candidate of [target,`${target}.ts`,`${target}.tsx`,`${target}/index.ts`]) if(existsSync(candidate) && statSync(candidate).isFile()) return {url:pathToFileURL(candidate).href,shortCircuit:true};}
 return nextResolve(specifier,context);
}
export async function load(url,context,nextLoad){
 if(/\.(tsx?|mts)$/.test(url)){const source=await readFile(new URL(url),'utf8');return {format:'module',source:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};}
 return nextLoad(url,context);
}
