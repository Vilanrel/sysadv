export function assertSameOrganization(authOrgId: string, resourceOrgId: string) {
  if (authOrgId !== resourceOrgId) throw new Error('FORBIDDEN');
}
