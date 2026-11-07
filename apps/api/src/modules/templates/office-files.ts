import { deflateRawSync, inflateRawSync } from 'node:zlib';

function crc32(bytes: Buffer): number {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function zip(entries: { name: string; content: string }[]): Buffer {
  const output: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.from(entry.content, 'utf8');
    const compressed = deflateRawSync(raw);
    const check = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(check, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    output.push(local, name, compressed);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(check, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(raw.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += local.length + name.length + compressed.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...output, cd, end]);
}

const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const unXml = (value: string) => value.replace(/&#x([0-9a-f]+);/gi, (_, v: string) => String.fromCodePoint(parseInt(v,16))).replace(/&#(\d+);/g, (_, v: string) => String.fromCodePoint(Number(v))).replace(/&(amp|lt|gt|quot|apos);/g, (_, v: string) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[v] || ''));

export function makeDocx(text: string): Buffer {
  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n').map(line => `<w:p><w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`).join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  return zip([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', content: document }
  ]);
}

export function extractDocxText(archive: Buffer): string {
  if (archive.length > 5 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
  const end = archive.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if (end < 0 || end + 22 > archive.length) throw new Error('INVALID_DOCX');
  const n = archive.readUInt16LE(end + 10);
  if (n > 500) throw new Error('INVALID_DOCX');
  let at = archive.readUInt32LE(end + 16);
  for (let i=0; i<n; i++) {
    if (at+46>archive.length || archive.readUInt32LE(at)!==0x02014b50) throw new Error('INVALID_DOCX');
    const method = archive.readUInt16LE(at+10);
    const flags = archive.readUInt16LE(at+8);
    const compressedSize = archive.readUInt32LE(at+20);
    const size = archive.readUInt32LE(at+24);
    const nameSize = archive.readUInt16LE(at+28);
    const extra = archive.readUInt16LE(at+30);
    const comment = archive.readUInt16LE(at+32);
    const localOffset = archive.readUInt32LE(at+42);
    const name = archive.subarray(at+46,at+46+nameSize).toString('utf8');
    at += 46+nameSize+extra+comment;
    if (name !== 'word/document.xml') continue;
    if (flags & 1 || ![0,8].includes(method) || size > 8*1024*1024 || compressedSize > 5*1024*1024) throw new Error('INVALID_DOCX');
    if (archive.readUInt32LE(localOffset)!==0x04034b50) throw new Error('INVALID_DOCX');
    const contentAt = localOffset+30+archive.readUInt16LE(localOffset+26)+archive.readUInt16LE(localOffset+28);
    if (contentAt+compressedSize>archive.length) throw new Error('INVALID_DOCX');
    const bytes = archive.subarray(contentAt,contentAt+compressedSize);
    const body = method===8 ? inflateRawSync(bytes,{maxOutputLength:8*1024*1024}) : bytes;
    if (body.length !== size) throw new Error('INVALID_DOCX');
    const text = body.toString('utf8');
    if (!text.includes('<w:document') && !text.includes('<w:body')) throw new Error('INVALID_DOCX');
    const lines = [...text.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)].map(match => {
      const para = match[1].replace(/<w:tab\s*\/>/g,'\t').replace(/<w:br\s*\/>/g,'\n');
      return [...para.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m=>unXml(m[1])).join('');
    });
    const result = lines.join('\n').trim();
    if (!result) throw new Error('EMPTY_DOCX');
    return result;
  }
  throw new Error('INVALID_DOCX');
}

export function makePdf(text: string): Buffer {
  const lineLimit = 96;
  const wrapped: string[] = [];
  for (const source of text.replace(/\r\n?/g,'\n').split('\n')) {
    const line = source.replace(/[^\x09\x0a\x0d\x20-\xff]/g, '?');
    if (!line) wrapped.push('');
    for (let i=0;i<line.length;i+=lineLimit) wrapped.push(line.slice(i,i+lineLimit));
  }
  const pages: string[][] = [];
  while (wrapped.length) pages.push(wrapped.splice(0,48));
  if (!pages.length) pages.push(['']);
  const objects: string[] = [];
  const kids: number[] = [];
  const fontId = 3 + pages.length*2;
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*2} 0 R`).join(' ')}] >>`;
  pages.forEach((lines, i) => {
    const pageId = 3+i*2;
    const contentId = pageId+1;
    kids.push(pageId);
    const content = ['BT','/F1 10 Tf','50 790 Td','14 TL',...lines.flatMap((line,index)=>[`${index?'T* ':''}(${line.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}) Tj`]),'ET'].join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(content,'latin1')} >>\nstream\n${content}\nendstream`;
  });
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n','latin1')];
  const offsets: number[] = [0];
  let offset = chunks[0].length;
  for (let id=1;id<objects.length;id++) {
    offsets[id] = offset;
    const chunk = Buffer.from(`${id} 0 obj\n${objects[id]}\nendobj\n`,'latin1');
    chunks.push(chunk);
    offset += chunk.length;
  }
  const xrefAt = offset;
  const cross = [`xref\n0 ${objects.length}\n0000000000 65535 f \n`, ...offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`)].join('');
  chunks.push(Buffer.from(`${cross}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`,'latin1'));
  return Buffer.concat(chunks);
}
