import { sanitizeSourceForResponse, buildAuthHeaders } from '../../apps/api/src/modules/data-sources/source-config.js';
const sanitized=sanitizeSourceForResponse({id:'1',name:'X',secrets:[{secretType:'API_KEY',encryptedValue:'SECRET'}]});
if(JSON.stringify(sanitized).includes('SECRET')) throw new Error('secret leaked');
const headers=buildAuthHeaders('API_KEY',{API_KEY:'abc'},{apiKeyHeader:'x-api-key'});
if(headers['x-api-key']!=='abc') throw new Error('api key header missing');
console.log('source-config ok');
