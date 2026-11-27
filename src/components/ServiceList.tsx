// src/components/ServiceList.tsx
// The List view: one row per day with the date, the feast and the fast on the left and what the
// parishes have posted on the right — and a Copy button that puts the table on the clipboard so it
// pastes into Word. Only days with a posted schedule are listed.

import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../contexts/LangContext';
import { t } from '../lib/i18n';
import { daysInMonth, toISO, weekday } from '../lib/dates';
import { getDayData, dayFeastNames, fastLabel } from '../lib/orthodoxCalendar';
import { dayMonth, weekdayLong, monthTitle } from '../lib/monthFormat';
import { entryLines, splitTimes, parishName } from '../lib/serviceDays';
import type { ParishEntry } from '../lib/serviceDays';
import { buildScheduleHtml, buildSchedulePlain } from '../lib/scheduleExport';
import type { ExportRow } from '../lib/scheduleExport';
import { FastIcon } from './ServiceIcons';

export function EntryText({ text }: { text: string }) {
  return (
    <>
      {entryLines(text).map((line, i) => (
        <div key={i} className="svc-line">
          {splitTimes(line).map((p, j) => (p.time ? <strong key={j}>{p.text}</strong> : <span key={j}>{p.text}</span>))}
        </div>
      ))}
    </>
  );
}

interface Props {
  ym: string;                                  // "YYYY-MM"
  lang: Lang;
  entries: Record<string, ParishEntry[]>;      // by date
  /** More than one parish may appear, so each block is headed by the parish name. */
  multi: boolean;
}

export default function ServiceList({ ym, lang, entries, multi }: Props) {
  const [y, m] = ym.split('-').map(Number);
  const dates = Array.from({ length: daysInMonth(y, m) }, (_, i) => toISO(y, m, i + 1)).filter(d => entries[d]?.length);
  const title = `${t('scheduleTitle', lang)} ${monthTitle(ym, lang)}`;

  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flash = (s: 'copied' | 'failed') => {
    setStatus(s);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 2500);
  };

  async function copy() {
    const rows: ExportRow[] = dates.map(d => ({
      dateLabel: dayMonth(d, lang),
      dayLabel: weekdayLong(d, lang),
      feast: dayFeastNames(getDayData(d), lang) || undefined,
      blocks: entries[d].map(e => ({ parish: multi ? parishName(e, lang) : undefined, text: e.text })),
    }));
    const html = buildScheduleHtml(title, rows);
    const plain = buildSchedulePlain(title, rows);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      flash('copied');
    } catch {
      try { await navigator.clipboard.writeText(plain); flash('copied'); } catch { flash('failed'); }
    }
  }

  return (
    <div className="svc-list">
      <div className="svc-list__head">
        <h2 className="svc-list__title">{title}</h2>
        <div className="svc-list__tools">
          {dates.length > 0 && (
            <button
              type="button" className={`svc-btn${status === 'copied' ? ' svc-btn--on' : ''}`}
              onClick={copy} title={t('copyTableTitle', lang)}
            >
              {status === 'copied' ? `✓ ${t('copied', lang)}` : t('copyTable', lang)}
            </button>
          )}
        </div>
      </div>
      {status === 'failed' && <p role="alert" className="svc-error">{t('copyFailed', lang)}</p>}

      {dates.length === 0 ? (
        <div className="svc-empty">
          <p>{t('noScheduleMonth', lang)}</p>
        </div>
      ) : (
        <table className="svc-table">
          <tbody>
            {dates.map(d => {
              const day = getDayData(d);
              const dow = weekday(d);
              const feast = dayFeastNames(day, lang);
              const posted = entries[d];
              return (
                <tr key={d} data-date={d}>
                  <td className="svc-table__day">
                    <div className={`svc-table__date${dow === 0 || dow === 6 ? ' svc-weekend' : ''}`}>{dayMonth(d, lang)}</div>
                    <div className="svc-table__weekday">{weekdayLong(d, lang)}</div>
                    {feast && <div className="svc-table__feast">{feast}</div>}
                    {day.nzHoliday && <div className="svc-table__nz">{day.nzHoliday[lang]}</div>}
                    {day.fast && day.fast !== 'fastfree' && (
                      <div className="svc-table__fast">
                        <FastIcon type={day.fast} size={14} /> {fastLabel(day.fast, lang)}
                      </div>
                    )}
                  </td>
                  <td className="svc-table__entries">
                    {posted.map(e => (
                      <div key={e.parishId} className="svc-block">
                        {multi && <div className="svc-block__parish">{parishName(e, lang)}</div>}
                        <EntryText text={e.text} />
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
