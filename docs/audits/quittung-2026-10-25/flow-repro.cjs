const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const root = process.cwd() + '/';
function fromSource(file, name, dependencies = {}) {
  const src = fs.readFileSync(root + file, 'utf8');
  const ast = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fragment;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) fragment = node.getText(ast).replace(/^export\s+/, '');
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) fragment = `const ${node.getText(ast)};`;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!fragment) throw new Error(`Missing source symbol ${name}`);
  const js = ts.transpileModule(`${fragment}\n globalThis.result = ${name};`, {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None},
  }).outputText;
  const ctx = vm.createContext({...dependencies});
  vm.runInContext(js, ctx);
  return ctx.result;
}
let navigation;
const navigate = (path, state) => { navigation = {path, ...state}; };
const bridge = fromSource('src/pages/firma/Auftraege.tsx', 'handleCreateQuittung', {navigate});
const mapItem = fromSource('src/pages/firma/QuittungDetail.tsx', 'toRow', {uuidv4: () => 'synthetic'});
const totals = fromSource('src/types/quittung.types.ts', 'calculateTotals');
const excluded = fromSource('src/lib/offerPricing.ts', 'EXCLUDED_FROM_SUBTOTAL');
const free = fromSource('src/lib/offerPricing.ts', 'isFreeItem', {EXCLUDED_FROM_SUBTOTAL:excluded});
const row = { id:'job', offer_id:'offer', customer_name:'Test Customer', language:'fr', vat_rate:0,
  subtotal:900, vat_amount:0, total:900, pricing_type:'fixed', customer_id:'customer' };
const item = (id, price_type, total) => ({id, position:1, description:id, quantity:1, unit:'Pauschal', unit_price:total, total, price_type});
function go(items, fields={}) {
  bridge({kind:'valid', row:{...row, ...fields}, items, extraServices:[]});
  return {payload:navigation.state.fromAuftrag, receipt:totals(navigation.state.fromAuftrag.items.map(mapItem), 8.1, 0)};
}
function record(name, expected, actual) {
  console.log(JSON.stringify({name,expected,actual,verdict:JSON.stringify(expected)===JSON.stringify(actual)?'PASS':'FAIL'}));
}
let sample=go([item('core', 'pauschale', 1000), item('optional', 'optional', 300)], {vat_rate:8.1, subtotal:1000,total:1081});
record('optional excluded using canonical price_type rule', 1081, sample.receipt.gesamttotal);
record('canonical helper marks optional nonbillable', true, free('optional'));
sample=go([item('core', 'pauschale', 1000)], {vat_rate:0, subtotal:1000,total:1000});
record('zero VAT Auftrag total preserved', 1000, sample.receipt.gesamttotal);
record('customer language propagated', 'fr', sample.payload.language ?? 'MISSING');
sample=go([item('core', 'pauschale', 1000)], {vat_rate:8.1,subtotal:900,vat_amount:72.9,total:972.9});
record('discounted Auftrag final total preserved', 972.9, sample.receipt.gesamttotal);
console.log(JSON.stringify({name:'bridge field set', fields:Object.keys(sample.payload)}));
for (const status of ['draft','signed','sent','paid']) {
  const visible = status !== 'draft';
  const disabled = status === 'signed' || status === 'sent' || status === 'paid';
  console.log(JSON.stringify({name:'discount editor state table (source predicates)',status,visible,disabled,usable:visible && !disabled}));
}
