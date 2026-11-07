const DATAJUD_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';

export type JudicialSegment = 'SUPERIOR' | 'FEDERAL' | 'LABOR' | 'ELECTORAL' | 'MILITARY_UNION' | 'STATE' | 'MILITARY_STATE';

export type JudicialResolution = {
  segmentCode: string;
  segment: JudicialSegment;
  segmentLabel: string;
  tribunalCode: string;
  tribunal: string;
  tribunalLabel: string;
  datajudAlias: string;
  endpoint: string;
  trt?: string;
};

type TribunalEntry = { code: string; alias: string; acronym: string; label: string };

const stateTribunals: TribunalEntry[] = [
  ['01','tjac','TJAC','Tribunal de Justiça do Acre'],['02','tjal','TJAL','Tribunal de Justiça de Alagoas'],['03','tjap','TJAP','Tribunal de Justiça do Amapá'],['04','tjam','TJAM','Tribunal de Justiça do Amazonas'],['05','tjba','TJBA','Tribunal de Justiça da Bahia'],['06','tjce','TJCE','Tribunal de Justiça do Ceará'],['07','tjdft','TJDFT','Tribunal de Justiça do Distrito Federal e Territórios'],['08','tjes','TJES','Tribunal de Justiça do Espírito Santo'],['09','tjgo','TJGO','Tribunal de Justiça de Goiás'],['10','tjma','TJMA','Tribunal de Justiça do Maranhão'],['11','tjmt','TJMT','Tribunal de Justiça de Mato Grosso'],['12','tjms','TJMS','Tribunal de Justiça de Mato Grosso do Sul'],['13','tjmg','TJMG','Tribunal de Justiça de Minas Gerais'],['14','tjpa','TJPA','Tribunal de Justiça do Pará'],['15','tjpb','TJPB','Tribunal de Justiça da Paraíba'],['16','tjpr','TJPR','Tribunal de Justiça do Paraná'],['17','tjpe','TJPE','Tribunal de Justiça de Pernambuco'],['18','tjpi','TJPI','Tribunal de Justiça do Piauí'],['19','tjrj','TJRJ','Tribunal de Justiça do Rio de Janeiro'],['20','tjrn','TJRN','Tribunal de Justiça do Rio Grande do Norte'],['21','tjrs','TJRS','Tribunal de Justiça do Rio Grande do Sul'],['22','tjro','TJRO','Tribunal de Justiça de Rondônia'],['23','tjrr','TJRR','Tribunal de Justiça de Roraima'],['24','tjsc','TJSC','Tribunal de Justiça de Santa Catarina'],['25','tjse','TJSE','Tribunal de Justiça de Sergipe'],['26','tjsp','TJSP','Tribunal de Justiça de São Paulo'],['27','tjto','TJTO','Tribunal de Justiça do Tocantins']
].map(([code, alias, acronym, label]) => ({ code, alias, acronym, label }));

const electoralAliases = ['ac','al','ap','am','ba','ce','dft','es','go','ma','mt','ms','mg','pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','se','sp','to'];

function parseNpu(npu: string): { segmentCode: string; tribunalCode: string } {
  const digits = npu.replace(/\D/g, '');
  if (digits.length !== 20) throw new Error('INVALID_NPU');
  return { segmentCode: digits.slice(13, 14), tribunalCode: digits.slice(14, 16) };
}

function result(segmentCode: string, segment: JudicialSegment, segmentLabel: string, tribunalCode: string, tribunal: string, tribunalLabel: string, datajudAlias: string, trt?: string): JudicialResolution {
  return { segmentCode, segment, segmentLabel, tribunalCode, tribunal, tribunalLabel, datajudAlias, endpoint: `${DATAJUD_BASE_URL}/api_publica_${datajudAlias}/_search`, ...(trt ? { trt } : {}) };
}

export function resolveJudicialSegment(npu: string): JudicialResolution {
  const { segmentCode, tribunalCode } = parseNpu(npu);
  const code = Number(tribunalCode);

  if (segmentCode === '3' && tribunalCode === '00') return result('3', 'SUPERIOR', 'Superior Tribunal de Justiça', tribunalCode, 'STJ', 'Superior Tribunal de Justiça', 'stj');

  if (segmentCode === '4' && code >= 1 && code <= 6) return result('4', 'FEDERAL', 'Justiça Federal', tribunalCode, `TRF${code}`, `Tribunal Regional Federal da ${code}ª Região`, `trf${code}`);

  if (segmentCode === '5') {
    if (tribunalCode === '00') return result('5', 'LABOR', 'Justiça do Trabalho', tribunalCode, 'TST', 'Tribunal Superior do Trabalho', 'tst');
    if (code >= 1 && code <= 24) return result('5', 'LABOR', 'Justiça do Trabalho', tribunalCode, `TRT${code}`, `Tribunal Regional do Trabalho da ${code}ª Região`, `trt${code}`, `TRT ${code}`);
  }

  if (segmentCode === '6') {
    if (tribunalCode === '00') return result('6', 'ELECTORAL', 'Justiça Eleitoral', tribunalCode, 'TSE', 'Tribunal Superior Eleitoral', 'tse');
    if (code >= 1 && code <= 27) {
      const uf = electoralAliases[code - 1];
      return result('6', 'ELECTORAL', 'Justiça Eleitoral', tribunalCode, `TRE-${uf.toUpperCase()}`, `Tribunal Regional Eleitoral - ${uf.toUpperCase()}`, `tre-${uf}`);
    }
  }

  if (segmentCode === '7') return result('7', 'MILITARY_UNION', 'Justiça Militar da União', tribunalCode, 'STM', 'Superior Tribunal Militar', 'stm');

  if (segmentCode === '8') {
    const entry = stateTribunals.find(item => item.code === tribunalCode);
    if (entry) return result('8', 'STATE', 'Justiça Estadual', tribunalCode, entry.acronym, entry.label, entry.alias);
  }

  if (segmentCode === '9') {
    const entries: Record<string, TribunalEntry> = {
      '13': { code: '13', alias: 'tjmmg', acronym: 'TJMMG', label: 'Tribunal de Justiça Militar de Minas Gerais' },
      '21': { code: '21', alias: 'tjmrs', acronym: 'TJMRS', label: 'Tribunal de Justiça Militar do Rio Grande do Sul' },
      '26': { code: '26', alias: 'tjmsp', acronym: 'TJMSP', label: 'Tribunal de Justiça Militar de São Paulo' }
    };
    const entry = entries[tribunalCode];
    if (entry) return result('9', 'MILITARY_STATE', 'Justiça Militar Estadual', tribunalCode, entry.acronym, entry.label, entry.alias);
  }

  throw Object.assign(new Error('UNSUPPORTED_JUDICIAL_SEGMENT'), { segmentCode, tribunalCode });
}
