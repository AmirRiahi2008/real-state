import { config as loadEnvironment } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  Availability,
  CompletionStatus,
  ContentType,
  Emirate,
  Furnishing,
  ListingPurpose,
  PrismaClient,
  PropertyType,
  PublicationStatus,
  Role,
} from '@prisma/client';
import sharp from 'sharp';
import { PasswordService } from '../src/auth/password.service';
import {
  createScriptDatabase,
  reportScriptFailure,
  ScriptInputError,
} from '../src/scripts/script-database';

// Stable UUIDs reserve an isolated demo fixture set without changing existing records.
export const demoIds = {
  area: 'de000000-0000-4000-8000-000000000001',
  developer: 'de000000-0000-4000-8000-000000000002',
  pool: 'de000000-0000-4000-8000-000000000003',
  gym: 'de000000-0000-4000-8000-000000000004',
  user: 'de000000-0000-4000-8000-000000000005',
  agent: 'de000000-0000-4000-8000-000000000006',
  media: 'de000000-0000-4000-8000-000000000007',
  project: 'de000000-0000-4000-8000-000000000008',
  listing: 'de000000-0000-4000-8000-000000000009',
  article: 'de000000-0000-4000-8000-000000000010',
  audit: 'de000000-0000-4000-8000-000000000011',
} as const;
const imageKey = 'de000000-0000-4000-8000-000000000007.webp';
const demoEmail = 'fictional.demo.agent@example.test';
const publishedAt = new Date('2026-01-01T00:00:00.000Z');

export function assertDemoSeedAllowed(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV === 'production')
    throw new ScriptInputError('Demo seed is disabled in production.');
  if (env.SEED_DEMO !== 'true')
    throw new ScriptInputError(
      'Demo data is opt-in. Set SEED_DEMO=true for this command in a development or test database.',
    );
}

async function ensureDemoImage(root: string, data: Buffer): Promise<boolean> {
  await mkdir(root, { recursive: true, mode: 0o700 });
  try {
    await writeFile(join(root, imageKey), data, { flag: 'wx', mode: 0o600 });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (!(await readFile(join(root, imageKey))).equals(data))
      throw new ScriptInputError(
        'The demo image path contains different data. No existing file was overwritten.',
      );
    return false;
  }
}

