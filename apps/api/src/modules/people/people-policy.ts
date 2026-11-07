export const PERSON_KINDS = ['INDIVIDUAL', 'ORGANIZATION'] as const;
export const PERSON_ROLES = ['CLIENT','CLAIMANT','DEFENDANT','LAWYER','SUPPLIER','CONTACT','OTHER'] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];
export type PersonKind = (typeof PERSON_KINDS)[number];
export type PersonInput = {
  name?: string; kind?: PersonKind; taxId?: string | null; email?: string | null;
  phone?: string | null; roles?: PersonRole[]; street?: string | null;
  streetNumber?: string | null; complement?: string | null; district?: string | null;
  city?: string | null; state?: string | null; zipCode?: string | null;
  notes?: string | null; active?: boolean;
};
export const normalizeTaxId = (value:string) => value.replace(/\D/g,'');
function checkDigits(value:string, weights:number[]):number {
  const sum=weights.reduce((acc,weight,i)=>acc+Number(value[i])*weight,0);
  return sum%11 < 2 ? 0 : 11-sum%11;
}
export function validateBrazilianTaxId(raw:string):boolean {
  const value=normalizeTaxId(raw);
  if (!/^\d{11}$|^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  if (value.length===11) return checkDigits(value,[10,9,8,7,6,5,4,3,2])===Number(value[9]) && checkDigits(value,[11,10,9,8,7,6,5,4,3,2])===Number(value[10]);
  return checkDigits(value,[5,4,3,2,9,8,7,6,5,4,3,2])===Number(value[12]) && checkDigits(value,[6,5,4,3,2,9,8,7,6,5,4,3,2])===Number(value[13]);
}
const toText=(value:unknown,max=300):string|null=> {
  if(value===undefined||value===null||String(value).trim()==='')return null;
  const str=String(value).trim();if(str.length>max)throw new Error('FIELD_TOO_LONG');return str;
};
export function validatePerson(input:Record<string,unknown>, partial=false):PersonInput {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_INPUT');
  const result:PersonInput={};
  if(!partial||'name'in input){const name=toText(input.name,180)?.replace(/\s+/g,' ');if(!name||name.length<2)throw new Error('INVALID_NAME');result.name=name;}
  if(!partial||'kind'in input){const kind=input.kind??'INDIVIDUAL';if(!PERSON_KINDS.includes(kind as PersonKind))throw new Error('INVALID_KIND');result.kind=kind as PersonKind;}
  if('taxId'in input){const taxId=normalizeTaxId(String(input.taxId??''));if(taxId&&!validateBrazilianTaxId(taxId))throw new Error('INVALID_TAX_ID');result.taxId=taxId||null;}
  if('email'in input){const email=toText(input.email,254)?.toLowerCase()??null;if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('INVALID_EMAIL');result.email=email;}
  if('phone'in input) {const phone=toText(input.phone,24);if(phone && normalizeTaxId(phone).length<8)throw new Error('INVALID_PHONE');result.phone=phone;}
  if('roles'in input){if(!Array.isArray(input.roles)||input.roles.some(r=>!PERSON_ROLES.includes(r as PersonRole)))throw new Error('INVALID_ROLE');result.roles=[...new Set(input.roles as PersonRole[])];}
  if(!partial&&!result.roles)result.roles=['CLIENT'];
  for(const [key,max] of Object.entries({street:180,streetNumber:20,complement:120,district:100,city:100,state:2,zipCode:12,notes:3000}) as [keyof PersonInput,number][]) {
    if(key in input)(result as any)[key]=toText(input[key],max);
  }
  if(result.state){result.state=result.state.toUpperCase();if(!/^[A-Z]{2}$/.test(result.state))throw new Error('INVALID_STATE');}
  if(result.zipCode){const digits=normalizeTaxId(result.zipCode);if(digits.length!==8)throw new Error('INVALID_ZIP_CODE');result.zipCode=digits;}
  if('active'in input){if(typeof input.active!=='boolean')throw new Error('INVALID_ACTIVE');result.active=input.active;}
  if(result.taxId && result.kind && ((result.kind==='INDIVIDUAL')!==(result.taxId.length===11)))throw new Error('INVALID_TAX_ID_FOR_KIND');
  return result;
}
export const PERSON_LINK_ROLES=['CLAIMANT','DEFENDANT','LAWYER','INTERESTED','OTHER'] as const;
export function validatePersonProcessRole(raw:unknown) {if(!PERSON_LINK_ROLES.includes(raw as any))throw new Error('INVALID_ROLE');return raw as typeof PERSON_LINK_ROLES[number];}
