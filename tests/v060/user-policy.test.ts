import { canChangeAdminState } from '../../apps/api/src/modules/users/user-policy.js';
if(canChangeAdminState({targetIsAdmin:true,targetIsActive:true,activeAdminCount:1,nextStatus:'INACTIVE'}).allowed) throw new Error('last admin must be protected');
if(!canChangeAdminState({targetIsAdmin:true,targetIsActive:true,activeAdminCount:2,nextStatus:'INACTIVE'}).allowed) throw new Error('second admin can be inactivated');
console.log('user-policy ok');
