// src/admin/ScheduleEditorPage.tsx
// My page → Schedule. A coordinator (their own parishes) or an admin (every parish) picks a parish and
// a month, clicks a day in the calendar and edits what that parish posts for it. The URL keeps the
// choice (?parish=<slug>&month=YYYY-MM&date=YYYY-MM-DD), so the public page can link straight to a day.

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import {
  subscribeParishes, subscribeServiceDaysForMonth, subscribeServiceTemplates, subscribeServiceEntryTypes,
} from '../lib/firestore';
import type { Parish, ServiceDay, ServiceTemplate, ServiceEntryType } from '../lib/firestore';
import { todayNZ } from '../lib/schedule';
import { addMonths, isMonth, monthOf } from '../lib/dates';
import { monthTitle } from '../lib/monthFormat';
import { entriesByDate } from '../lib/serviceDays';
import { isAtLeast } from '../lib/roles';
import ServiceCalendar from '../components/ServiceCalendar';
import DayEditor from './DayEditor';

interface Loaded { ym: string; days: ServiceDay[]; error: boolean }
const NO_DAYS: ServiceDay[] = [];
const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default function ScheduleEditorPage() {
  const { role, canEditParish } = useAuth();
  const { lang } = useLang();
  const [params, setParams] = useSearchParams();
  const [parishes, setParishes] = useState<Parish[] | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [entryTypes, setEntryTypes] = useState<ServiceEntryType[]>([]);
  const [libraryFailed, setLibraryFailed] = useState(false);

  const today = useMemo(() => todayNZ(), []);
  const monthParam = params.get('month');
  const ym = isMonth(monthParam) ? monthParam : monthOf(today);
  const dateParam = params.get('date');

  useEffect(() => subscribeParishes(setParishes), []);
  useEffect(
    () => subscribeServiceDaysForMonth(
      ym,
      days => setLoaded({ ym, days, error: false }),
      () => setLoaded({ ym, days: [], error: true }),
    ),
    [ym],
  );
  useEffect(() => {
    const fail = () => setLibraryFailed(true);
    const a = subscribeServiceTemplates(setTemplates, fail);
    const b = subscribeServiceEntryTypes(setEntryTypes, fail);
    return () => { a(); b(); };
  }, []);

  const editable = useMemo(
    () => (parishes ?? []).filter(p => canEditParish(p.id)).sort((a, b) => a.order - b.order),
    [parishes, canEditParish],
  );
  const parish = editable.find(p => p.slug === params.get('parish')) ?? editable[0];

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) { if (v === null) next.delete(k); else next.set(k, v); }
    setParams(next, { replace: true });
  };
  const goMonth = (target: string) => update({ month: target === monthOf(today) ? null : target, date: null });

  const days = loaded?.ym === ym ? loaded.days : NO_DAYS;
  const byDate = useMemo(
    () => new Map(days.filter(d => d.parishId === parish?.id).map(d => [d.date, d])),
    [days, parish],
  );
  // The calendar shows this parish's days even when the parish is hidden from the public.
  const entries = useMemo(
    () => (parish ? entriesByDate(days, [{ ...parish, visible: true }], [parish.id], lang) : {}),
    [days, parish, lang],
  );

  const loading = parishes === null || loaded?.ym !== ym;

  return (
    <>
      <div className="hero">
        <h1>Schedule</h1>
        <div className="hero-sub">Choose a parish and a day, then edit what is posted for it.</div>
      </div>
      <div className="page pa ed">
        {loading ? (
          <p className="um-muted">Loading…</p>
        ) : !parish ? (
          <p>
            {role === 'coordinator'
              ? 'No parish has been assigned to you yet. Ask an administrator to add one to your profile.'
              : 'There are no parishes yet. Add one on the Parishes page first.'}
          </p>
        ) : (
          <>
            <div className="um-bar">
              <select aria-label="Parish" className="um-select" value={parish.slug}
                      onChange={e => update({ parish: e.target.value, date: null })}>
                {editable.map(p => (
                  <option key={p.id} value={p.slug}>{p.nameEn}{p.visible ? '' : ' (hidden)'}</option>
                ))}
              </select>
              <Link className="um-btn" to={`/services?month=${ym}&view=calendar&parish=${parish.slug}`}>View public page</Link>
              {isAtLeast(role, 'admin') && <Link className="um-btn" to="/admin/templates">Templates &amp; quick entries</Link>}
            </div>

            <div className="svc-toolbar">
              <button type="button" className="svc-nav" aria-label="Previous month" onClick={() => goMonth(addMonths(ym, -1))}>←</button>
              <h2 className="svc-month" aria-live="polite">{monthTitle(ym, 'en')}</h2>
              <button type="button" className="svc-nav" aria-label="Next month" onClick={() => goMonth(addMonths(ym, 1))}>→</button>
              {ym !== monthOf(today) && (
                <button type="button" className="svc-btn" onClick={() => goMonth(monthOf(today))}>This month</button>
              )}
            </div>

            {loaded?.error ? (
              <p role="alert" className="um-error">The schedule could not be loaded. Please try again later.</p>
            ) : (
              <ServiceCalendar
                key={`${parish.id}|${ym}`} ym={ym} lang="en" entries={entries} multi={false} today={today}
                initialDate={isDate(dateParam) ? dateParam : null}
                renderSchedule={date => (
                  <DayEditor
                    key={`${parish.id}_${date}`} parish={parish} date={date} day={byDate.get(date)}
                    templates={templates} entryTypes={entryTypes} libraryFailed={libraryFailed}
                  />
                )}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
