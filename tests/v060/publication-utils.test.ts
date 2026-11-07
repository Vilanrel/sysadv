import { createPublicationFingerprint, mergeTimelineItems } from '../../apps/api/src/modules/publications/publication-utils.js';
const a=createPublicationFingerprint({npu:'1051528-57.2024.8.26.0053',sourceCode:'DJEN',externalId:'pub-1',content:'texto',publishedAt:'2026-09-18T10:00:00.000Z'});
const b=createPublicationFingerprint({npu:'1051528-57.2024.8.26.0053',sourceCode:'DJEN',externalId:'pub-1',content:'outro',publishedAt:'2026-09-18T11:00:00.000Z'});
if(a!==b) throw new Error('externalId must make fingerprint stable');
const merged=mergeTimelineItems([{type:'MOVEMENT',date:'2026-09-17T10:00:00.000Z',label:'Mov'}],[{type:'PUBLICATION',date:'2026-09-18T10:00:00.000Z',label:'Pub'}]);
if(merged[0]?.type!=='PUBLICATION') throw new Error('timeline must be newest first');
console.log('publication-utils ok');
