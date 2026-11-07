export type JudicialSourceProvider = 'DATAJUD' | 'DJEN' | 'PJE_PUBLIC' | 'JURISPRUDENCE' | 'DOCUMENT_AI' | 'MANUAL';
export type JudicialSourceAvailability = 'ACTIVE' | 'PLANNED' | 'REQUIRES_AUTH' | 'REQUIRES_AGREEMENT' | 'FALLBACK';

export type JudicialSourceCapability =
  | 'PROCESS_METADATA'
  | 'MOVEMENTS'
  | 'PARTIES'
  | 'LAWYERS'
  | 'PUBLICATIONS'
  | 'DECISIONS'
  | 'CASE_VALUE'
  | 'HEARINGS'
  | 'EMPLOYMENT_FACTS'
  | 'CALCULATION_PARAMETERS';

export type JudicialSourceDescriptor = {
  provider: JudicialSourceProvider;
  label: string;
  availability: JudicialSourceAvailability;
  capabilities: JudicialSourceCapability[];
  publicAccess: boolean;
  requiresAuthentication: boolean;
  notes: string;
  priority: number;
};

export const JUDICIAL_SOURCE_REGISTRY: JudicialSourceDescriptor[] = [
  {
    provider: 'DATAJUD', label: 'DataJud / CNJ', availability: 'REQUIRES_AUTH', priority: 10,
    capabilities: ['PROCESS_METADATA', 'MOVEMENTS'], publicAccess: true, requiresAuthentication: true,
    notes: 'Portaria CNJ 374/2026: exploracao comercial vedada. Conexao desabilitada por padrao; consulta apenas por fluxo com finalidade nao comercial explicitamente autorizada.'
  },
  {
    provider: 'DJEN', label: 'Diário de Justiça Eletrônico Nacional (DJEN)', availability: 'PLANNED', priority: 20,
    capabilities: ['PARTIES', 'LAWYERS', 'PUBLICATIONS', 'DECISIONS'], publicAccess: true, requiresAuthentication: false,
    notes: 'Conector preparado. A ativação depende de método oficial automatizável e estável.'
  },
  {
    provider: 'PJE_PUBLIC', label: 'PJe / Consulta Pública do Tribunal', availability: 'PLANNED', priority: 30,
    capabilities: ['PROCESS_METADATA', 'PARTIES', 'LAWYERS', 'CASE_VALUE', 'HEARINGS', 'DECISIONS'], publicAccess: true, requiresAuthentication: true,
    notes: 'Conector preparado. Disponibilidade e autenticação variam por tribunal e podem exigir credencial ou convênio.'
  },
  {
    provider: 'JURISPRUDENCE', label: 'Jurisprudência', availability: 'PLANNED', priority: 40,
    capabilities: ['DECISIONS', 'PUBLICATIONS'], publicAccess: true, requiresAuthentication: false,
    notes: 'Conector preparado para decisões, acórdãos, ementas e metadados públicos.'
  },
  {
    provider: 'DOCUMENT_AI', label: 'Documentos + IA', availability: 'FALLBACK', priority: 50,
    capabilities: ['EMPLOYMENT_FACTS', 'CALCULATION_PARAMETERS', 'DECISIONS'], publicAccess: false, requiresAuthentication: false,
    notes: 'Fallback para documentos enviados ao SysADV e extração assistida por IA.'
  },
  {
    provider: 'MANUAL', label: 'Informação Manual', availability: 'FALLBACK', priority: 100,
    capabilities: ['PROCESS_METADATA', 'MOVEMENTS', 'PARTIES', 'LAWYERS', 'PUBLICATIONS', 'DECISIONS', 'CASE_VALUE', 'HEARINGS', 'EMPLOYMENT_FACTS', 'CALCULATION_PARAMETERS'], publicAccess: false, requiresAuthentication: false,
    notes: 'Último fallback, sempre auditável e sujeito a validação.'
  }
];

export function listJudicialSources(): JudicialSourceDescriptor[] {
  return JUDICIAL_SOURCE_REGISTRY.map(source => ({ ...source, capabilities: [...source.capabilities] }));
}

export function sourceDescriptor(provider: JudicialSourceProvider): JudicialSourceDescriptor {
  const source = JUDICIAL_SOURCE_REGISTRY.find(item => item.provider === provider);
  if (!source) throw new Error(`UNKNOWN_JUDICIAL_SOURCE:${provider}`);
  return { ...source, capabilities: [...source.capabilities] };
}
