import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { audit } from '../audit/audit.service.js';
import { TemplatesService, TEMPLATE_VARIABLES } from './templates.service.js';

const service = new TemplatesService();
const fields = z.object({
  name: z.string().trim().min(3).max(140),
  category: z.string().trim().min(1).max(80).default('Geral'),
  context: z.enum(['PROCESS','GENERAL']).default('PROCESS'),
  description: z.string().max(1000).nullable().optional(),
  content: z.string().min(1).max(200000),
  header: z.string().max(10000).nullable().optional(),
  footer: z.string().max(10000).nullable().optional()
});
const updateFields = fields.extend({ expectedVersion: z.number().int().positive() });
const blockFields = z.object({
  name: z.string().trim().min(2).max(140),
  content: z.string().min(1).max(30000),
  scope: z.enum(['GENERIC','EXCLUSIVE']),
  templateId: z.string().optional().nullable(),
  recommended: z.boolean().optional()
});
const previewFields = z.object({
  processId: z.string().optional(),
  selectedBlockIds: z.array(z.string()).max(100).default([]),
  includeHeader: z.boolean().default(true),
  includeFooter: z.boolean().default(true)
});
const generateFields = previewFields.extend({
  processId: z.string().min(1),
  fileName: z.string().max(140).optional(),
  format: z.enum(['PDF','DOCX']),
  description: z.string().max(1000).optional(),
  isPrivate: z.boolean().default(false),
  hiddenFromClient: z.boolean().default(false)
});
function fail(reply: any, error: any) {
  const code = error?.message ?? 'INVALID_INPUT';
  const status = code === 'NOT_FOUND' || code === 'PROCESS_NOT_FOUND' ? 404 : code === 'VERSION_CONFLICT' ? 409 : code === 'MISSING_VARIABLES' ? 422 : 400;
  return reply.code(status).send({ error: code, ...(error.unresolved ? { unresolved: error.unresolved } : {}) });
}
function auth(req: any) { return { organizationId: req.auth.organizationId, userId: req.auth.userId }; }
async function track(req: any, action: string, id: string, metadata: Record<string, unknown> = {}) {
  await audit.record({ organizationId: req.auth.organizationId, userId: req.auth.userId, entityType: 'DocumentTemplate', entityId: id, action, newValue: metadata, source: 'WEB' });
}

export async function templatesRoutes(app: FastifyInstance) {
  app.get('/document-templates/variables', { preHandler: [authenticate, requirePermission('document.template.read')] }, () => TEMPLATE_VARIABLES);
  app.get('/document-templates/blocks', { preHandler: [authenticate, requirePermission('document.template.read')] }, (req: any) => service.blocks(req.auth.organizationId, String(req.query?.templateId || '') || undefined));
  app.get('/document-templates', { preHandler: [authenticate, requirePermission('document.template.read')] }, (req: any) => service.list(req.auth.organizationId, String(req.query?.query || '').slice(0,80)));
  app.get('/document-templates/:id', { preHandler: [authenticate, requirePermission('document.template.read')] }, async (req: any, reply) => { try { return await service.get(req.auth.organizationId, req.params.id); } catch (error) { return fail(reply, error); } });
  app.get('/document-templates/:id/versions', { preHandler: [authenticate, requirePermission('document.template.read')] }, async (req: any, reply) => { try { return await service.versions(req.auth.organizationId, req.params.id); } catch (error) { return fail(reply, error); } });
  app.post('/document-templates', { preHandler: [authenticate, requirePermission('document.template.manage')] }, async (req: any, reply) => {
    const parsed=fields.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    try { const created=await service.create(auth(req),parsed.data); await track(req,'TEMPLATE_CREATED',created.id,{name:created.name,version:1}); return reply.code(201).send(created); } catch(e) { return fail(reply,e); }
  });
  app.put('/document-templates/:id', { preHandler: [authenticate, requirePermission('document.template.manage')] }, async (req: any, reply) => {
    const parsed=updateFields.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const {expectedVersion,...input}=parsed.data;
    try { const updated=await service.update(auth(req),req.params.id,input,expectedVersion); await track(req,'TEMPLATE_UPDATED',updated.id,{version:updated.version}); return updated; } catch(e) { return fail(reply,e); }
  });
  app.delete('/document-templates/:id', { preHandler: [authenticate, requirePermission('document.template.manage')] }, async (req: any, reply) => {
    try { const result=await service.archive(req.auth.organizationId,req.params.id); await track(req,'TEMPLATE_ARCHIVED',req.params.id); return result; } catch(e) { return fail(reply,e); }
  });
  app.post('/document-templates/blocks', { preHandler: [authenticate, requirePermission('document.template.manage')] }, async (req: any, reply) => {
    const parsed=blockFields.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    try { const block=await service.createBlock(auth(req),parsed.data); await track(req,'TEMPLATE_BLOCK_CREATED',block.id,{scope:block.scope,templateId:block.templateId}); return reply.code(201).send(block); } catch(e) { return fail(reply,e); }
  });
  app.patch('/document-templates/blocks/:id', { preHandler: [authenticate, requirePermission('document.template.manage')] }, async (req: any, reply) => {
    const parsed=blockFields.pick({name:true,content:true,recommended:true}).partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    try { const block=await service.updateBlock(auth(req),req.params.id,parsed.data); await track(req,'TEMPLATE_BLOCK_UPDATED',block.id); return block; } catch(e) { return fail(reply,e); }
  });
  app.delete('/document-templates/blocks/:id', { preHandler: [authenticate, requirePermission('document.template.manage')] }, async (req: any, reply) => {
    try { const result=await service.deleteBlock(req.auth.organizationId,req.params.id); await track(req,'TEMPLATE_BLOCK_DELETED',req.params.id); return result; } catch(e) { return fail(reply,e); }
  });
  app.post('/document-templates/import', { preHandler: [authenticate, requirePermission('document.template.manage')] }, async (req: any, reply) => {
    try {
      const file = await req.file({ limits: { fileSize: 5*1024*1024, files: 1 } });
      if (!file) return reply.code(400).send({ error:'FILE_REQUIRED' });
      const bytes = await file.toBuffer();
      const imported = await service.importDocx(auth(req), file.filename, bytes);
      await track(req,'TEMPLATE_IMPORTED',imported.id,{name:imported.name, sourceFile:file.filename});
      return reply.code(201).send(imported);
    } catch(e) { return fail(reply,e); }
  });
  app.post('/document-templates/:id/preview', { preHandler: [authenticate, requirePermission('document.template.read')] }, async (req: any, reply) => {
    const parsed=previewFields.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({error:'INVALID_INPUT'});
    try { return await service.preview(auth(req),req.params.id,parsed.data); } catch(e) { return fail(reply,e); }
  });
  app.post('/document-templates/:id/generate', { preHandler: [authenticate, requirePermission('document.generate'), requirePermission('document.upload')] }, async (req: any, reply) => {
    const parsed=generateFields.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({error:'INVALID_INPUT'});
    try { const result=await service.generate(auth(req),req.params.id,parsed.data); await track(req,'DOCUMENT_GENERATED',req.params.id,{documentId:result.document.id,processId:parsed.data.processId,format:parsed.data.format,templateVersion:result.templateVersion}); return reply.code(201).send(result); } catch(e) { return fail(reply,e); }
  });
}
