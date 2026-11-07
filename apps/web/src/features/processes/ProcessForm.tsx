import { useEffect, useState, type FocusEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { processSchema, type ProcessInput } from '@sysadv/contracts';
import { apiFetch } from '../auth/api';
import { OriginStatusBadge } from './OriginStatusBadge';

type LookupState = 'idle' | 'loading' | 'found' | 'not-found' | 'error';
const OFFICIAL_FIELDS: Array<keyof ProcessInput> = ['trt','court','judicialSegment','judicialSegmentCode','tribunalCode','datajudAlias','judgingBody','laborCourt','filingDate','proceduralPhase'];
export function ProcessForm({ onSubmit, initialValues, submitLabel = 'Salvar processo', enableNpuLookup = true }: { onSubmit: (v: ProcessInput) => void | Promise<void>; initialValues?: Partial<ProcessInput>; submitLabel?: string; enableNpuLookup?: boolean }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, getValues, reset } = useForm<ProcessInput>({ resolver: zodResolver(processSchema), defaultValues: initialValues });
  const [lookupState, setLookupState] = useState<LookupState>('idle'); const [lookupMessage, setLookupMessage] = useState(''); const npuField = register('npu');
  useEffect(() => { if (initialValues) reset(initialValues as ProcessInput); }, [initialValues, reset]);
  async function lookupDataJud(npu: string) {
    if (!enableNpuLookup || !/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(npu)) return;
    setLookupState('loading'); setLookupMessage('Consultando dados oficiais no DataJud/CNJ...');
    try { const response = await apiFetch(`/processes/datajud/search?npu=${encodeURIComponent(npu)}`); const result = await response.json().catch(() => ({}));
      if (!response.ok) { setLookupState('error'); if (result.error === 'DATAJUD_NOT_CONFIGURED') setLookupMessage('Integração DataJud não configurada no servidor.'); else if (result.error === 'UNSUPPORTED_JUDICIAL_SEGMENT') setLookupMessage('Segmento judicial ainda não suportado para consulta automática.'); else setLookupMessage(`Não foi possível consultar o DataJud${result.upstreamStatus ? ` (HTTP ${result.upstreamStatus})` : ''}${result.routing ? ` — ${result.routing.tribunal}` : ''}. Você pode continuar manualmente.`); return; }
      if (!result.found || !result.normalized) { setLookupState('not-found'); setLookupMessage('Processo não localizado no DataJud. Você pode continuar manualmente.'); return; }
      for (const field of OFFICIAL_FIELDS) { const current = getValues(field); const official = result.normalized[field]; if ((current === undefined || current === '') && official !== undefined && official !== '') setValue(field, official, { shouldDirty: false, shouldValidate: true }); }
      setLookupState('found'); setLookupMessage(`Dados oficiais encontrados em ${result.normalized.court ?? result.resolution?.tribunal ?? 'DataJud/CNJ'} (${result.normalized.judicialSegment ?? result.resolution?.segmentLabel ?? 'segmento identificado'}). Revise antes de salvar.`);
    } catch { setLookupState('error'); setLookupMessage('Falha de comunicação com o DataJud. Você pode continuar manualmente.'); }
  }
  return <form className="panel form-grid" onSubmit={handleSubmit(onSubmit)}>
    <label className="span-2">Número do processo (NPU)<input placeholder="0001234-56.2025.5.02.0030" {...npuField} onBlur={async (event: FocusEvent<HTMLInputElement>) => { npuField.onBlur(event); await lookupDataJud(event.target.value.trim()); }} /><small>{errors.npu?.message}</small>{lookupState !== 'idle' && <div className={`integration-status integration-${lookupState}`} role="status">{lookupState === 'found' && <OriginStatusBadge kind="OFFICIAL" />}<span>{lookupMessage}</span></div>}</label>
    <label>Reclamante<input {...register('claimant')} /></label><label>Reclamado<input {...register('defendant')} /></label><label>CPF do reclamante<input {...register('claimantDocument')} /></label><label>CPF/CNPJ do reclamado<input {...register('defendantDocument')} /></label><label>Segmento Judicial<input readOnly {...register('judicialSegment')} /></label><label>Tribunal<input {...register('court')} /></label><label>Código do Tribunal<input readOnly {...register('tribunalCode')} /></label><label>Alias DataJud<input readOnly {...register('datajudAlias')} /></label><label>TRT (quando aplicável)<input {...register('trt')} /></label><label>Órgão julgador<input {...register('judgingBody')} /></label><label>Município<input {...register('municipality')} /></label><label>Advogado responsável<input {...register('responsibleLawyer')} /></label><label>Fase processual<input {...register('proceduralPhase')} /></label><label>Data de ajuizamento<input type="date" {...register('filingDate')} /></label><label>Admissão<input type="date" {...register('admissionDate')} /></label><label>Desligamento<input type="date" {...register('terminationDate')} /></label><label>Função<input {...register('jobTitle')} /></label><label>Data prevista para cálculo<input type="date" {...register('calculationDueDate')} /></label><label className="span-2">Observações<textarea rows={4} {...register('notes')} /></label><div className="span-2 form-actions"><button className="primary" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : submitLabel}</button></div>
  </form>;
}
