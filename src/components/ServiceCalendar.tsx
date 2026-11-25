// src/components/ServiceCalendar.tsx
// The Calendar view: a Monday-first month grid. Each day is coloured by its feast, carries the
// fasting icon, a corner mark for NZ public holidays and a church for days with a posted schedule;
// selecting a day opens a panel with the full details underneath.

import { useState } from 'react';
import type { Lang } from '../contexts/LangContext';
import { t } from '../lib/i18n';
import { daysInMonth, toISO, weekday } from '../lib/dates';
import {
  getDayData, dayKind, dayFeastNames, dayShortName, fastLabel, fastPeriodLabel, toneLabel,
} from '../lib/orthodoxCalendar';
import { FAST_COLOR } from '../lib/greekFeasts';
import { longDate, weekdayHeaders } from '../lib/monthFormat';
import { parishName } from '../lib/serviceDays';
import type { ParishEntry } from '../lib/serviceDays';
import { FastIcon, ChurchIcon } from './ServiceIcons';
import type { FastIconType } from './ServiceIcons';
import { EntryText } from './ServiceList';

interface Props {
  ym: string;
  lang: Lang;
  entries: Record<string, ParishEntry[]>;
  multi: boolean;
  today: string;
}

const LEGEND_KINDS = [
  ['pascha', 'legendPascha'], ['great', 'legendGreat'], ['palm', 'legendPalmPent'],
  ['nativity', 'legendNativity'], ['bright', 'legendBright'], ['holyweek', 'legendHolyWeek'],
] as const;
const LEGEND_FASTS: FastIconType[] = ['strict', 'oilwine', 'fish', 'dairy', 'totalfast'];

export default function ServiceCalendar({ ym, lang, entries, multi, today }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [y, m] = ym.split('-').map(Number);

  const lead = (weekday(toISO(y, m, 1)) + 6) % 7;     // blanks before the 1st (Monday-first)
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth(y, m) }, (_, i) => toISO(y, m, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selDay = selected ? getDayData(selected) : null;
  const selEntries = selected ? entries[selected] ?? [] : [];

  return (
    <div className="svc-cal">
      <div className="svc-cal__frame">
        <div className="svc-cal__dow" role="row">
          {weekdayHeaders(lang).map((d, i) => (
            <div key={d} role="columnheader" className={i >= 5 ? 'svc-cal__dow--weekend' : undefined}>{d}</div>
          ))}
        </div>
        <div className="svc-cal__grid">
          {cells.map((date, idx) => {
            if (!date) return <div key={`b${idx}`} className="svc-cell svc-cell--blank" />;
            const day = getDayData(date);
            const kind = dayKind(day);
            const short = dayShortName(day, lang);
            const posted = !!entries[date]?.length;
            const isSel = selected === date;
            const label = [
              longDate(date, lang),
              dayFeastNames(day, lang),
              day.fast && fastLabel(day.fast, lang),
              day.nzHoliday?.[lang],
              posted && t('schedulePosted', lang),
            ].filter(Boolean).join('. ');
            return (
              <button
                key={date} type="button" data-date={date} data-kind={kind}
                aria-label={label} aria-pressed={isSel}
                className={`svc-cell${isSel ? ' svc-cell--sel' : ''}${date === today ? ' svc-cell--today' : ''}${
                  weekday(date) === 6 ? ' svc-cell--sat' : ''}`}
                onClick={() => setSelected(isSel ? null : date)}
              >
                <span className="svc-cell__num">{Number(date.slice(8))}</span>
                {short && <span className="svc-cell__feast">{short.length > 20 ? `${short.slice(0, 18)}…` : short}</span>}
                {day.fast && day.fast !== 'fastfree' && (
                  <span className="svc-cell__fast" title={fastLabel(day.fast, lang)}><FastIcon type={day.fast} size={20} /></span>
                )}
                {day.nzHoliday && <span className="svc-cell__nz" title={`${t('nzHoliday', lang)}: ${day.nzHoliday[lang]}`} />}
                {posted && <span className="svc-cell__church" title={t('schedulePosted', lang)}><ChurchIcon size={20} /></span>}
              </button>
            );
          })}
        </div>
      </div>

      {selected && selDay && (
        <section className="svc-panel" aria-label={longDate(selected, lang)}>
          <h3 className="svc-panel__date">{longDate(selected, lang)}</h3>
          {(selDay.moveableFeast || selDay.fixedFeast) && (
            <div className="svc-panel__feast">✦ {dayFeastNames(selDay, lang)}</div>
          )}
          <div className="svc-panel__sched">
            <div className="svc-panel__label">{t('serviceSchedule', lang)}</div>
            {selEntries.length === 0 ? (
              <p className="svc-none">{t('noScheduleDay', lang)}</p>
            ) : selEntries.map(e => (
              <div key={e.parishId} className="svc-block">
                {multi && <div className="svc-block__parish">{parishName(e, lang)}</div>}
                <EntryText text={e.text} />
              </div>
            ))}
          </div>
          {selDay.tone !== null && <div className="svc-panel__tone">{toneLabel(selDay.tone, lang)}</div>}
          {selDay.nationalDay && <div className="svc-panel__note">{selDay.nationalDay[lang]}</div>}
          {selDay.nzHoliday && <div className="svc-panel__nz">{t('nzHoliday', lang)}: {selDay.nzHoliday[lang]}</div>}
          {selDay.fast && (
            <div className="svc-panel__fast" style={{ color: FAST_COLOR[selDay.fast] }}>
              {selDay.fast !== 'fastfree' && <FastIcon type={selDay.fast} size={28} />}
              <span>
                {fastLabel(selDay.fast, lang)}
                {selDay.fastPeriod && selDay.fastPeriod !== 'weekly' && (
                  <small> — {fastPeriodLabel(selDay.fastPeriod, lang)}</small>
                )}
              </span>
            </div>
          )}
        </section>
      )}

      <div className="svc-legend" aria-label={t('legendGreat', lang)}>
        {LEGEND_KINDS.map(([kind, key]) => (
          <span key={kind}><i className="svc-swatch" data-kind={kind} />{t(key, lang)}</span>
        ))}
        <span><ChurchIcon size={15} />{t('schedulePosted', lang)}</span>
        <span><i className="svc-nzmark" />{t('nzHoliday', lang)}</span>
      </div>
      <div className="svc-legend" aria-label={t('fastingLegend', lang)}>
        {LEGEND_FASTS.map(f => (
          <span key={f}><FastIcon type={f} size={20} />{fastLabel(f, lang)}</span>
        ))}
      </div>
      <p className="svc-note">{t('fastingNote', lang)}</p>
    </div>
  );
}
