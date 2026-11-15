export type RecordSection =
  'listings' | 'projects' | 'articles' | 'areas' | 'developers' | 'amenities' | 'agents';
export type RecordValue = Record<string, unknown>;
export type Bilingual = readonly [string, string];
export interface RecordField {
  key: string;
  label: Bilingual;
  type?:
    | 'text'
    | 'textarea'
    | 'richtext'
    | 'number'
    | 'decimal'
    | 'date'
    | 'url'
    | 'email'
    | 'select'
    | 'boolean'
    | 'multi'
    | 'languages'
    | 'image';
  richKey?: string;
  required?: boolean;
  nullable?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  options?: readonly string[];
  relation?: 'areas' | 'developers' | 'agents' | 'users' | 'projects' | 'amenities';
  group: Bilingual;
  createOnly?: boolean;
  help?: Bilingual;
}
export interface RecordConfig {
  title: Bilingual;
  singular: Bilingual;
  description: Bilingual;
  list: string;
  write: string;
  detail?: string;
  fields: RecordField[];
  publication?: 'review' | 'direct';
  preview?: string;
  defaults: RecordValue;
}
export const propertyTypes = [
  'APARTMENT',
  'VILLA',
  'TOWNHOUSE',
  'PENTHOUSE',
  'DUPLEX',
  'STUDIO',
  'OFFICE',
  'RETAIL',
  'LAND',
  'WAREHOUSE',
] as const;
const basics: Bilingual = ['Identity & bilingual copy', 'الهوية والمحتوى باللغتين'];
const facts: Bilingual = ['Property details', 'تفاصيل العقار'];
const location: Bilingual = ['Location & relationships', 'الموقع والارتباطات'];
const publication: Bilingual = ['Visibility & contact', 'الظهور والتواصل'];
const f = (key: string, label: Bilingual, extra: Partial<RecordField> = {}): RecordField => ({
  key,
  label,
  group: basics,
  ...extra,
});
const slug = f('slug', ['URL slug', 'رابط الصفحة'], {
  required: true,
  minLength: 2,
  maxLength: 120,
  help: ['Lowercase words separated by hyphens.', 'كلمات إنجليزية صغيرة تفصلها شرطات.'],
});
const names = (base = 'name'): RecordField[] => [
  f(
    `${base}En`,
    base === 'title'
      ? ['English title', 'العنوان بالإنجليزية']
      : ['English name', 'الاسم بالإنجليزية'],
    {
      required: true,
      minLength: 2,
      maxLength: base === 'title' ? 200 : 160,
    },
  ),
  f(
    `${base}Ar`,
    base === 'title' ? ['Arabic title', 'العنوان بالعربية'] : ['Arabic name', 'الاسم بالعربية'],
    {
      required: true,
      minLength: 2,
      maxLength: base === 'title' ? 200 : 160,
    },
  ),
];
const descriptions = (required = false): RecordField[] => [
  f('descriptionEn', ['English description', 'الوصف بالإنجليزية'], {
    type: required ? 'richtext' : 'textarea',
    richKey: required ? 'descriptionRichEn' : undefined,
    required,
    minLength: required ? 20 : 0,
    maxLength: required ? 20000 : 15000,
  }),
  f('descriptionAr', ['Arabic description', 'الوصف بالعربية'], {
    type: required ? 'richtext' : 'textarea',
    richKey: required ? 'descriptionRichAr' : undefined,
    required,
    minLength: required ? 20 : 0,
    maxLength: required ? 20000 : 15000,
  }),
];
const coordinates: RecordField[] = [
  f('latitude', ['Latitude', 'خط العرض'], {
    group: location,
    type: 'decimal',
    nullable: true,
    min: -90,
    max: 90,
  }),
  f('longitude', ['Longitude', 'خط الطول'], {
    group: location,
    type: 'decimal',
    nullable: true,
    min: -180,
    max: 180,
  }),
];
const area = f('areaId', ['Area', 'المنطقة'], {
  group: location,
  type: 'select',
  relation: 'areas',
  required: true,
});
const amenities = f('amenityIds', ['Amenities', 'المرافق'], {
  group: facts,
  type: 'multi',
  relation: 'amenities',
});
export const recordConfigs: Record<RecordSection, RecordConfig> = {
  listings: {
    title: ['Properties', 'العقارات'],
    singular: ['property', 'عقار'],
    description: [
      'Manage inventory, pricing, imagery and publication.',
      'إدارة العقارات والأسعار والصور والنشر.',
    ],
    list: '/listings/manage/mine',
    write: '/listings/manage',
    detail: '/listings/manage',
    publication: 'review',
    preview: 'properties',
    defaults: {
      purpose: 'SALE',
      propertyType: 'APARTMENT',
      completion: 'READY',
      availability: 'AVAILABLE',
      furnishing: 'UNFURNISHED',
      bedrooms: 1,
      bathrooms: 1,
      parking: 0,
      priceOnRequest: false,
      isExclusive: false,
      media: [],
      amenityIds: [],
    },
    fields: [
      { ...slug, minLength: 3, maxLength: 160 },
      ...names('title').map((field) => ({ ...field, minLength: 3 })),
      ...descriptions(true),
      f('purpose', ['Purpose', 'الغرض'], {
        group: facts,
        type: 'select',
        options: ['SALE', 'RENT'],
        required: true,
      }),
      f('propertyType', ['Property type', 'نوع العقار'], {
        group: facts,
        type: 'select',
        options: propertyTypes,
        required: true,
      }),
      f('completion', ['Completion', 'حالة الإنجاز'], {
        group: facts,
        type: 'select',
        options: ['READY', 'OFF_PLAN'],
        required: true,
      }),
      f('availability', ['Availability', 'التوفر'], {
        group: facts,
        type: 'select',
        options: ['AVAILABLE', 'RESERVED', 'SOLD', 'RENTED'],
      }),
      f('furnishing', ['Furnishing', 'التأثيث'], {
        group: facts,
        type: 'select',
        options: ['UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED'],
      }),
      f('priceOnRequest', ['Price on request', 'السعر عند الطلب'], {
        group: facts,
        type: 'boolean',
      }),
      f('priceAed', ['Asking price · AED', 'السعر · درهم'], {
        group: facts,
        type: 'decimal',
        nullable: true,
        min: 0,
      }),
      f('previousPriceAed', ['Previous price · AED', 'السعر السابق · درهم'], {
        group: facts,
        type: 'decimal',
        nullable: true,
        min: 0,
      }),
      f('rentalPeriod', ['Rental period', 'فترة الإيجار'], {
        group: facts,
        type: 'select',
        nullable: true,
        options: ['YEAR', 'MONTH', 'WEEK', 'DAY'],
      }),
      f('areaSqm', ['Internal area · m²', 'المساحة الداخلية · م²'], {
        group: facts,
        type: 'decimal',
        required: true,
        min: 0.01,
      }),
      f('plotAreaSqm', ['Plot area · m²', 'مساحة الأرض · م²'], {
        group: facts,
        type: 'decimal',
        nullable: true,
        min: 0.01,
      }),
      ...['bedrooms', 'bathrooms', 'parking'].map((key, i) =>
        f(
          key,
          (
            [
              ['Bedrooms', 'غرف النوم'],
              ['Bathrooms', 'الحمامات'],
              ['Parking spaces', 'مواقف السيارات'],
            ] as const
          )[i],
          { group: facts, type: 'number', required: i < 2, min: 0, max: i === 2 ? 100 : 50 },
        ),
      ),
      f('isExclusive', ['Exclusive listing', 'عقار حصري'], { group: facts, type: 'boolean' }),
      amenities,
      f('addressEn', ['English address', 'العنوان بالإنجليزية'], {
        group: location,
        required: true,
        minLength: 3,
        maxLength: 300,
      }),
      f('addressAr', ['Arabic address', 'العنوان بالعربية'], {
        group: location,
        required: true,
        minLength: 3,
        maxLength: 300,
      }),
      area,
      f('agentId', ['Listing agent', 'المستشار المسؤول'], {
        group: location,
        type: 'select',
        relation: 'agents',
        required: true,
      }),
      f('projectId', ['Related project', 'المشروع المرتبط'], {
        group: location,
        type: 'select',
        relation: 'projects',
        nullable: true,
        help: [
          'Choose a published project in the same area.',
          'اختر مشروعاً منشوراً في المنطقة نفسها.',
        ],
      }),
      ...coordinates,
      f('vacantOn', ['Available from', 'متاح من'], { group: facts, type: 'date', nullable: true }),
      f('handoverDate', ['Handover date', 'تاريخ التسليم'], {
        group: facts,
        type: 'date',
        nullable: true,
      }),
      f('permitNumber', ['Permit number', 'رقم التصريح'], {
        group: publication,
        nullable: true,
        maxLength: 64,
      }),
      f('permitUrl', ['DLD permit URL', 'رابط تصريح دائرة الأراضي'], {
        group: publication,
        type: 'url',
        nullable: true,
        maxLength: 600,
        help: [
          'HTTPS link on trakheesi.dubailand.gov.ae.',
          'رابط HTTPS على trakheesi.dubailand.gov.ae.',
        ],
      }),
    ],
  },
  projects: {
    title: ['Projects', 'المشاريع'],
    singular: ['project', 'مشروع'],
    description: [
      'Off-plan launches, payment milestones and floor plans.',
      'المشاريع الجديدة وخطط الدفع والمخططات.',
    ],
    list: '/projects/manage',
    write: '/projects/manage',
    detail: '/projects/manage',
    publication: 'review',
    preview: 'projects',
    defaults: {
      priceOnRequest: false,
      minBedrooms: 0,
      maxBedrooms: 3,
      propertyTypes: ['APARTMENT'],
      paymentPlan: [],
      floorPlans: [],
      media: [],
      amenityIds: [],
    },
    fields: [
      { ...slug, minLength: 3, maxLength: 160 },
      ...names().map((field) => ({ ...field, minLength: 3, maxLength: 200 })),
      ...descriptions(true),
      f('startingPriceAed', ['Starting price · AED', 'السعر يبدأ من · درهم'], {
        group: facts,
        type: 'decimal',
        nullable: true,
        min: 0,
      }),
      f('priceOnRequest', ['Price on request', 'السعر عند الطلب'], {
        group: facts,
        type: 'boolean',
      }),
      f('handoverDate', ['Estimated handover', 'التسليم المتوقع'], {
        group: facts,
        type: 'date',
        nullable: true,
      }),
      f('minBedrooms', ['Minimum bedrooms', 'أقل عدد غرف نوم'], {
        group: facts,
        type: 'number',
        required: true,
        min: 0,
        max: 50,
      }),
      f('maxBedrooms', ['Maximum bedrooms', 'أكثر عدد غرف نوم'], {
        group: facts,
        type: 'number',
        required: true,
        min: 0,
        max: 50,
      }),
      f('propertyTypes', ['Property types', 'أنواع العقارات'], {
        group: facts,
        type: 'multi',
        options: propertyTypes,
        required: true,
      }),
      amenities,
      area,
      f('developerId', ['Developer', 'المطور'], {
        group: location,
        type: 'select',
        relation: 'developers',
        required: true,
      }),
      ...coordinates,
    ],
  },
  articles: {
    title: ['News, articles & guides', 'الأخبار والمقالات والأدلة'],
    singular: ['article', 'مقال'],
    description: [
      'Publish bilingual news, insights, area guides and services.',
      'نشر الأخبار والمقالات وأدلة المناطق والخدمات باللغتين.',
    ],
    list: '/content/manage',
    write: '/content/manage',
    detail: '/content/manage',
    publication: 'direct',
    preview: 'insights',
    defaults: { type: 'ARTICLE' },
    fields: [
      { ...slug, maxLength: 160 },
      f('type', ['Content type', 'نوع المحتوى'], {
        type: 'select',
        options: ['NEWS', 'ARTICLE', 'AREA_GUIDE', 'MARKET_REPORT', 'BUYER_GUIDE', 'SERVICE'],
        required: true,
      }),
      ...names('title'),
      f('excerptEn', ['English excerpt', 'المقدمة بالإنجليزية'], {
        type: 'textarea',
        required: true,
        minLength: 2,
        maxLength: 600,
      }),
      f('excerptAr', ['Arabic excerpt', 'المقدمة بالعربية'], {
        type: 'textarea',
        required: true,
        minLength: 2,
        maxLength: 600,
      }),
      f('bodyEn', ['English article', 'المقال بالإنجليزية'], {
        type: 'richtext',
        richKey: 'bodyRichEn',
        required: true,
        minLength: 10,
        maxLength: 100000,
        help: [
          'Format your story, add tables and choose imagery from the media library.',
          'نسّق المقال وأضف الجداول والصور من المكتبة.',
        ],
      }),
      f('bodyAr', ['Arabic article', 'المقال بالعربية'], {
        type: 'richtext',
        richKey: 'bodyRichAr',
        required: true,
        minLength: 10,
        maxLength: 100000,
      }),
      { ...area, required: false, nullable: true },
      f('coverMediaId', ['Cover image', 'صورة الغلاف'], { type: 'image', nullable: true }),
    ],
  },
  areas: {
    title: ['Areas', 'المناطق'],
    singular: ['area', 'منطقة'],
    description: [
      'Neighbourhoods, coordinates and regional information.',
      'الأحياء والإحداثيات ومعلومات المناطق.',
    ],
    list: '/admin/catalog/areas',
    write: '/areas/manage',
    defaults: { emirate: 'DUBAI', isActive: true },
    fields: [
      slug,
      ...names(),
      ...descriptions(),
      f('emirate', ['Emirate', 'الإمارة'], {
        group: location,
        type: 'select',
        required: true,
        options: [
          'DUBAI',
          'ABU_DHABI',
          'SHARJAH',
          'AJMAN',
          'RAS_AL_KHAIMAH',
          'FUJAIRAH',
          'UMM_AL_QUWAIN',
        ],
      }),
      ...coordinates,
      f('parentId', ['Parent area', 'المنطقة الرئيسية'], {
        group: location,
        type: 'select',
        relation: 'areas',
        nullable: true,
      }),
      f('isActive', ['Active area', 'منطقة مفعّلة'], {
        group: publication,
        type: 'boolean',
        help: [
          'Inactive areas and their linked inventory are hidden publicly.',
          'المناطق غير المفعّلة وعقاراتها لا تظهر للعامة.',
        ],
      }),
    ],
  },
  developers: {
    title: ['Developers', 'المطورون'],
    singular: ['developer', 'مطور'],
    description: ['Developer identities and project visibility.', 'هويات المطورين وظهور مشاريعهم.'],
    list: '/admin/catalog/developers',
    write: '/developers/manage',
    defaults: { isActive: true },
    fields: [
      slug,
      ...names(),
      ...descriptions(),
      f('website', ['Website', 'الموقع الإلكتروني'], {
        type: 'url',
        nullable: true,
        maxLength: 500,
      }),
      f('isActive', ['Active developer', 'مطور مفعّل'], { group: publication, type: 'boolean' }),
    ],
  },
  amenities: {
    title: ['Amenities', 'المرافق'],
    singular: ['amenity', 'مرفق'],
    description: [
      'Reusable features available across properties and projects.',
      'المزايا المشتركة للعقارات والمشاريع.',
    ],
    list: '/admin/catalog/amenities',
    write: '/amenities/manage',
    defaults: {},
    fields: [
      { ...slug, maxLength: 80, minLength: 2 },
      ...names().map((field) => ({ ...field, maxLength: 120, minLength: 2 })),
    ],
  },
  agents: {
    title: ['Agent profiles', 'ملفات المستشارين'],
    singular: ['agent profile', 'ملف مستشار'],
    description: [
      'Public agent identities, contact details and profile photos.',
      'هوية المستشار ووسائل التواصل والصورة العامة.',
    ],
    list: '/admin/catalog/agents',
    write: '/agents/manage',
    defaults: { languages: ['English'], isPublic: false },
    fields: [
      f('userId', ['Linked user account', 'حساب المستخدم المرتبط'], {
        type: 'select',
        relation: 'users',
        required: true,
        createOnly: true,
        help: [
          'Use an active, verified agent or administrator account.',
          'اختر حساب مستشار أو مسؤول مفعّلاً ومؤكداً.',
        ],
      }),
      slug,
      f('displayName', ['Display name', 'الاسم المعروض'], {
        required: true,
        minLength: 2,
        maxLength: 160,
      }),
      f('bioEn', ['English biography', 'نبذة بالإنجليزية'], { type: 'textarea', maxLength: 10000 }),
      f('bioAr', ['Arabic biography', 'نبذة بالعربية'], { type: 'textarea', maxLength: 10000 }),
      f('languages', ['Languages', 'اللغات'], {
        type: 'languages',
        required: true,
        help: [
          'Separate languages with commas, for example English, Arabic.',
          'افصل اللغات بفواصل، مثال English, Arabic.',
        ],
      }),
      f('publicEmail', ['Public email', 'البريد العام'], {
        group: publication,
        type: 'email',
        nullable: true,
        maxLength: 254,
      }),
      f('phone', ['Phone', 'الهاتف'], {
        group: publication,
        nullable: true,
        maxLength: 24,
        help: [
          'International format, for example +971501234567.',
          'الصيغة الدولية، مثال +971501234567.',
        ],
      }),
      f('whatsapp', ['WhatsApp', 'واتساب'], { group: publication, nullable: true, maxLength: 24 }),
      f('reraNumber', ['RERA registration', 'رقم التسجيل العقاري'], {
        group: publication,
        nullable: true,
        maxLength: 40,
      }),
      { ...area, required: false, nullable: true },
      f('photoMediaId', ['Profile photo', 'الصورة الشخصية'], { type: 'image', nullable: true }),
      f('isPublic', ['Public profile', 'ملف ظاهر للعامة'], { group: publication, type: 'boolean' }),
    ],
  },
};

