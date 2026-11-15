'use client';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  KeyRound,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Upload,
  X,
} from 'lucide-react';
import { localized, type Locale } from '@/lib/api';
import type { AdminOptions, AdminPage, AdminUser } from '@/lib/admin-types';
import type { TeamConversation, TeamInboxConversation, TeamMessage } from '@/lib/team-types';
import { adminError, adminRequest } from './admin-api';
import { AdminMediaPicker } from './admin-media-library';
import './admin-operations.css';

type TeamRecord = {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  titleEn: string;
  titleAr: string;
  bioEn: string;
  bioAr: string;
  avatarMediaId: string | null;
  isPublic: boolean;
  photoUrl: string | null;
  user: AdminUser;
};
type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  type: string;
  status: string;
  internalNotes: string;
  assignedToId: string | null;
  createdAt: string;
  preferredAt: string | null;
  listingId: string | null;
  projectId: string | null;
  listing?: { titleEn: string; titleAr: string } | null;
  project?: { nameEn: string; nameAr: string } | null;
};
type Audit = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actor?: { firstName: string; lastName: string; email?: string } | null;
  metadata: Record<string, unknown>;
};
const roles = ['CUSTOMER', 'TEAM_MEMBER', 'AGENT', 'ADMIN'];
function words(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replaceAll('.', ' · ');
}
function date(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
function useRows<T>(path: string, locale: Locale, filters: Record<string, string> = {}) {
  const [page, setPage] = useState(1),
    [rows, setRows] = useState<T[]>([]),
    [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [nonce, setNonce] = useState(0);
  const parameters = new URLSearchParams({
    ...filters,
    page: String(page),
    limit: '15',
  }).toString();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void adminRequest<AdminPage<T>>(`${path}?${parameters}`, { signal: controller.signal })
      .then((result) => {
        setRows(result.data);
        setMeta(result.meta ?? { page, limit: 15, total: result.data.length, totalPages: 1 });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(adminError(e, locale));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, parameters, locale, nonce]);
  return { rows, meta, page, setPage, loading, error, reload: () => setNonce((n) => n + 1) };
}
function useFilter() {
  const [input, setInput] = useState(''),
    [value, setValue] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setValue(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  return { input, setInput, value };
}
function Pager({
  list,
  locale,
}: {
  list: {
    meta: { page: number; totalPages: number; total: number };
    setPage: (p: number) => void;
    loading: boolean;
  };
  locale: Locale;
}) {
  return (
    <div className="admin-pager">
      <span>{locale === 'ar' ? `${list.meta.total} نتيجة` : `${list.meta.total} records`}</span>
      <button
        className="admin-button"
        disabled={list.loading || list.meta.page <= 1}
        onClick={() => list.setPage(list.meta.page - 1)}
        aria-label={locale === 'ar' ? 'السابق' : 'Previous page'}
      >
        <ChevronLeft size={16} />
      </button>
      <span>
        {list.meta.page} / {Math.max(1, list.meta.totalPages)}
      </span>
      <button
        className="admin-button"
        disabled={list.loading || list.meta.page >= list.meta.totalPages}
        onClick={() => list.setPage(list.meta.page + 1)}
        aria-label={locale === 'ar' ? 'التالي' : 'Next page'}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
function SearchBox({ filter, locale }: { filter: ReturnType<typeof useFilter>; locale: Locale }) {
  return (
    <label className="admin-field admin-search">
      <span>
        <Search size={14} />
        {locale === 'ar' ? 'بحث' : 'Search'}
      </span>
      <input
        maxLength={100}
        value={filter.input}
        onChange={(e) => filter.setInput(e.target.value)}
        placeholder={locale === 'ar' ? 'اسم أو بريد إلكتروني' : 'Name or email'}
      />
    </label>
  );
}
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const e = ref.current;
    e?.showModal();
    return () => e?.close();
  }, []);
  return (
    <dialog
      className="admin-op-dialog"
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="admin-dialog-content">
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            className="admin-button"
            aria-label="Close dialog / إغلاق"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
function Field({
  name,
  label,
  defaultValue,
  required = false,
  type = 'text',
  maxLength = 200,
  minLength,
  children,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
  minLength?: number;
  children?: ReactNode;
}) {
  return (
    <label className="admin-field" htmlFor={`op-${name}`}>
      <span>{label}</span>
      {children ?? (
        <input
          id={`op-${name}`}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          maxLength={maxLength}
          minLength={minLength}
          autoComplete={type === 'password' ? 'new-password' : undefined}
        />
      )}
    </label>
  );
}
function Status({
  loading,
  error,
  empty,
  locale,
}: {
  loading: boolean;
  error: string;
  empty: boolean;
  locale: Locale;
}) {
  return error ? (
    <p className="admin-alert" role="alert">
      {error}
    </p>
  ) : loading ? (
    <div className="admin-empty" aria-busy="true">
      {locale === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}
    </div>
  ) : empty ? (
    <div className="admin-empty">
      {locale === 'ar' ? 'لا توجد نتائج بعد.' : 'Nothing here yet.'}
    </div>
  ) : null;
}
function TeamManager({ locale }: { locale: Locale }) {
  const ar = locale === 'ar',
    filter = useFilter();
  const list = useRows<TeamRecord>('/admin/team', locale, { q: filter.value });
  const [selected, setSelected] = useState<TeamRecord | 'new' | null>(null);
  useEffect(() => list.setPage(1), [filter.value]);
  return (
    <section className="admin-module">
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">
            {ar ? 'الناس خلف الموقع' : 'THE PEOPLE BEHIND THE WEBSITE'}
          </p>
          <h2>{ar ? 'الفريق وصفحة QA' : 'Team & QA'}</h2>
          <p>
            {ar
              ? 'أضف أعضاء وعدّل صورهم وتعريفاتهم وظهورهم في صفحة QA.'
              : 'Add people and manage their portraits, introductions and visibility on QA.'}
          </p>
        </div>
        <button className="admin-button admin-button-primary" onClick={() => setSelected('new')}>
          <Plus size={16} />
          {ar ? 'إضافة عضو' : 'Add team member'}
        </button>
      </div>
      <div className="admin-card">
        <SearchBox filter={filter} locale={locale} />
        <Status
          loading={list.loading}
          error={list.error}
          empty={!list.rows.length}
          locale={locale}
        />
        {!list.loading && !!list.rows.length && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{ar ? 'العضو' : 'Member'}</th>
                  <th>{ar ? 'الدور العام' : 'Public title'}</th>
                  <th>{ar ? 'الصلاحية' : 'Account access'}</th>
                  <th>{ar ? 'الظهور' : 'Visibility'}</th>
                  <th>{ar ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="admin-person">
                        {member.avatarMediaId ? (
                          <img
                            src={`/api/admin/media/manage/${member.avatarMediaId}/file`}
                            alt=""
                          />
                        ) : (
                          <span>{member.displayName.slice(0, 1)}</span>
                        )}
                        <div>
                          <strong>{member.displayName}</strong>
                          <small>{member.user.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{ar ? member.titleAr : member.titleEn}</td>
                    <td>
                      <span className="admin-badge">{words(member.user.role)}</span>
                    </td>
                    <td>
                      <span
                        className={`admin-badge ${member.isPublic && member.user.isActive ? 'admin-badge-green' : ''}`}
                      >
                        {member.isPublic && member.user.isActive
                          ? ar
                            ? 'عام'
                            : 'Public'
                          : ar
                            ? 'مخفي'
                            : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <button className="admin-button" onClick={() => setSelected(member)}>
                        {ar ? 'تعديل' : 'Edit profile'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager list={list} locale={locale} />
      </div>
      {selected && (
        <TeamEditor
          locale={locale}
          member={selected === 'new' ? null : selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            list.reload();
          }}
        />
      )}
    </section>
  );
}
function TeamEditor({
  locale,
  member,
  onClose,
  onSaved,
}: {
  locale: Locale;
  member: TeamRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ar = locale === 'ar';
  const [avatar, setAvatar] = useState<string | null>(member?.avatarMediaId ?? null),
    [uploading, setUploading] = useState(false),
    [picking, setPicking] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(ar ? 'اختر صورة أصغر من ٥ ميغابايت.' : 'Choose a photo under 5 MB.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      const media = await adminRequest<{ id: string }>('/media', { method: 'POST', body });
      setAvatar(media.id);
    } catch (e) {
      setError(adminError(e, locale));
    } finally {
      setUploading(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || uploading) return;
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      slug: form.get('slug'),
      displayName: form.get('displayName'),
      titleEn: form.get('titleEn'),
      titleAr: form.get('titleAr'),
      bioEn: form.get('bioEn'),
      bioAr: form.get('bioAr'),
      isPublic: form.get('isPublic') === 'on',
      avatarMediaId: avatar,
    };
    if (!member)
      for (const key of ['email', 'password', 'firstName', 'lastName', 'role'])
        payload[key] = form.get(key);
    setSaving(true);
    setError('');
    try {
      await adminRequest(`/admin/team${member ? `/${member.id}` : ''}`, {
        method: member ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (error) {
      setError(adminError(error, locale));
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Dialog
        title={
          member
            ? ar
              ? 'تعديل عضو الفريق'
              : 'Edit team member'
            : ar
              ? 'إضافة عضو فريق'
              : 'Add team member'
        }
        onClose={onClose}
      >
        <form onSubmit={save}>
          {error && (
            <p className="admin-alert" role="alert">
              {error}
            </p>
          )}
          {!member && (
            <fieldset className="admin-form-section">
              <legend>{ar ? 'الحساب' : 'Account'}</legend>
              <div className="admin-grid">
                <Field
                  name="firstName"
                  label={ar ? 'الاسم الأول' : 'First name'}
                  required
                  maxLength={80}
                />
                <Field
                  name="lastName"
                  label={ar ? 'اسم العائلة' : 'Last name'}
                  required
                  maxLength={80}
                />
                <Field
                  name="email"
                  label={ar ? 'البريد الإلكتروني' : 'Email'}
                  type="email"
                  required
                  maxLength={254}
                />
                <Field
                  name="password"
                  label={
                    ar
                      ? 'كلمة مرور مبدئية · ١٢ حرفاً على الأقل'
                      : 'Initial password · at least 12 characters'
                  }
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                />
                <Field name="role" label={ar ? 'صلاحية الحساب' : 'Account access'}>
                  <select id="op-role" name="role" defaultValue="TEAM_MEMBER">
                    <option value="TEAM_MEMBER">{ar ? 'عضو فريق' : 'Team member'}</option>
                    <option value="ADMIN">{ar ? 'مدير الموقع' : 'Administrator'}</option>
                  </select>
                </Field>
              </div>
            </fieldset>
          )}
          <div className="admin-grid">
            <Field
              name="displayName"
              label={ar ? 'الاسم الظاهر' : 'Display name'}
              defaultValue={member?.displayName}
              required
              maxLength={160}
            />
            <Field
              name="slug"
              label={ar ? 'رابط التعريف' : 'Profile slug'}
              defaultValue={member?.slug}
              required
              maxLength={120}
            />
            <Field
              name="titleEn"
              label="Public title · English"
              defaultValue={member?.titleEn}
              required
              maxLength={80}
            />
            <Field
              name="titleAr"
              label="المسمى العام · العربية"
              defaultValue={member?.titleAr}
              required
              maxLength={80}
            />
            <Field name="bioEn" label="Introduction · English">
              <textarea
                id="op-bioEn"
                name="bioEn"
                defaultValue={member?.bioEn}
                rows={4}
                maxLength={2000}
              />
            </Field>
            <Field name="bioAr" label="التعريف · العربية">
              <textarea
                id="op-bioAr"
                name="bioAr"
                dir="rtl"
                defaultValue={member?.bioAr}
                rows={4}
                maxLength={2000}
              />
            </Field>
          </div>
          <div className="admin-team-photo">
            {avatar ? (
              <img
                src={`/api/admin/media/manage/${avatar}/file`}
                alt={ar ? 'معاينة الصورة' : 'Photo preview'}
              />
            ) : (
              <div className="admin-photo-empty">
                <Upload size={25} />
              </div>
            )}
            <label className="admin-field">
              <span>
                {uploading
                  ? ar
                    ? 'جارٍ رفع الصورة…'
                    : 'Uploading…'
                  : ar
                    ? 'صورة الملف'
                    : 'Profile photo'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading || saving}
                onChange={(e) => void upload(e.target.files?.[0])}
              />
              <small>JPEG · PNG · WebP · 5 MB</small>
            </label>
            <button
              type="button"
              className="admin-button"
              disabled={uploading || saving}
              onClick={() => setPicking(true)}
            >
              {ar ? 'اختيار من المكتبة' : 'Choose from library'}
            </button>
            {avatar && (
              <button type="button" className="admin-button" onClick={() => setAvatar(null)}>
                {ar ? 'إزالة الصورة' : 'Remove photo'}
              </button>
            )}
          </div>
          <label className="admin-check">
            <input name="isPublic" type="checkbox" defaultChecked={member?.isPublic ?? true} />
            {ar ? 'إظهار العضو في صفحة QA' : 'Show this member on QA'}
          </label>
          <p className="admin-muted">
            {ar
              ? 'المسمى العام لا يغيّر صلاحيات الحساب. يمكنك إدارة الوصول من قسم المستخدمين.'
              : 'A public title does not change account permissions. Manage access in Users.'}
          </p>
          <footer>
            <button type="button" className="admin-button" onClick={onClose}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="admin-button admin-button-primary" disabled={saving || uploading}>
              <Save size={16} />
              {saving ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : ar ? 'حفظ العضو' : 'Save member'}
            </button>
          </footer>
        </form>
      </Dialog>
      {picking && (
        <AdminMediaPicker
          locale={locale}
          selected={avatar ? [avatar] : []}
          multiple={false}
          onChange={(ids) => setAvatar(ids[0] ?? null)}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
function UsersManager({ locale }: { locale: Locale }) {
  const ar = locale === 'ar',
    filter = useFilter();
  const [role, setRole] = useState(''),
    [selected, setSelected] = useState<AdminUser | 'new' | null>(null),
    [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const list = useRows<AdminUser>('/users', locale, { q: filter.value, role });
  useEffect(() => list.setPage(1), [filter.value, role]);
  return (
    <section className="admin-module">
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">{ar ? 'الوصول والمسؤولية' : 'ACCESS & RESPONSIBILITY'}</p>
          <h2>{ar ? 'المستخدمون' : 'Users'}</h2>
          <p>
            {ar
              ? 'إدارة الحسابات والأدوار وتفعيل الوصول.'
              : 'Manage accounts, authorization roles and active access.'}
          </p>
        </div>
        <button className="admin-button admin-button-primary" onClick={() => setSelected('new')}>
          <Plus size={16} />
          {ar ? 'إضافة مستخدم' : 'Add user'}
        </button>
      </div>
      <div className="admin-card">
        <div className="admin-toolbar">
          <SearchBox filter={filter} locale={locale} />
          <label className="admin-field">
            <span>{ar ? 'الصلاحية' : 'Role'}</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">{ar ? 'كل الأدوار' : 'All roles'}</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {words(r)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Status
          loading={list.loading}
          error={list.error}
          empty={!list.rows.length}
          locale={locale}
        />
        {!list.loading && !!list.rows.length && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{ar ? 'المستخدم' : 'User'}</th>
                  <th>{ar ? 'الصلاحية' : 'Role'}</th>
                  <th>{ar ? 'الحالة' : 'Status'}</th>
                  <th>{ar ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>
                        {user.firstName} {user.lastName}
                      </strong>
                      <small>{user.email}</small>
                    </td>
                    <td>
                      <span className="admin-badge">{words(user.role)}</span>
                    </td>
                    <td>
                      <span className={`admin-badge ${user.isActive ? 'admin-badge-green' : ''}`}>
                        {user.isActive ? (ar ? 'نشط' : 'Active') : ar ? 'معطّل' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button className="admin-button" onClick={() => setSelected(user)}>
                          {ar ? 'تعديل الوصول' : 'Edit access'}
                        </button>
                        <button className="admin-button" onClick={() => setPasswordUser(user)}>
                          <KeyRound size={14} />
                          {ar ? 'تعيين كلمة مرور' : 'Set password'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager list={list} locale={locale} />
      </div>
      {selected && (
        <UserEditor
          locale={locale}
          user={selected === 'new' ? null : selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            list.reload();
          }}
        />
      )}
      {passwordUser && (
        <PasswordEditor user={passwordUser} locale={locale} onClose={() => setPasswordUser(null)} />
      )}
    </section>
  );
}
function UserEditor({
  user,
  locale,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  locale: Locale;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ar = locale === 'ar';
  const [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const data = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      role: data.get('role'),
      isActive: data.get('isActive') === 'on',
    };
    if (!user)
      for (const key of ['email', 'password', 'firstName', 'lastName'])
        payload[key] = data.get(key);
    setSaving(true);
    setError('');
    try {
      await adminRequest(user ? `/users/${user.id}` : '/admin/users', {
        method: user ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (e) {
      setError(adminError(e, locale));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      title={
        user ? (ar ? 'تعديل وصول المستخدم' : 'Edit user access') : ar ? 'إضافة مستخدم' : 'Add user'
      }
      onClose={onClose}
    >
      <form onSubmit={save}>
        {error && (
          <p className="admin-alert" role="alert">
            {error}
          </p>
        )}
        {user ? (
          <p className="admin-user-summary">
            <strong>
              {user.firstName} {user.lastName}
            </strong>
            <span>{user.email}</span>
          </p>
        ) : (
          <div className="admin-grid">
            <Field
              name="firstName"
              label={ar ? 'الاسم الأول' : 'First name'}
              required
              maxLength={80}
            />
            <Field
              name="lastName"
              label={ar ? 'اسم العائلة' : 'Last name'}
              required
              maxLength={80}
            />
            <Field
              name="email"
              label={ar ? 'البريد الإلكتروني' : 'Email'}
              type="email"
              required
              maxLength={254}
            />
            <Field
              name="password"
              label={ar ? 'كلمة مرور مبدئية' : 'Initial password'}
              type="password"
              required
              minLength={12}
              maxLength={128}
            />
          </div>
        )}
        <Field name="role" label={ar ? 'صلاحية الحساب' : 'Authorization role'}>
          <select id="op-role" name="role" defaultValue={user?.role ?? 'CUSTOMER'}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {words(role)}
              </option>
            ))}
          </select>
        </Field>
        <label className="admin-check">
          <input type="checkbox" name="isActive" defaultChecked={user?.isActive ?? true} />
          {ar ? 'الحساب نشط' : 'Account is active'}
        </label>
        <p className="admin-muted">
          {ar
            ? 'تغيير الوصول ينهي الجلسات الحالية. يحمي النظام آخر حساب إداري نشط.'
            : 'Access changes end existing sessions. The last active administrator is protected.'}
        </p>
        <footer>
          <button type="button" className="admin-button" onClick={onClose}>
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          <button className="admin-button admin-button-primary" disabled={saving}>
            <Save size={16} />
            {saving ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : ar ? 'حفظ المستخدم' : 'Save user'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
function PasswordEditor({
  user,
  locale,
  onClose,
}: {
  user: AdminUser;
  locale: Locale;
  onClose: () => void;
}) {
  const ar = locale === 'ar';
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (form.get('newPassword') !== form.get('confirmPassword')) {
      setError(ar ? 'كلمتا المرور غير متطابقتين.' : 'The passwords do not match.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminRequest(`/admin/users/${user.id}/password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: form.get('newPassword') }),
      });
      setSaved(true);
    } catch (e) {
      setError(adminError(e, locale));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog title={ar ? 'تعيين كلمة مرور' : 'Set account password'} onClose={onClose}>
      {saved ? (
        <div className="admin-empty" role="status">
          <Check size={26} />
          <p>
            {ar
              ? 'تم تحديث كلمة المرور وإنهاء الجلسات السابقة.'
              : 'Password updated. Previous sessions have ended.'}
          </p>
          <button className="admin-button" onClick={onClose}>
            {ar ? 'تم' : 'Done'}
          </button>
        </div>
      ) : (
        <form onSubmit={save}>
          <p>{user.email}</p>
          {error && (
            <p className="admin-alert" role="alert">
              {error}
            </p>
          )}
          <Field
            name="newPassword"
            label={ar ? 'كلمة المرور الجديدة' : 'New password'}
            type="password"
            required
            minLength={12}
            maxLength={128}
          />
          <Field
            name="confirmPassword"
            label={ar ? 'تأكيد كلمة المرور' : 'Confirm password'}
            type="password"
            required
            minLength={12}
            maxLength={128}
          />
          <p className="admin-muted">
            {ar
              ? '١٢ حرفاً على الأقل. سينتهي الوصول من الجلسات السابقة.'
              : 'At least 12 characters. Existing sessions will be signed out.'}
          </p>
          <footer>
            <button type="button" className="admin-button" onClick={onClose}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="admin-button admin-button-primary" disabled={saving}>
              {saving
                ? ar
                  ? 'جارٍ الحفظ…'
                  : 'Saving…'
                : ar
                  ? 'تعيين كلمة المرور'
                  : 'Set password'}
            </button>
          </footer>
        </form>
      )}
    </Dialog>
  );
}
function LeadsManager({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const [status, setStatus] = useState(''),
    [selected, setSelected] = useState<Lead | 'new' | null>(null);
  const list = useRows<Lead>('/leads', locale, { status });
  useEffect(() => list.setPage(1), [status]);
  return (
    <section className="admin-module">
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">
            {ar ? 'من الاستفسار إلى الخطوة التالية' : 'FROM ENQUIRY TO NEXT STEP'}
          </p>
          <h2>{ar ? 'طلبات العملاء' : 'Customer enquiries'}</h2>
          <p>
            {ar
              ? 'تابع الطلبات وحدد المسؤول والحالة والملاحظات الداخلية.'
              : 'Follow enquiries, assign a person, and keep the next step clear.'}
          </p>
        </div>
        <button className="admin-button admin-button-primary" onClick={() => setSelected('new')}>
          <Plus size={16} />
          {ar ? 'إضافة طلب' : 'Add enquiry'}
        </button>
      </div>
      <div className="admin-card">
        <label className="admin-field">
          <span>{ar ? 'الحالة' : 'Status'}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{ar ? 'كل الحالات' : 'All statuses'}</option>
            {['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'].map((s) => (
              <option key={s} value={s}>
                {words(s)}
              </option>
            ))}
          </select>
        </label>
        <Status
          loading={list.loading}
          error={list.error}
          empty={!list.rows.length}
          locale={locale}
        />
        {!list.loading && !!list.rows.length && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{ar ? 'العميل' : 'Customer'}</th>
                  <th>{ar ? 'الطلب' : 'Enquiry'}</th>
                  <th>{ar ? 'الحالة' : 'Status'}</th>
                  <th>{ar ? 'التاريخ' : 'Received'}</th>
                  <th>{ar ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <strong>{lead.name}</strong>
                      <small>{lead.email}</small>
                    </td>
                    <td>{words(lead.type)}</td>
                    <td>
                      <span
                        className={`admin-badge ${lead.status === 'NEW' ? 'admin-badge-green' : ''}`}
                      >
                        {words(lead.status)}
                      </span>
                    </td>
                    <td>{date(lead.createdAt, locale)}</td>
                    <td>
                      <button className="admin-button" onClick={() => setSelected(lead)}>
                        <Eye size={14} />
                        {ar ? 'فتح الطلب' : 'Open enquiry'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager list={list} locale={locale} />
      </div>
      {selected && (
        <LeadEditor
          lead={selected === 'new' ? null : selected}
          locale={locale}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            list.reload();
          }}
        />
      )}
    </section>
  );
}
function LeadEditor({
  lead,
  locale,
  onClose,
  onSaved,
}: {
  lead: Lead | null;
  locale: Locale;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ar = locale === 'ar';
  const [leadType, setLeadType] = useState('VALUATION');
  const propertyFilter = useFilter();
  const [properties, setProperties] = useState<
    { id: string; titleEn: string; titleAr: string; reference: string }[]
  >([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false),
    [propertiesError, setPropertiesError] = useState('');
  useEffect(() => {
    if (lead || !['ENQUIRY', 'VIEWING'].includes(leadType)) return;
    const controller = new AbortController();
    setPropertiesLoading(true);
    setPropertiesError('');
    const params = new URLSearchParams({
      limit: '30',
      ...(propertyFilter.value ? { q: propertyFilter.value } : {}),
    });
    void fetch(`/api/backend/v1/listings?${params}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Property lookup is unavailable');
        const result = await response.json();
        if (!controller.signal.aborted) setProperties(result.data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setPropertiesError(
            ar ? 'العقارات غير متاحة مؤقتاً.' : 'Properties are temporarily unavailable.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setPropertiesLoading(false);
      });
    return () => controller.abort();
  }, [lead, leadType, propertyFilter.value, ar]);

  const [options, setOptions] = useState<AdminOptions | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let stopped = false;
    void adminRequest<AdminOptions>('/admin/options')
      .then((r) => {
        if (!stopped) setOptions(r);
      })
      .catch((e) => {
        if (!stopped) setError(adminError(e, locale));
      });
    return () => {
      stopped = true;
    };
  }, [locale]);
  const [related, setRelated] = useState<{ label: string; title: string; href: string | null }[]>(
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    const references = [
      ...(lead?.listingId
        ? [
            {
              id: lead.listingId,
              resource: 'listings',
              publicRoute: 'properties',
              label: ar ? 'العقار المطلوب' : 'Requested property',
              name: 'title',
            },
          ]
        : []),
      ...(lead?.projectId
        ? [
            {
              id: lead.projectId,
              resource: 'projects',
              publicRoute: 'projects',
              label: ar ? 'المشروع المطلوب' : 'Requested project',
              name: 'name',
            },
          ]
        : []),
    ];
    void Promise.all(
      references.map(async (reference) => {
        try {
          const record = await adminRequest<Record<string, unknown>>(
            `/${reference.resource}/manage/${reference.id}`,
            { signal: controller.signal },
          );
          return {
            label: reference.label,
            title: localized(record, reference.name, locale),
            href:
              record.status === 'PUBLISHED'
                ? `/${locale}/${reference.publicRoute}/${encodeURIComponent(String(record.slug))}`
                : null,
          };
        } catch {
          return {
            label: reference.label,
            title: ar ? 'السجل غير متاح حالياً' : 'Record temporarily unavailable',
            href: null,
          };
        }
      }),
    ).then((rows) => {
      if (!controller.signal.aborted) setRelated(rows);
    });
    return () => controller.abort();
  }, [lead?.listingId, lead?.projectId, locale, ar]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = lead
      ? {
          status: form.get('status'),
          internalNotes: form.get('internalNotes'),
          assignedToId: form.get('assignedToId') || null,
        }
      : {
          name: form.get('name'),
          email: form.get('email'),
          phone: form.get('phone'),
          type: form.get('type'),
          message: form.get('message'),
          consent: form.get('consent') === 'on',
        };
    if (!lead) {
      if (['ENQUIRY', 'VIEWING'].includes(leadType)) payload.listingId = form.get('listingId');
      if (leadType === 'PROJECT') payload.projectId = form.get('projectId');
      if (leadType === 'VIEWING') {
        const preferred = new Date(`${String(form.get('preferredAt') || '')}+04:00`);
        if (!Number.isFinite(preferred.getTime())) {
          setError(ar ? 'اختر موعد معاينة صالحاً.' : 'Choose a valid viewing time.');
          return;
        }
        payload.preferredAt = preferred.toISOString();
      }
    }
    setSaving(true);
    setError('');
    try {
      await adminRequest(`/leads${lead ? `/${lead.id}` : ''}`, {
        method: lead ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (e) {
      setError(adminError(e, locale));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      title={lead ? (ar ? 'إدارة الطلب' : 'Manage enquiry') : ar ? 'إضافة طلب' : 'Add enquiry'}
      onClose={onClose}
    >
      <form onSubmit={save}>
        {error && (
          <p className="admin-alert" role="alert">
            {error}
          </p>
        )}
        {lead ? (
          <>
            <dl className="admin-detail-list">
              <div>
                <dt>{ar ? 'الاسم' : 'Name'}</dt>
                <dd>{lead.name}</dd>
              </div>
              <div>
                <dt>{ar ? 'البريد' : 'Email'}</dt>
                <dd>
                  <a href={`mailto:${lead.email}`}>{lead.email}</a>
                </dd>
              </div>
              <div>
                <dt>{ar ? 'الهاتف' : 'Phone'}</dt>
                <dd>
                  <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                </dd>
              </div>
              <div>
                <dt>{ar ? 'نوع الطلب' : 'Enquiry type'}</dt>
                <dd>{words(lead.type)}</dd>
              </div>
              {lead.preferredAt && (
                <div>
                  <dt>{ar ? 'موعد المعاينة المطلوب' : 'Requested viewing time'}</dt>
                  <dd>
                    {new Intl.DateTimeFormat(ar ? 'ar-AE' : 'en-AE', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Dubai',
                    }).format(new Date(lead.preferredAt))}{' '}
                    · GST (UTC+4)
                  </dd>
                </div>
              )}
              {related.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>
                    {item.href ? (
                      <a href={item.href} target="_blank" rel="noreferrer">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <blockquote className="admin-customer-message">{lead.message}</blockquote>
            <div className="admin-grid">
              <Field name="status" label={ar ? 'الحالة' : 'Status'}>
                <select id="op-status" name="status" defaultValue={lead.status}>
                  {['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'].map((s) => (
                    <option key={s} value={s}>
                      {words(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field name="assignedToId" label={ar ? 'المسؤول' : 'Assigned to'}>
                <select
                  id="op-assignedToId"
                  name="assignedToId"
                  defaultValue={lead.assignedToId ?? ''}
                  disabled={!options}
                >
                  <option value="">{ar ? 'غير معيّن' : 'Unassigned'}</option>
                  {options?.users
                    .filter((u) => u.isActive && ['ADMIN', 'AGENT'].includes(u.role ?? ''))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} · {u.email}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <Field name="internalNotes" label={ar ? 'ملاحظات داخلية' : 'Internal notes'}>
              <textarea
                id="op-internalNotes"
                name="internalNotes"
                rows={5}
                maxLength={5000}
                defaultValue={lead.internalNotes}
              />
            </Field>
          </>
        ) : (
          <>
            <div className="admin-grid">
              <Field
                name="name"
                label={ar ? 'الاسم' : 'Customer name'}
                required
                minLength={2}
                maxLength={160}
              />
              <Field
                name="email"
                label={ar ? 'البريد الإلكتروني' : 'Email'}
                type="email"
                required
                maxLength={254}
              />
              <Field
                name="phone"
                label={ar ? 'الهاتف مع رمز الدولة' : 'Phone with country code'}
                required
                maxLength={24}
              />
              <Field name="type" label={ar ? 'نوع الطلب' : 'Enquiry type'}>
                <select
                  id="op-type"
                  name="type"
                  value={leadType}
                  onChange={(event) => setLeadType(event.target.value)}
                >
                  {['ENQUIRY', 'VIEWING', 'VALUATION', 'MORTGAGE', 'PROJECT'].map((t) => (
                    <option key={t} value={t}>
                      {words(t)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {['ENQUIRY', 'VIEWING'].includes(leadType) && (
              <>
                <label className="admin-field">
                  <span>{ar ? 'البحث عن العقار' : 'Find a property'}</span>
                  <input
                    value={propertyFilter.input}
                    onChange={(event) => propertyFilter.setInput(event.target.value)}
                    maxLength={100}
                    placeholder={ar ? 'ابحث بالعنوان أو الموقع' : 'Search title or location'}
                  />
                </label>
                <Field name="listingId" label={ar ? 'العقار المطلوب' : 'Requested property'}>
                  <select id="op-listingId" name="listingId" required disabled={propertiesLoading}>
                    <option value="">
                      {propertiesLoading
                        ? ar
                          ? 'جارٍ تحميل العقارات…'
                          : 'Loading properties…'
                        : ar
                          ? 'اختر عقاراً منشوراً'
                          : 'Select a published property'}
                    </option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {localized(property, 'title', locale)} · {property.reference}
                      </option>
                    ))}
                  </select>
                </Field>
                {propertiesError && (
                  <p role="alert" className="admin-alert">
                    {propertiesError}
                  </p>
                )}
              </>
            )}
            {leadType === 'PROJECT' && (
              <Field name="projectId" label={ar ? 'المشروع المطلوب' : 'Requested project'}>
                <select id="op-projectId" name="projectId" required disabled={!options}>
                  <option value="">
                    {ar ? 'اختر مشروعاً منشوراً' : 'Select a published project'}
                  </option>
                  {options?.projects
                    .filter((project) => project.status === 'PUBLISHED')
                    .map((project) => (
                      <option key={project.id} value={project.id}>
                        {ar ? project.nameAr : project.nameEn}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {leadType === 'VIEWING' && (
              <Field
                name="preferredAt"
                label={
                  ar
                    ? 'وقت المعاينة · توقيت الإمارات (UTC+4)'
                    : 'Viewing time · Gulf Standard Time (UTC+4)'
                }
              >
                <input
                  id="op-preferredAt"
                  name="preferredAt"
                  type="datetime-local"
                  required
                  min={new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 16)}
                  max={new Date(Date.now() + 365 * 86400000 + 4 * 3600000)
                    .toISOString()
                    .slice(0, 16)}
                />
              </Field>
            )}
            <Field name="message" label={ar ? 'الرسالة' : 'Message'}>
              <textarea
                id="op-message"
                name="message"
                required
                minLength={10}
                maxLength={3000}
                rows={5}
              />
            </Field>
            <label className="admin-check">
              <input type="checkbox" name="consent" required />
              {ar
                ? 'أؤكد موافقة العميل على التواصل بشأن هذا الطلب.'
                : 'I confirm the customer agreed to be contacted about this enquiry.'}
            </label>
          </>
        )}
        <footer>
          <button type="button" className="admin-button" onClick={onClose}>
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            className="admin-button admin-button-primary"
            disabled={
              saving ||
              (!!lead && !options) ||
              (!lead && ['ENQUIRY', 'VIEWING'].includes(leadType) && propertiesLoading)
            }
          >
            <Save size={16} />
            {saving ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : ar ? 'حفظ الطلب' : 'Save enquiry'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
function ConversationsManager({ locale }: { locale: Locale }) {
  const ar = locale === 'ar',
    filter = useFilter();
  const [memberId, setMemberId] = useState(''),
    [members, setMembers] = useState<AdminOptions['teamMembers']>([]),
    [selected, setSelected] = useState<string | null>(null);
  const list = useRows<TeamInboxConversation>('/admin/conversations', locale, {
    q: filter.value,
    memberId,
  });
  useEffect(() => {
    void adminRequest<AdminOptions>('/admin/options')
      .then((r) => setMembers(r.teamMembers))
      .catch(() => undefined);
  }, []);
  useEffect(() => list.setPage(1), [filter.value, memberId]);
  return (
    <section className="admin-module">
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">
            {ar ? 'كل محادثة، في مكان واحد' : 'EVERY CONVERSATION, TOGETHER'}
          </p>
          <h2>{ar ? 'محادثات QA' : 'QA conversations'}</h2>
          <p>
            {ar
              ? 'اطّلع على المحادثات مع الفريق وردّ عليها من هنا.'
              : 'Read the team’s private conversations and respond from this workspace.'}
          </p>
        </div>
        <button className="admin-button" onClick={list.reload}>
          <RefreshCw size={15} />
          {ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>
      <div className="admin-card">
        <div className="admin-toolbar">
          <SearchBox filter={filter} locale={locale} />
          <label className="admin-field">
            <span>{ar ? 'عضو الفريق' : 'Team member'}</span>
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">{ar ? 'كل الفريق' : 'Everyone'}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName ?? m.email}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Status
          loading={list.loading}
          error={list.error}
          empty={!list.rows.length}
          locale={locale}
        />
        {!list.loading && !!list.rows.length && (
          <div className="admin-conversation-list">
            {list.rows.map((thread) => (
              <button
                className="admin-conversation-row"
                key={thread.id}
                onClick={() => setSelected(thread.id)}
              >
                <span className="admin-conversation-icon">
                  <MessageCircle size={18} />
                </span>
                <span>
                  <strong>{thread.name}</strong>
                  <small>
                    {thread.member.displayName} · {thread.email}
                  </small>
                  <span>{thread.lastMessage?.body}</span>
                </span>
                <time>{date(thread.updatedAt, locale)}</time>
                <span className="admin-badge">{thread.messageCount}</span>
              </button>
            ))}
          </div>
        )}
        <Pager list={list} locale={locale} />
      </div>
      {selected && (
        <ConversationEditor
          id={selected}
          locale={locale}
          onClose={() => {
            setSelected(null);
            list.reload();
          }}
        />
      )}
    </section>
  );
}
function ConversationEditor({
  id,
  locale,
  onClose,
}: {
  id: string;
  locale: Locale;
  onClose: () => void;
}) {
  const ar = locale === 'ar';
  const [thread, setThread] = useState<TeamConversation | null>(null),
    [messages, setMessages] = useState<TeamMessage[]>([]),
    [body, setBody] = useState(''),
    [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false),
    [error, setError] = useState(''),
    [olderLoading, setOlderLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    let busy = false;
    async function refresh() {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const data = await adminRequest<TeamConversation>(`/admin/conversations/${id}`, {
          signal: controller.signal,
        });
        if (generation.current !== current) return;
        setThread((previous) =>
          previous ? { ...data, hasMore: previous.hasMore, nextBefore: previous.nextBefore } : data,
        );
        setMessages((previous) => mergeMessages(previous, data.messages));
        setError('');
      } catch (e) {
        if (!controller.signal.aborted && generation.current === current)
          setError(adminError(e, locale));
      } finally {
        busy = false;
        if (generation.current === current) setLoading(false);
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 8000);
    const focus = () => void refresh();
    document.addEventListener('visibilitychange', focus);
    return () => {
      generation.current++;
      clearInterval(timer);
      controller.abort();
      document.removeEventListener('visibilitychange', focus);
    };
  }, [id, locale]);
  async function older() {
    if (!thread?.nextBefore || olderLoading) return;
    const current = generation.current;
    setOlderLoading(true);
    try {
      const data = await adminRequest<TeamConversation>(
        `/admin/conversations/${id}?before=${thread.nextBefore}`,
      );
      if (current !== generation.current) return;
      setMessages((previous) => mergeMessages(previous, data.messages));
      setThread((previous) =>
        previous ? { ...previous, hasMore: data.hasMore, nextBefore: data.nextBefore } : data,
      );
    } catch (e) {
      if (current === generation.current) setError(adminError(e, locale));
    } finally {
      if (current === generation.current) setOlderLoading(false);
    }
  }
  async function reply(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const result = await adminRequest<{ message: TeamMessage; updatedAt: string }>(
        `/admin/conversations/${id}/replies`,
        { method: 'POST', body: JSON.stringify({ body: body.trim() }) },
      );
      setMessages((previous) => mergeMessages(previous, [result.message]));
      setBody('');
    } catch (e) {
      setError(adminError(e, locale));
    } finally {
      setSending(false);
    }
  }
  return (
    <Dialog
      title={
        thread ? `${thread.name} · ${thread.member.displayName}` : ar ? 'المحادثة' : 'Conversation'
      }
      onClose={onClose}
    >
      {error && (
        <p className="admin-alert" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="admin-empty" aria-busy="true">
          {ar ? 'جارٍ تحميل المحادثة…' : 'Loading conversation…'}
        </div>
      ) : (
        thread && (
          <>
            <p className="admin-muted">{thread.email}</p>
            {thread.hasMore && (
              <button className="admin-button" disabled={olderLoading} onClick={() => void older()}>
                {olderLoading
                  ? ar
                    ? 'جارٍ التحميل…'
                    : 'Loading…'
                  : ar
                    ? 'رسائل أقدم'
                    : 'Earlier messages'}
              </button>
            )}
            <ol className="admin-message-list" aria-label={ar ? 'الرسائل' : 'Messages'}>
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={message.sender === 'STAFF' ? 'admin-message-staff' : ''}
                >
                  <span>{message.sender === 'STAFF' ? (ar ? 'الفريق' : 'Team') : thread.name}</span>
                  <p>{message.body}</p>
                  <time>{date(message.createdAt, locale)}</time>
                </li>
              ))}
            </ol>
            <form className="admin-reply-form" onSubmit={reply}>
              <label className="admin-field" htmlFor="admin-reply">
                <span>{ar ? 'الرد' : 'Reply'}</span>
                <textarea
                  id="admin-reply"
                  required
                  maxLength={3000}
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={ar ? 'اكتب ردّاً…' : 'Write a reply…'}
                />
              </label>
              <button
                className="admin-button admin-button-primary"
                disabled={sending || !body.trim()}
              >
                <Send size={16} />
                {sending ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : ar ? 'إرسال الرد' : 'Send reply'}
              </button>
            </form>
          </>
        )
      )}
    </Dialog>
  );
}
function mergeMessages(previous: TeamMessage[], incoming: TeamMessage[]) {
  return [...new Map([...previous, ...incoming].map((m) => [m.id, m])).values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
function AuditManager({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const list = useRows<Audit>('/admin/audit', locale);
  return (
    <section className="admin-module">
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">{ar ? 'وضوح في كل تغيير' : 'A CLEAR RECORD OF CHANGE'}</p>
          <h2>{ar ? 'سجل النشاط' : 'Activity log'}</h2>
          <p>
            {ar
              ? 'من غيّر ماذا ومتى. يُحفظ السجل تلقائياً.'
              : 'Who changed what, and when. Changes are recorded automatically.'}
          </p>
        </div>
        <button className="admin-button" onClick={list.reload}>
          <RefreshCw size={16} />
          {ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>
      <div className="admin-card">
        <Status
          loading={list.loading}
          error={list.error}
          empty={!list.rows.length}
          locale={locale}
        />
        {!list.loading && !!list.rows.length && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{ar ? 'النشاط' : 'Activity'}</th>
                  <th>{ar ? 'بواسطة' : 'By'}</th>
                  <th>{ar ? 'القسم' : 'Resource'}</th>
                  <th>{ar ? 'الوقت' : 'When'}</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{words(entry.action)}</strong>
                    </td>
                    <td>
                      {entry.actor
                        ? `${entry.actor.firstName} ${entry.actor.lastName}`
                        : ar
                          ? 'النظام'
                          : 'System'}
                    </td>
                    <td>{words(entry.entityType)}</td>
                    <td>{date(entry.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager list={list} locale={locale} />
      </div>
    </section>
  );
}
export default function AdminOperations({ section, locale }: { section: string; locale: Locale }) {
  if (section === 'team') return <TeamManager locale={locale} />;
  if (section === 'users') return <UsersManager locale={locale} />;
  if (section === 'leads') return <LeadsManager locale={locale} />;
  if (section === 'conversations') return <ConversationsManager locale={locale} />;
  return <AuditManager locale={locale} />;
}