export async function seedDemo(prisma: PrismaClient, uploadDirectory: string): Promise<void> {
  // The random secret is discarded; demo agents do not have a known login password.
  const passwordHash = await new PasswordService().hash(randomBytes(48).toString('base64url'));
  const image = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#d8e5e3"/><rect y="580" width="1200" height="220" fill="#c9b994"/><rect x="150" y="230" width="330" height="410" fill="#edeee8"/><rect x="530" y="120" width="330" height="520" fill="#f7f4e9"/><path d="M185 290h260v40H185zm0 90h260v40H185zm0 90h260v40H185zm380-270h260v40H565zm0 90h260v40H565zm0 90h260v40H565zm0 90h260v40H565z" fill="#6e999e"/><text x="60" y="740" font-family="sans-serif" font-size="38" fill="#28434a">FICTIONAL DEMO PROPERTY</text></svg>',
    ),
  )
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const root = resolve(uploadDirectory);
  await prisma.$transaction(
    async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(86603)`;
      const existingUser = await db.user.findUnique({
        where: { id: demoIds.user },
        select: { email: true, role: true },
      });
      if (existingUser && (existingUser.email !== demoEmail || existingUser.role !== Role.AGENT))
        throw new ScriptInputError(
          'A reserved demo account was modified. No existing accounts were changed.',
        );
      const createdImage = await ensureDemoImage(root, image.data);
      try {
        const area = await db.area.upsert({
          where: { id: demoIds.area },
          update: {},
          create: {
            id: demoIds.area,
            slug: 'demo-pearl-quarter',
            nameEn: 'Pearl Quarter — Fictional Demo',
            nameAr: 'حي اللؤلؤ — نموذج افتراضي',
            emirate: Emirate.DUBAI,
            descriptionEn:
              'A fictional Dubai neighborhood supplied only for local product demonstrations. It is not a real development.',
            descriptionAr:
              'حي افتراضي في دبي مخصص لعرض المنتج محلياً فقط، ولا يمثل مشروعاً عقارياً حقيقياً.',
            latitude: '25.204849',
            longitude: '55.270783',
            isActive: true,
          },
        });
        const developer = await db.developer.upsert({
          where: { id: demoIds.developer },
          update: {},
          create: {
            id: demoIds.developer,
            slug: 'demo-pearl-developments',
            nameEn: 'Pearl Developments — Fictional Demo',
            nameAr: 'اللؤلؤ للتطوير — نموذج افتراضي',
            descriptionEn:
              'Fictional developer for software demonstrations; no commercial offering is made.',
            descriptionAr: 'مطور افتراضي لأغراض عرض البرنامج فقط، ولا يقدم أي عروض تجارية.',
            isActive: true,
          },
        });
        await db.amenity.upsert({
          where: { id: demoIds.pool },
          update: {},
          create: {
            id: demoIds.pool,
            slug: 'demo-swimming-pool',
            nameEn: 'Swimming pool',
            nameAr: 'مسبح',
          },
        });
        await db.amenity.upsert({
          where: { id: demoIds.gym },
          update: {},
          create: { id: demoIds.gym, slug: 'demo-gym', nameEn: 'Gym', nameAr: 'صالة رياضية' },
        });
        const agent = await db.user.upsert({
          where: { id: demoIds.user },
          update: {},
          create: {
            id: demoIds.user,
            email: demoEmail,
            passwordHash,
            firstName: 'Demo',
            lastName: 'Agent',
            role: Role.AGENT,
            isActive: true,
            emailVerifiedAt: publishedAt,
          },
        });
        const media = await db.media.upsert({
          where: { id: demoIds.media },
          update: {},
          create: {
            id: demoIds.media,
            ownerId: agent.id,
            storageKey: imageKey,
            mimeType: 'image/webp',
            size: image.info.size,
            width: image.info.width,
            height: image.info.height,
          },
        });
        await db.agentProfile.upsert({
          where: { id: demoIds.agent },
          update: {},
          create: {
            id: demoIds.agent,
            userId: agent.id,
            slug: 'fictional-demo-agent',
            displayName: 'Fictional Demo Agent',
            bioEn:
              'This fictional profile demonstrates the agent directory. Contact details are intentionally unavailable.',
            bioAr: 'ملف افتراضي لعرض دليل الوسطاء، ولا تتوفر له بيانات اتصال حقيقية.',
            languages: ['English', 'Arabic'],
            isPublic: true,
            areaId: area.id,
          },
        });
        const project = await db.project.upsert({
          where: { id: demoIds.project },
          update: {},
          create: {
            id: demoIds.project,
            slug: 'demo-pearl-residences',
            nameEn: 'Pearl Residences — Fictional Demo',
            nameAr: 'مساكن اللؤلؤ — نموذج افتراضي',
            descriptionEn:
              'A fictional off-plan apartment project for testing bilingual property search and payment-plan presentation. This is not an actual property offer.',
            descriptionAr:
              'مشروع شقق افتراضي على الخارطة لاختبار البحث باللغتين وعرض خطة السداد. لا يمثل عرضاً عقارياً حقيقياً.',
            status: PublicationStatus.PUBLISHED,
            startingPriceAed: '1500000.00',
            handoverDate: new Date('2030-12-31T00:00:00.000Z'),
            minBedrooms: 1,
            maxBedrooms: 3,
            propertyTypes: [PropertyType.APARTMENT],
            paymentPlan: [
              { labelEn: 'Booking', labelAr: 'الحجز', percentage: 10 },
              { labelEn: 'Construction', labelAr: 'أثناء الإنشاء', percentage: 50 },
              { labelEn: 'Handover', labelAr: 'التسليم', percentage: 40 },
            ],
            floorPlans: [
              {
                nameEn: 'Two-bedroom demonstration',
                nameAr: 'نموذج غرفتين',
                bedrooms: 2,
                areaSqm: '125.00',
              },
            ],
            latitude: '25.204849',
            longitude: '55.270783',
            developerId: developer.id,
            areaId: area.id,
            publishedAt,
            media: {
              create: {
                mediaId: media.id,
                position: 0,
                altEn: 'Synthetic demo building illustration',
                altAr: 'رسم توضيحي افتراضي لمبنى',
              },
            },
            amenities: { create: [{ amenityId: demoIds.pool }, { amenityId: demoIds.gym }] },
          },
        });
        await db.listing.upsert({
          where: { id: demoIds.listing },
          update: {},
          create: {
            id: demoIds.listing,
            reference: 'DEMO-UAE-0001',
            slug: 'demo-two-bedroom-pearl-apartment',
            titleEn: 'Two-bedroom apartment — Fictional Demo',
            titleAr: 'شقة بغرفتين — نموذج افتراضي',
            descriptionEn:
              'A fictional two-bedroom off-plan apartment used to demonstrate filters, map coordinates and bilingual details. The illustration is synthetic and this listing is not a real offer.',
            descriptionAr:
              'شقة افتراضية على الخارطة بغرفتين لعرض المرشحات وإحداثيات الخريطة والتفاصيل باللغتين. الصورة توضيحية مولدة ولا يمثل الإعلان عرضاً حقيقياً.',
            purpose: ListingPurpose.SALE,
            propertyType: PropertyType.APARTMENT,
            completion: CompletionStatus.OFF_PLAN,
            availability: Availability.AVAILABLE,
            furnishing: Furnishing.UNFURNISHED,
            status: PublicationStatus.PUBLISHED,
            priceAed: '1750000.00',
            previousPriceAed: '1850000.00',
            areaSqm: '125.00',
            bedrooms: 2,
            bathrooms: 3,
            parking: 1,
            addressEn: 'Fictional Pearl Quarter, Dubai — demonstration only',
            addressAr: 'حي اللؤلؤ الافتراضي، دبي — للعرض فقط',
            latitude: '25.204849',
            longitude: '55.270783',
            handoverDate: new Date('2030-12-31T00:00:00.000Z'),
            areaId: area.id,
            agentId: agent.id,
            projectId: project.id,
            publishedAt,
            media: {
              create: {
                mediaId: media.id,
                position: 0,
                altEn: 'Synthetic demo building illustration',
                altAr: 'رسم توضيحي افتراضي لمبنى',
              },
            },
            amenities: { create: [{ amenityId: demoIds.pool }, { amenityId: demoIds.gym }] },
          },
        });
        await db.article.upsert({
          where: { id: demoIds.article },
          update: {},
          create: {
            id: demoIds.article,
            slug: 'demo-exploring-pearl-quarter',
            type: ContentType.AREA_GUIDE,
            titleEn: 'Exploring fictional Pearl Quarter',
            titleAr: 'استكشاف حي اللؤلؤ الافتراضي',
            excerptEn: 'A fictional neighborhood guide demonstrating bilingual editorial content.',
            excerptAr: 'دليل حي افتراضي لعرض المحتوى التحريري باللغتين.',
            bodyEn:
              'This is demonstration content for a fictional neighborhood. Explore the sample listing, project payment plan, and agent directory. No property, investment advice, price claim, or real commercial offer is represented by this fixture.',
            bodyAr:
              'هذا محتوى تجريبي عن حي افتراضي. يمكنك استكشاف الإعلان النموذجي وخطة سداد المشروع ودليل الوسطاء. لا تمثل هذه البيانات عقاراً حقيقياً أو نصيحة استثمارية أو عرضاً تجارياً.',
            status: PublicationStatus.PUBLISHED,
            areaId: area.id,
            coverMediaId: media.id,
            publishedAt,
          },
        });
        await db.auditLog.upsert({
          where: { id: demoIds.audit },
          update: {},
          create: {
            id: demoIds.audit,
            action: 'demo.seed',
            entityType: 'DemoDataset',
            entityId: 'uae-local-demo-v1',
            metadata: { fictional: true, source: 'db:seed' },
          },
        });
      } catch (error) {
        if (createdImage) await unlink(join(root, imageKey));
        throw error;
      }
    },
    { timeout: 30000 },
  );
}

async function main(): Promise<void> {
  loadEnvironment({ quiet: true });
  assertDemoSeedAllowed(process.env);
  const prisma = createScriptDatabase(process.env.DATABASE_URL);
  try {
    await seedDemo(prisma, process.env.UPLOAD_DIR ?? 'uploads');
    console.log(
      'Created or retained fictional UAE demo fixtures. Demo accounts have no published login credentials.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (typeof require !== 'undefined' && require.main === module)
  void main().catch(reportScriptFailure);