export const isRecordSection = (value: string): value is RecordSection => value in recordConfigs;
export const recordObject = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
export const recordArray = (value: unknown): RecordValue[] =>
  Array.isArray(value) ? value.map(recordObject) : [];
export const recordText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);
export const labelFor = (value: Bilingual, locale: 'en' | 'ar') => value[locale === 'ar' ? 1 : 0];

const arabicEnums: Record<string, string> = {
  DRAFT: 'مسودة',
  IN_REVIEW: 'قيد المراجعة',
  PUBLISHED: 'منشور',
  ARCHIVED: 'مؤرشف',
  SALE: 'بيع',
  RENT: 'إيجار',
  READY: 'جاهز',
  OFF_PLAN: 'قيد الإنشاء',
  AVAILABLE: 'متاح',
  RESERVED: 'محجوز',
  SOLD: 'مباع',
  RENTED: 'مؤجر',
  FURNISHED: 'مفروش',
  SEMI_FURNISHED: 'نصف مفروش',
  UNFURNISHED: 'غير مفروش',
  APARTMENT: 'شقة',
  VILLA: 'فيلا',
  TOWNHOUSE: 'تاون هاوس',
  PENTHOUSE: 'بنتهاوس',
  DUPLEX: 'دوبلكس',
  STUDIO: 'استوديو',
  OFFICE: 'مكتب',
  RETAIL: 'محل',
  LAND: 'أرض',
  WAREHOUSE: 'مستودع',
  YEAR: 'سنة',
  MONTH: 'شهر',
  WEEK: 'أسبوع',
  DAY: 'يوم',
  DUBAI: 'دبي',
  ABU_DHABI: 'أبوظبي',
  SHARJAH: 'الشارقة',
  AJMAN: 'عجمان',
  RAS_AL_KHAIMAH: 'رأس الخيمة',
  FUJAIRAH: 'الفجيرة',
  UMM_AL_QUWAIN: 'أم القيوين',
  NEWS: 'خبر',
  ARTICLE: 'مقال',
  AREA_GUIDE: 'دليل منطقة',
  MARKET_REPORT: 'تقرير السوق',
  BUYER_GUIDE: 'دليل المشتري',
  SERVICE: 'خدمة',
};
export const enumLabel = (value: string, locale: 'en' | 'ar') =>
  locale === 'ar'
    ? (arabicEnums[value] ?? value)
    : value
        .toLowerCase()
        .split('_')
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(' ');

