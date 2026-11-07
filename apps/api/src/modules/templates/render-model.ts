export const templateVariables = [
  { code: 'processo.numero', label: 'Numero do processo' },
  { code: 'processo.autor', label: 'Parte autora' },
  { code: 'processo.reu', label: 'Parte re' },
  { code: 'processo.tribunal', label: 'Tribunal' },
  { code: 'processo.orgao', label: 'Orgao julgador' },
  { code: 'processo.advogado', label: 'Advogado responsavel' },
  { code: 'processo.fase', label: 'Fase processual' },
  { code: 'usuario.nome', label: 'Usuario atual' },
  { code: 'data.atual', label: 'Data atual' }
] as const;

export type LegalVariables = Record<string, string | number | null | undefined>;
export type LegalBlock = { id: string; content: string };
export type RenderResult = { text: string; unresolved: string[] };

export function renderLegalText(
  content: string,
  variables: LegalVariables,
  blocks: LegalBlock[],
  selectedBlockIds: string[]
): RenderResult {
  const selected = new Set(selectedBlockIds);
  const knownBlocks = new Map(blocks.map(block => [block.id, block]));
  const missing = new Set<string>();
  const textWithBlocks = content.replace(/\{\{\s*bloco:([A-Za-z0-9_-]+)\s*\}\}/g, (_, id: string) => {
    if (!selected.has(id)) return '';
    const block = knownBlocks.get(id);
    if (!block) { missing.add(`bloco:${id}`); return `{{bloco:${id}}}`; }
    // Block content is plain text, not executable markup.
    return block.content.replace(/\{\{\s*bloco:[^{}]+\}\}/g, '');
  });
  const allow = new Set<string>(templateVariables.map(v => v.code));
  const rendered = textWithBlocks.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (token, key: string) => {
    const normalized = key.trim();
    const value = allow.has(normalized) ? variables[normalized] : undefined;
    if (value === undefined || value === null || String(value).trim() === '') {
      missing.add(normalized);
      return token;
    }
    return String(value);
  });
  return { text: rendered.replace(/\n{3,}/g, '\n\n').trim(), unresolved: [...missing].sort() };
}

export function safeDocumentName(value: string, format: 'pdf' | 'docx' | 'txt'): string {
  const leaf = String(value || 'documento').replace(/\\/g, '/').split('/').pop() || 'documento';
  const cleaned = leaf.replace(/[<>:"|?*\x00-\x1F]/g, '').replace(/\.(pdf|docx|txt)$/i,'').trim().replace(/^[. ]+|[. ]+$/g, '');
  return `${(cleaned || 'documento').slice(0, 120)}.${format}`;
}
