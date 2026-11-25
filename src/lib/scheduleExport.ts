// src/lib/scheduleExport.ts
// Builds the "Copy" payload of the List view: an HTML table that pastes into Word with its look
// intact (text in the entries is escaped, so nothing a parish types can inject markup), plus a
// plain-text fallback.

import { entryLines } from './serviceDays';

export interface ExportRow {
  dateLabel: string;           // "25 November"
  dayLabel: string;            // "Wednesday"
  feast?: string;              // "St Catherine the Great Martyr"
  /** One block per parish. `parish` is shown only when several parishes are listed together. */
  blocks: { parish?: string; text: string }[];
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const boldTimes = (escaped: string) => escaped.replace(/(\b\d{1,2}[:.]\d{2}\b)/g, '<strong>$1</strong>');

const FONT = 'font-family:Calibri,Arial,sans-serif;font-size:16pt';
// Word ignores font sizes inherited from <table>, so every <td> carries its own style. The
// "same-cell" hint stops Excel from starting a new row for each <br>.
const BR = '<br style="mso-data-placement:same-cell"/>';

export function buildScheduleHtml(title: string, rows: ExportRow[]): string {
  const body = rows.map(r => {
    const content = r.blocks.map(b => {
      const lines = entryLines(b.text).map(l => boldTimes(escapeHtml(l))).join(BR);
      return (b.parish ? `<strong>${escapeHtml(b.parish)}</strong>${BR}` : '') + lines;
    }).join(`${BR}${BR}`);
    const feast = r.feast ? `${BR}<i>${escapeHtml(r.feast)}</i>` : '';
    return `<tr>
<td width="26%" valign="top" style="padding:4pt 6pt;border:1pt solid black;${FONT}"><strong>${escapeHtml(r.dateLabel)}</strong>${BR}${escapeHtml(r.dayLabel)}${feast}</td>
<td width="74%" valign="top" style="padding:4pt 6pt;border:1pt solid black;${FONT}">${content}</td>
</tr>`;
  }).join('\n');

  // The ProgId/Generator tags are what make Word treat this as "from Word" and keep its fonts.
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"/><meta name="ProgId" content="Word.Document"/><meta name="Generator" content="Microsoft Word 15"/><meta name="Originator" content="Microsoft Word 15"/></head>
<body>
<p style="text-align:center;font-weight:bold;font-size:22pt;font-family:Calibri,Arial,sans-serif;margin:0 0 10pt 0">${escapeHtml(title)}</p>
<table border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;table-layout:fixed;${FONT}">
<colgroup><col style="width:26%"/><col style="width:74%"/></colgroup>
<tbody>
${body}
</tbody>
</table>
</body></html>`;
}

export function buildSchedulePlain(title: string, rows: ExportRow[]): string {
  const blocks = rows.map(r => {
    const head = `${r.dateLabel} (${r.dayLabel})${r.feast ? ` — ${r.feast}` : ''}`;
    const body = r.blocks.map(b => (b.parish ? `${b.parish}\n` : '') + entryLines(b.text).join('\n')).join('\n\n');
    return `${head}\n${body}`;
  });
  return [title, ...blocks].join('\n\n');
}