export function initialRecord(config: RecordConfig, row?: RecordValue): RecordValue {
  const result: RecordValue = { ...config.defaults };
  for (const field of config.fields) {
    const value = row?.[field.key];
    if (value !== undefined)
      result[field.key] = field.type === 'date' && value ? String(value).slice(0, 10) : value;
  }
  for (const field of config.fields) {
    if (field.richKey) result[field.richKey] = row?.[field.richKey] ?? null;
  }
  if (row) {
    result.id = row.id;
    result.version = row.version;
    result.status = row.status;
    result.amenityIds = recordArray(row.amenities).map((item) => recordText(item.amenityId));
    result.media = recordArray(row.media).map((item, position) => ({
      mediaId: recordText(item.mediaId),
      position,
      altEn: recordText(item.altEn),
      altAr: recordText(item.altAr),
    }));
    if ('paymentPlan' in row) result.paymentPlan = recordArray(row.paymentPlan);
    if ('floorPlans' in row) result.floorPlans = recordArray(row.floorPlans);
  }
  return result;
}

export function recordPayload(
  section: RecordSection,
  value: RecordValue,
  editing: boolean,
): RecordValue {
  const result: RecordValue = {};
  for (const field of recordConfigs[section].fields) {
    if (editing && field.createOnly) continue;
    const raw = value[field.key];
    if (field.type === 'boolean') result[field.key] = Boolean(raw);
    else if (field.type === 'multi') result[field.key] = Array.isArray(raw) ? raw : [];
    else if (field.type === 'number') {
      if (raw !== '' && raw !== undefined && raw !== null) result[field.key] = Number(raw);
    } else if (field.type === 'richtext' && field.richKey) {
      result[field.key] = recordText(raw).trim();
      result[field.richKey] = value[field.richKey] ?? null;
    } else if (field.type === 'languages')
      result[field.key] = Array.isArray(raw)
        ? raw
        : String(raw ?? '')
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
    else {
      const text = recordText(raw).trim();
      if (text) result[field.key] = text;
      else if (field.nullable) result[field.key] = null;
      else if (field.type === 'textarea') result[field.key] = '';
    }
  }
  if (section === 'listings' || section === 'projects')
    result.media = recordArray(value.media).map((item, position) => ({
      mediaId: item.mediaId,
      position,
      altEn: recordText(item.altEn).trim(),
      altAr: recordText(item.altAr).trim(),
    }));
  if (section === 'projects') {
    result.paymentPlan = recordArray(value.paymentPlan).map((item) => ({
      labelEn: recordText(item.labelEn).trim(),
      labelAr: recordText(item.labelAr).trim(),
      percentage: Number(item.percentage),
    }));
    result.floorPlans = recordArray(value.floorPlans).map((item) => ({
      nameEn: recordText(item.nameEn).trim(),
      nameAr: recordText(item.nameAr).trim(),
      bedrooms: Number(item.bedrooms),
      areaSqm: recordText(item.areaSqm).trim(),
    }));
  }
  if (editing && recordConfigs[section].publication) result.version = Number(value.version);
  return result;
}
