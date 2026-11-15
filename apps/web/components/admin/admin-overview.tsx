'use client';

import { useEffect, useId, useMemo, useState, type PointerEvent } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CircleHelp,
  Clock3,
  Inbox,
  MessageSquare,
  RefreshCw,
  Users,
} from 'lucide-react';
import type { Locale } from '@/lib/api';
import { adminError, adminRequest } from './admin-api';

interface DailyActivity {
  date: string;
  leads: number;
  conversations: number;
  listings: number;
  projects: number;
}
interface StatusCount {
  status: string;
  count: number;
}
interface AdminOverviewData {
  window: { days: number; from: string; to: string; timeZone: string };
  summary: {
    listings: number;
    publishedListings: number;
    projects: number;
    publishedProjects: number;
    leads: number;
    newLeads: number;
    users: number;
    teamMembers: number;
    conversations: number;
  };
  daily: DailyActivity[];
  listingStatuses: StatusCount[];
  leadStatuses: StatusCount[];
  listingPurposes: { purpose: string; count: number }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
    actor: { id: string; firstName: string; lastName: string; email: string } | null;
  }[];
  recentLeads: { id: string; name: string; type: string; status: string; createdAt: string }[];
}

const statusColors: Record<string, string> = {
  PUBLISHED: '#4b7959',
  DRAFT: '#b7a1cf',
  IN_REVIEW: '#d8af64',
  ARCHIVED: '#aeb9b2',
  NEW: '#b7a1cf',
  CONTACTED: '#6f98a8',
  QUALIFIED: '#70a985',
  CLOSED: '#aeb9b2',
};
function count(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE').format(value);
}
function dateLabel(value: string, locale: Locale, full = false) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', {
    month: 'short',
    day: 'numeric',
    ...(full ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}
function statusLabel(status: string, locale: Locale) {
  const labels: Record<string, [string, string]> = {
    PUBLISHED: ['Published', 'منشور'],
    DRAFT: ['Draft', 'مسودة'],
    IN_REVIEW: ['In review', 'قيد المراجعة'],
    ARCHIVED: ['Archived', 'مؤرشف'],
    NEW: ['New', 'جديد'],
    CONTACTED: ['Contacted', 'تم التواصل'],
    QUALIFIED: ['Qualified', 'مؤهل'],
    CLOSED: ['Closed', 'مغلق'],
    SALE: ['For sale', 'للبيع'],
    RENT: ['For rent', 'للإيجار'],
    ENQUIRY: ['Enquiry', 'استفسار'],
    VIEWING: ['Viewing', 'زيارة'],
    VALUATION: ['Valuation', 'تقييم'],
    MORTGAGE: ['Mortgage', 'تمويل عقاري'],
    PROJECT: ['Project', 'مشروع'],
  };
  return labels[status]?.[locale === 'ar' ? 1 : 0] ?? status.replaceAll('_', ' ').toLowerCase();
}

