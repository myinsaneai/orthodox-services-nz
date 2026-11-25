import { describe, it, expect } from 'vitest';
import { buildScheduleHtml, buildSchedulePlain, escapeHtml } from '../src/lib/scheduleExport';

const rows = [
  { dateLabel: '22 November', dayLabel: 'Sunday', feast: 'Sunday of Zacchaeus', blocks: [{ parish: 'Holy Trinity', text: '9:00 Orthros\n10:00 Divine Liturgy' }] },
  { dateLabel: '25 November', dayLabel: 'Wednesday', blocks: [{ text: '18:00 <b>Vespers</b> & Paraklesis' }] },
];

describe('schedule export', () => {
  it('escapes anything a parish types', () => {
    expect(escapeHtml('<script>"x" & y</script>')).toBe('&lt;script&gt;&quot;x&quot; &amp; y&lt;/script&gt;');
    const html = buildScheduleHtml('T', rows);
    expect(html).not.toContain('<b>Vespers</b>');
    expect(html).toContain('&lt;b&gt;Vespers&lt;/b&gt; &amp; Paraklesis');
  });
  it('builds a Word-friendly table with a title, bold times and the parish heading', () => {
    const html = buildScheduleHtml('Service Schedule for November 2026', rows);
    expect(html).toContain('Word.Document');
    expect(html).toContain('Service Schedule for November 2026');
    expect(html).toContain('<strong>9:00</strong> Orthros');
    expect(html).toContain('<strong>10:00</strong> Divine Liturgy');
    expect(html).toContain('<strong>Holy Trinity</strong>');
    expect(html).toContain('<i>Sunday of Zacchaeus</i>');
    expect((html.match(/<tr>/g) ?? []).length).toBe(2);
    expect(html).toContain('mso-data-placement:same-cell');
  });
  it('builds a plain-text fallback', () => {
    const plain = buildSchedulePlain('Title', rows);
    expect(plain.startsWith('Title\n\n22 November (Sunday) — Sunday of Zacchaeus\nHoly Trinity\n9:00 Orthros\n10:00 Divine Liturgy')).toBe(true);
    expect(plain).toContain('25 November (Wednesday)\n18:00 <b>Vespers</b> & Paraklesis');
  });
});
