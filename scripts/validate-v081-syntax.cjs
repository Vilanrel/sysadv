const ts=require('typescript');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
let total=0,fail=0;
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  if(item.name==='node_modules'||item.name==='dist')continue;
  const file=path.join(dir,item.name);
  if(item.isDirectory())walk(file);
  else if(/\.(ts|tsx)$/.test(item.name)){
    total++;
    const input=fs.readFileSync(file,'utf8');
    const output=ts.transpileModule(input,{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
    const errs=(output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    if(errs.length){fail++; console.log(file,errs.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')));}
  }
}}
walk(path.join(root,'apps'));walk(path.join(root,'packages'));walk(path.join(root,'prisma'));
console.log('TS/TSX syntax:',total,'files,',fail,'errors');process.exitCode=fail?1:0;
