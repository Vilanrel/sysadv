const fs=require('fs'),path=require('path');
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
let checked=0;let failures=0;const diagnostics=[];
function scan(folder){for(const name of fs.readdirSync(folder)){const full=path.join(folder,name);const stat=fs.statSync(full);if(stat.isDirectory()){if(['node_modules','dist','.git','.superpowers'].includes(name))continue;scan(full);}else if(/\.tsx?$/.test(name)){
 const content=fs.readFileSync(full,'utf8');const result=ts.transpileModule(content,{fileName:full,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});checked++;
 const bad=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);if(bad.length){failures+=bad.length;for(const d of bad)diagnostics.push(`${full}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);}
}}}
scan(path.join(__dirname,'..','apps'));scan(path.join(__dirname,'..','packages'));scan(path.join(__dirname,'..','prisma'));
console.log(`TS/TSX syntax: ${checked} files, ${failures} errors`);for(const line of diagnostics)console.log(line);if(failures)process.exitCode=1;
