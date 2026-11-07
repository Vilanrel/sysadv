import { prisma } from '../../db/prisma.js';
import { storeBytes, deleteStoredBytes } from '../documents/storage.js';
import { makeDocx, makePdf, extractDocxText } from './office-files.js';
import { renderLegalText, safeDocumentName, templateVariables } from './render-model.js';
import { validateBlockSelection, validateDocxImport } from './template-policy.js';

export type TemplateInput = {
  name: string;
  category: string;
  context: 'PROCESS' | 'GENERAL';
  description?: string | null;
  content: string;
  header?: string | null;
  footer?: string | null;
};
export type BlockInput = {
  name: string;
  content: string;
  scope: 'GENERIC' | 'EXCLUSIVE';
  templateId?: string | null;
  recommended?: boolean;
};
type UserContext = { organizationId: string; userId: string };
type PreviewOpts = {
  processId?: string;
  selectedBlockIds?: string[];
  includeHeader?: boolean;
  includeFooter?: boolean;
};

function snapshot(input: TemplateInput) {
  return { name: input.name, category: input.category, context: input.context, description: input.description ?? null, content: input.content, header: input.header ?? null, footer: input.footer ?? null };
}
export const TEMPLATE_VARIABLES = templateVariables;

export class TemplatesService {
  list(org: string, query?: string) {
    return prisma.documentTemplate.findMany({
      where: { organizationId: org, active: true, ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' as const } }, { category: { contains: query, mode: 'insensitive' as const } }] } : {}) },
      select: { id:true, name:true, category:true, context:true, description:true, version:true, createdAt:true, updatedAt:true, createdBy: { select: { name:true } } },
      orderBy: { updatedAt: 'desc' }, take: 250
    });
  }
  async get(org: string, id: string) {
    const template = await prisma.documentTemplate.findFirst({ where: { id, organizationId: org, active: true } });
    if (!template) throw new Error('NOT_FOUND');
    const blocks = await this.blocks(org, template.id);
    return { ...template, blocks };
  }
  async versions(org: string, id: string) {
    await this.get(org, id);
    return prisma.documentTemplateVersion.findMany({ where: { templateId: id }, orderBy: { version: 'desc' }, take: 100 });
  }
  async create(user: UserContext, input: TemplateInput) {
    return prisma.$transaction(async tx => {
      const template = await tx.documentTemplate.create({ data: { organizationId: user.organizationId, createdById: user.userId, ...snapshot(input) } });
      await tx.documentTemplateVersion.create({ data: { templateId: template.id, version: 1, changedById: user.userId, snapshot: snapshot(input) } });
      return template;
    });
  }
  async update(user: UserContext, id: string, input: TemplateInput, expectedVersion: number) {
    const existing = await prisma.documentTemplate.findFirst({ where: { id, organizationId: user.organizationId, active: true } });
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    const nextVersion = existing.version + 1;
    return prisma.$transaction(async tx => {
      const update = await tx.documentTemplate.updateMany({
        where: { id, organizationId: user.organizationId, version: expectedVersion, active: true },
        data: { ...snapshot(input), version: nextVersion }
      });
      if (!update.count) throw new Error('VERSION_CONFLICT');
      await tx.documentTemplateVersion.create({ data: { templateId: id, version: nextVersion, changedById: user.userId, snapshot: snapshot(input) } });
      return tx.documentTemplate.findUniqueOrThrow({ where: { id } });
    });
  }
  async archive(org: string, id: string) {
    const changed = await prisma.documentTemplate.updateMany({ where: { id, organizationId: org, active: true }, data: { active: false } });
    if (!changed.count) throw new Error('NOT_FOUND');
    return { archived: true };
  }
  blocks(org: string, templateId?: string) {
    return prisma.documentBlock.findMany({ where: { organizationId: org, OR: [{ scope: 'GENERIC' }, ...(templateId ? [{ templateId }] : [])] }, orderBy: [{ scope: 'asc' }, { name: 'asc' }], take: 250 });
  }
  async createBlock(user: UserContext, input: BlockInput) {
    if (input.scope === 'EXCLUSIVE') {
      if (!input.templateId) throw new Error('TEMPLATE_REQUIRED');
      await this.get(user.organizationId, input.templateId);
    }
    return prisma.documentBlock.create({ data: {
      organizationId: user.organizationId,
      templateId: input.scope === 'EXCLUSIVE' ? input.templateId! : null,
      scope: input.scope,
      name: input.name,
      content: input.content,
      recommended: input.recommended ?? true
    } });
  }
  async updateBlock(user: UserContext, id: string, input: { name?: string; content?: string; recommended?: boolean }) {
    const changed = await prisma.documentBlock.updateMany({ where: { id, organizationId: user.organizationId }, data: input });
    if (!changed.count) throw new Error('NOT_FOUND');
    return prisma.documentBlock.findUniqueOrThrow({ where: { id } });
  }
  async deleteBlock(org: string, id: string) {
    const changed = await prisma.documentBlock.deleteMany({ where: { id, organizationId: org } });
    if (!changed.count) throw new Error('NOT_FOUND');
    return { deleted: true };
  }
  async importDocx(user: UserContext, fileName: string, bytes: Buffer) {
    validateDocxImport(fileName, bytes);
    const content = extractDocxText(bytes);
    const name = fileName.replace(/\.docx$/i, '').slice(0, 140);
    return this.create(user, { name, category: 'Importados', context: 'PROCESS', content, description: 'Texto extraido de DOCX. Confira a formatacao antes de utilizar.' });
  }
  async preview(user: UserContext, templateId: string, opts: PreviewOpts) {
    const template = await this.get(user.organizationId, templateId);
    const blocks = template.blocks;
    const selected = validateBlockSelection(opts.selectedBlockIds ?? [], blocks);
    let process: Awaited<ReturnType<typeof prisma.legalProcess.findFirst>> = null;
    if (opts.processId) {
      process = await prisma.legalProcess.findFirst({ where: { id: opts.processId, organizationId: user.organizationId, deletedAt: null } });
      if (!process) throw new Error('PROCESS_NOT_FOUND');
    }
    const uploader = await prisma.user.findFirst({ where: { id: user.userId, organizationId: user.organizationId }, select: { name: true } });
    const variables = {
      'processo.numero': process?.npu,
      'processo.autor': process?.claimant,
      'processo.reu': process?.defendant,
      'processo.tribunal': process?.court || process?.tribunalCode,
      'processo.orgao': process?.judgingBody,
      'processo.advogado': process?.responsibleLawyer,
      'processo.fase': process?.proceduralPhase,
      'usuario.nome': uploader?.name,
      'data.atual': new Intl.DateTimeFormat('pt-BR',{ timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date())
    };
    const content = [opts.includeHeader !== false ? template.header : null, template.content, opts.includeFooter !== false ? template.footer : null].filter(Boolean).join('\n\n');
    const rendered = renderLegalText(content, variables, blocks, selected);
    return { ...rendered, templateId: template.id, templateVersion: template.version, name: template.name, processId: process?.id ?? null, selectedBlockIds: selected };
  }
  async generate(user: UserContext, templateId: string, opts: PreviewOpts & { processId: string; fileName?: string; format: 'PDF' | 'DOCX'; description?: string; isPrivate?: boolean; hiddenFromClient?: boolean }) {
    if (!opts.processId) throw new Error('PROCESS_REQUIRED');
    const preview = await this.preview(user, templateId, opts);
    if (preview.unresolved.length) {
      const error = new Error('MISSING_VARIABLES') as Error & { unresolved?: string[] };
      error.unresolved = preview.unresolved;
      throw error;
    }
    const ext = opts.format === 'PDF' ? 'pdf' : 'docx';
    const bytes = opts.format === 'PDF' ? makePdf(preview.text) : makeDocx(preview.text);
    const name = safeDocumentName(opts.fileName || preview.name, ext);
    const file = await storeBytes(bytes);
    try {
      const doc = await prisma.document.create({ data: {
        organizationId: user.organizationId,
        processId: opts.processId,
        uploadedById: user.userId,
        type: 'OTHER',
        originalName: name,
        mimeType: ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        description: opts.description?.trim() || null,
        isPrivate: opts.isPrivate === true,
        hiddenFromClient: opts.hiddenFromClient === true,
        templateId,
        templateVersion: preview.templateVersion,
        ...file
      } });
      return { document: doc, unresolved: [], templateVersion: preview.templateVersion };
    } catch (error) {
      await deleteStoredBytes(file.storageKey).catch(() => undefined);
      throw error;
    }
  }
}