function ActivityChart({ daily, locale }: { daily: DailyActivity[]; locale: Locale }) {
  const ar = locale === 'ar';
  const gradient = `admin-chart-${useId().replaceAll(':', '')}`;
  const [focused, setFocused] = useState<number | null>(null);
  const width = 900,
    height = 260,
    left = 45,
    right = 20,
    top = 18,
    bottom = 35;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const maximum = Math.max(
    4,
    Math.ceil(Math.max(...daily.map((item) => Math.max(item.leads, item.conversations)), 0) / 4) *
      4,
  );
  const x = (index: number) =>
    left + (daily.length <= 1 ? plotWidth / 2 : (index / (daily.length - 1)) * plotWidth);
  const y = (value: number) => top + plotHeight - (value / maximum) * plotHeight;
  const line = (field: 'leads' | 'conversations') =>
    daily.map((item, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(item[field])}`).join(' ');
  const selectedIndex = Math.min(focused ?? daily.length - 1, daily.length - 1);
  const selected = daily[selectedIndex];
  const totalLeads = daily.reduce((sum, item) => sum + item.leads, 0);
  const totalConversations = daily.reduce((sum, item) => sum + item.conversations, 0);
  function inspect(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = ((event.clientX - bounds.left) / bounds.width) * width;
    setFocused(
      Math.max(
        0,
        Math.min(daily.length - 1, Math.round(((point - left) / plotWidth) * (daily.length - 1))),
      ),
    );
  }
  if (!daily.length)
    return (
      <div className="admin-empty">
        {ar ? 'لا توجد بيانات في هذه الفترة.' : 'No activity data is available for this period.'}
      </div>
    );
  return (
    <div className="admin-activity-chart">
      <div className="admin-chart-totals">
        <div>
          <i style={{ background: '#4b7959' }} />
          <span>{ar ? 'الاستفسارات' : 'Enquiries'}</span>
          <strong>{count(totalLeads, locale)}</strong>
        </div>
        <div>
          <i style={{ background: '#a58abb' }} />
          <span>{ar ? 'محادثات QA' : 'QA conversations'}</span>
          <strong>{count(totalConversations, locale)}</strong>
        </div>
      </div>
      <div className="admin-chart-reading">
        <span>{dateLabel(selected.date, locale, true)}</span>
        <span>
          {ar ? 'استفسارات' : 'Enquiries'} <b>{count(selected.leads, locale)}</b>
        </span>
        <span>
          {ar ? 'محادثات' : 'Conversations'} <b>{count(selected.conversations, locale)}</b>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          ar
            ? 'رسم يومي للاستفسارات ومحادثات QA. استخدم شريط التاريخ أسفله لاستعراض القيم.'
            : 'Daily enquiries and QA conversations. Use the date slider below to inspect values.'
        }
        onPointerMove={inspect}
        onPointerLeave={() => setFocused(null)}
        className="admin-line-chart"
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#74a781" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#74a781" stopOpacity="0.015" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((step) => {
          const value = (maximum / 4) * step;
          return (
            <g key={step}>
              <line
                x1={left}
                x2={width - right}
                y1={y(value)}
                y2={y(value)}
                className="admin-chart-gridline"
              />
              <text x={left - 12} y={y(value) + 4} textAnchor="end">
                {count(value, locale)}
              </text>
            </g>
          );
        })}
        <path
          d={`${line('leads')} L ${x(daily.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`}
          fill={`url(#${gradient})`}
        />
        <path
          d={line('leads')}
          fill="none"
          stroke="#4b7959"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={line('conversations')}
          fill="none"
          stroke="#a58abb"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="5 5"
        />
        <line
          x1={x(selectedIndex)}
          x2={x(selectedIndex)}
          y1={top}
          y2={height - bottom}
          stroke="#92a395"
          strokeWidth="1"
          strokeDasharray="3 5"
        />
        <circle
          cx={x(selectedIndex)}
          cy={y(selected.leads)}
          r="4.5"
          fill="#4b7959"
          stroke="var(--admin-surface)"
          strokeWidth="2"
        />
        <circle
          cx={x(selectedIndex)}
          cy={y(selected.conversations)}
          r="4.5"
          fill="#a58abb"
          stroke="var(--admin-surface)"
          strokeWidth="2"
        />
        {[0, Math.floor((daily.length - 1) / 2), daily.length - 1]
          .filter((item, index, items) => items.indexOf(item) === index)
          .map((index) => (
            <text
              key={index}
              x={x(index)}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === daily.length - 1 ? 'end' : 'middle'}
            >
              {dateLabel(daily[index].date, locale)}
            </text>
          ))}
      </svg>
      <label className="admin-chart-slider">
        <span>{ar ? 'استعراض اليوم' : 'Inspect a day'}</span>
        <input
          type="range"
          min={0}
          max={daily.length - 1}
          step={1}
          value={selectedIndex}
          onChange={(event) => setFocused(Number(event.target.value))}
          aria-valuetext={`${dateLabel(selected.date, locale, true)}: ${count(selected.leads, locale)} ${ar ? 'استفسارات' : 'enquiries'}, ${count(selected.conversations, locale)} ${ar ? 'محادثات' : 'conversations'}`}
        />
      </label>
    </div>
  );
}

function StatusDonut({ rows, locale }: { rows: StatusCount[]; locale: Locale }) {
  const ar = locale === 'ar';
  const [selected, setSelected] = useState<string | null>(null);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  let offset = 0;
  const segments = rows.map((row) => {
    const length = total ? (row.count / total) * 100 : 0;
    const segment = { ...row, length, offset };
    offset += length;
    return segment;
  });
  const current = rows.find((row) => row.status === selected);
  return (
    <div className="admin-donut-layout">
      <div className="admin-donut">
        <svg
          viewBox="0 0 144 144"
          role="img"
          aria-label={ar ? 'توزيع العقارات حسب حالة النشر' : 'Properties by publication status'}
        >
          <circle cx="72" cy="72" r="53" fill="none" stroke="var(--admin-line)" strokeWidth="18" />
          {segments.map((row) => (
            <circle
              key={row.status}
              cx="72"
              cy="72"
              r="53"
              pathLength="100"
              fill="none"
              stroke={statusColors[row.status] ?? '#90a396'}
              strokeWidth={selected === row.status ? 23 : 18}
              strokeDasharray={`${row.length} ${100 - row.length}`}
              strokeDashoffset={-row.offset}
              transform="rotate(-90 72 72)"
              opacity={selected && selected !== row.status ? 0.32 : 1}
            />
          ))}
        </svg>
        <div>
          <strong>{count(current?.count ?? total, locale)}</strong>
          <span>{current ? statusLabel(current.status, locale) : ar ? 'عقار' : 'properties'}</span>
        </div>
      </div>
      <div className="admin-donut-legend">
        {rows.length ? (
          rows.map((row) => (
            <button
              type="button"
              key={row.status}
              onClick={() => setSelected((value) => (value === row.status ? null : row.status))}
              aria-pressed={selected === row.status}
            >
              <i style={{ background: statusColors[row.status] ?? '#90a396' }} />
              <span>{statusLabel(row.status, locale)}</span>
              <strong>{count(row.count, locale)}</strong>
            </button>
          ))
        ) : (
          <p className="admin-muted">{ar ? 'لم تُضف عقارات بعد.' : 'No properties yet.'}</p>
        )}
      </div>
    </div>
  );
}

export default function AdminOverview({
  locale,
  onNavigate,
}: {
  locale: Locale;
  onNavigate: (section: string) => void;
}) {
  const ar = locale === 'ar';
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailure(null);
    void adminRequest<AdminOverviewData>(`/admin/overview?days=${days}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setFailure(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [days, attempt]);
  const periodInventory = useMemo(
    () => data?.daily.reduce((sum, day) => sum + day.listings + day.projects, 0) ?? 0,
    [data],
  );
  return (
    <div className="admin-overview">
      <div className="admin-toolbar admin-overview-toolbar">
        <div>
          <p className="admin-eyebrow">
            <span className="admin-live-dot" />
            {ar ? 'نظرة شاملة، مبنية على بياناتك' : 'A CLEAR VIEW, BUILT ON YOUR DATA'}
          </p>
          <p className="admin-muted">
            {ar
              ? 'تابع المحفظة والمحادثات والخطوة التالية.'
              : 'Your portfolio, your conversations, and what comes next.'}
          </p>
        </div>
        <div className="admin-inline-actions">
          <label className="admin-period-picker">
            <Clock3 size={14} />
            <span className="admin-sr-only">{ar ? 'الفترة' : 'Period'}</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {[7, 30, 90].map((value) => (
                <option key={value} value={value}>
                  {ar ? `آخر ${count(value, locale)} يوماً` : `Last ${value} days`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="admin-button admin-button-ghost"
            disabled={loading}
            onClick={() => setAttempt((value) => value + 1)}
            aria-label={ar ? 'تحديث النظرة العامة' : 'Refresh overview'}
          >
            <RefreshCw size={16} className={loading ? 'admin-spin' : ''} />
          </button>
        </div>
      </div>
      {loading ? (
        <div
          className="admin-overview-loading"
          aria-busy="true"
          aria-label={ar ? 'جارٍ تحميل المؤشرات' : 'Loading dashboard metrics'}
        >
          <div className="admin-stat-grid">
            {[0, 1, 2, 3].map((i) => (
              <div className="admin-skeleton admin-stat-skeleton" key={i} />
            ))}
          </div>
          <div className="admin-skeleton admin-chart-skeleton" />
        </div>
      ) : failure ? (
        <div className="admin-card admin-empty">
          <CircleHelp size={30} />
          <h2>{ar ? 'تعذّر تحميل النظرة العامة.' : 'We could not load your overview.'}</h2>
          <p>{adminError(failure, locale)}</p>
          <button className="admin-button" onClick={() => setAttempt((value) => value + 1)}>
            <RefreshCw size={15} />
            {ar ? 'حاول مجدداً' : 'Try again'}
          </button>
        </div>
      ) : data ? (
        <>
          <div className="admin-stat-grid">
            {[
              {
                label: ar ? 'العقارات' : 'Properties',
                value: data.summary.listings,
                icon: Building2,
                tone: 'green',
                note: `${count(data.summary.publishedListings, locale)} ${ar ? 'منشور' : 'published'}`,
                section: 'listings',
              },
              {
                label: ar ? 'المشاريع' : 'Developments',
                value: data.summary.projects,
                icon: ArrowUpRight,
                tone: 'lavender',
                note: `${count(data.summary.publishedProjects, locale)} ${ar ? 'منشور' : 'published'}`,
                section: 'projects',
              },
              {
                label: ar ? 'الاستفسارات' : 'Enquiries',
                value: data.summary.leads,
                icon: Inbox,
                tone: 'peach',
                note: `${count(data.summary.newLeads, locale)} ${ar ? 'بانتظار التواصل' : 'awaiting contact'}`,
                section: 'leads',
              },
              {
                label: ar ? 'محادثات QA' : 'QA conversations',
                value: data.summary.conversations,
                icon: MessageSquare,
                tone: 'blue',
                note: ar ? 'محادثات خاصة مع الفريق' : 'Private team conversations',
                section: 'conversations',
              },
            ].map((item) => (
              <button
                className={`admin-stat-card admin-stat-${item.tone}`}
                key={item.section}
                onClick={() => onNavigate(item.section)}
              >
                <span className="admin-stat-label">
                  {item.label}
                  <item.icon size={19} />
                </span>
                <strong>{count(item.value, locale)}</strong>
                <span className="admin-stat-note">
                  {item.note}
                  <ArrowUpRight size={14} />
                </span>
              </button>
            ))}
          </div>
          <p className="admin-total-note">
            {ar
              ? 'إجماليات المحفظة والاستفسارات منذ البداية. النشاط اليومي حسب الفترة المحددة بتوقيت UTC.'
              : 'Portfolio and pipeline totals are all time. Daily activity follows the selected period (UTC).'}
          </p>
          <div className="admin-chart-layout">
            <section className="admin-card admin-activity-card">
              <div className="admin-card-heading">
                <div>
                  <h2 className="admin-section-title">
                    {ar ? 'بداية المحادثة' : 'Where conversations begin'}
                  </h2>
                  <p className="admin-muted">
                    {ar
                      ? 'طلبات جديدة ومحادثات خاصة، يوماً بيوم.'
                      : 'New enquiries and private conversations, day by day.'}
                  </p>
                </div>
                <span className="admin-chart-timezone">UTC</span>
              </div>
              <ActivityChart daily={data.daily} locale={locale} />
            </section>
            <section className="admin-card admin-distribution-card">
              <div className="admin-card-heading">
                <div>
                  <h2 className="admin-section-title">
                    {ar ? 'حالة المحفظة' : 'Portfolio status'}
                  </h2>
                  <p className="admin-muted">
                    {ar ? 'كل عقار، في مرحلته الحالية.' : 'Every property, at its current stage.'}
                  </p>
                </div>
              </div>
              <StatusDonut rows={data.listingStatuses} locale={locale} />
              <div className="admin-property-mix">
                {data.listingPurposes.map((row) => (
                  <div key={row.purpose}>
                    <span>{statusLabel(row.purpose, locale)}</span>
                    <strong>{count(row.count, locale)}</strong>
                    <i>
                      <b
                        style={{
                          width: `${data.summary.listings ? (row.count / data.summary.listings) * 100 : 0}%`,
                          background: row.purpose === 'SALE' ? '#6e9772' : '#b8a0ca',
                        }}
                      />
                    </i>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="admin-operating-strip">
            <div>
              <span className="admin-feature-icon">
                <Users size={19} />
              </span>
              <p>
                <strong>{count(data.summary.teamMembers, locale)}</strong>
                <span>{ar ? 'أعضاء الفريق' : 'team members'}</span>
              </p>
              <button
                type="button"
                onClick={() => onNavigate('team')}
                aria-label={ar ? 'إدارة الفريق' : 'Manage team'}
              >
                <ArrowUpRight size={17} />
              </button>
            </div>
            <div>
              <span className="admin-feature-icon">
                <Building2 size={19} />
              </span>
              <p>
                <strong>{count(periodInventory, locale)}</strong>
                <span>
                  {ar
                    ? 'عقارات ومشاريع أُضيفت في هذه الفترة'
                    : 'properties & projects added this period'}
                </span>
              </p>
              <ArrowDownRight size={17} />
            </div>
            <div>
              <span className="admin-feature-icon">
                <Users size={19} />
              </span>
              <p>
                <strong>{count(data.summary.users, locale)}</strong>
                <span>{ar ? 'حسابات مسجلة إجمالاً' : 'registered accounts, all time'}</span>
              </p>
              <button
                type="button"
                onClick={() => onNavigate('users')}
                aria-label={ar ? 'إدارة المستخدمين' : 'Manage users'}
              >
                <ArrowUpRight size={17} />
              </button>
            </div>
          </div>
          <div className="admin-bottom-layout">
            <section className="admin-card">
              <div className="admin-card-heading">
                <div>
                  <h2 className="admin-section-title">
                    {ar ? 'أحدث الاستفسارات' : 'The latest enquiries'}
                  </h2>
                  <p className="admin-muted">
                    {ar ? 'كل رسالة، فرصة للتواصل.' : 'Every message, a chance to connect.'}
                  </p>
                </div>
                <button className="admin-text-button" onClick={() => onNavigate('leads')}>
                  {ar ? 'عرض الكل' : 'View all'}
                  <ArrowRight size={14} />
                </button>
              </div>
              {data.recentLeads.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{ar ? 'الاسم' : 'Name'}</th>
                        <th>{ar ? 'الطلب' : 'Request'}</th>
                        <th>{ar ? 'الحالة' : 'Status'}</th>
                        <th>{ar ? 'التاريخ' : 'Date'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td>
                            <strong>{lead.name}</strong>
                          </td>
                          <td>{statusLabel(lead.type, locale)}</td>
                          <td>
                            <span
                              className={`admin-badge ${lead.status === 'NEW' ? 'admin-badge-lavender' : lead.status === 'QUALIFIED' ? 'admin-badge-green' : ''}`}
                            >
                              {statusLabel(lead.status, locale)}
                            </span>
                          </td>
                          <td className="admin-nowrap">{dateLabel(lead.createdAt, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="admin-empty">
                  <Inbox size={25} />
                  <p>{ar ? 'الاستفسارات الجديدة ستظهر هنا.' : 'New enquiries will appear here.'}</p>
                </div>
              )}
              <div className="admin-lead-statuses">
                {data.leadStatuses.map((row) => (
                  <div key={row.status}>
                    <span>
                      <i style={{ background: statusColors[row.status] ?? '#90a396' }} />
                      {statusLabel(row.status, locale)}
                    </span>
                    <strong>{count(row.count, locale)}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="admin-card">
              <div className="admin-card-heading">
                <div>
                  <h2 className="admin-section-title">
                    {ar ? 'آخر التحديثات' : 'A little more in motion'}
                  </h2>
                  <p className="admin-muted">
                    {ar
                      ? 'آخر التغييرات المسجلة في الموقع.'
                      : 'The latest recorded changes to your website.'}
                  </p>
                </div>
                <button className="admin-text-button" onClick={() => onNavigate('audit')}>
                  {ar ? 'السجل' : 'Activity log'}
                  <ArrowRight size={14} />
                </button>
              </div>
              {data.recentActivity.length ? (
                <ol className="admin-activity-list">
                  {data.recentActivity.slice(0, 6).map((activity) => (
                    <li key={activity.id}>
                      <span className="admin-activity-dot" />
                      <div>
                        <strong>{activity.action.replace(/[._-]+/g, ' ')}</strong>
                        <p>
                          {activity.actor
                            ? `${activity.actor.firstName} ${activity.actor.lastName}`
                            : ar
                              ? 'النظام'
                              : 'System'}
                          <span>·</span>
                          {activity.entityType}
                        </p>
                      </div>
                      <time dateTime={activity.createdAt}>
                        {dateLabel(activity.createdAt, locale)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="admin-empty">
                  <Clock3 size={25} />
                  <p>
                    {ar ? 'التغييرات المسجلة ستظهر هنا.' : 'Recorded changes will appear here.'}
                  </p>
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
