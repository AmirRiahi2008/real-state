import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  CompletionStatus,
  Emirate,
  Furnishing,
  ListingPurpose,
  PrismaClient,
  PropertyType,
  PublicationStatus,
  RentalPeriod,
  Role,
} from '@prisma/client';
import sharp from 'sharp';
import { PasswordService } from '../src/auth/password.service';
import { ScriptInputError } from '../src/scripts/script-database';

const id = (value: number) => `de100000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`;
const publishedAt = new Date('2026-02-01T09:00:00.000Z');
const areas = [
  {
    nameEn: 'Jumeirah',
    nameAr: 'جميرا',
    slug: 'oriva-demo-jumeirah',
    emirate: Emirate.DUBAI,
    latitude: '25.193000',
    longitude: '55.232000',
    descriptionEn:
      'Coastal living, quiet streets and room to slow down. This location groups fictional demonstration homes.',
    descriptionAr: 'حياة ساحلية وشوارع هادئة ومساحة للهدوء. تضم هذه المنطقة منازل افتراضية للعرض.',
  },
  {
    nameEn: 'Dubai Creek Harbour',
    nameAr: 'خور دبي',
    slug: 'oriva-demo-creek-harbour',
    emirate: Emirate.DUBAI,
    latitude: '25.203000',
    longitude: '55.344000',
    descriptionEn:
      'An urban waterfront setting for a new chapter. Homes and prices shown in this demo are fictional.',
    descriptionAr:
      'وجهة حضرية على الواجهة المائية لبداية جديدة. المنازل والأسعار المعروضة في هذا النموذج افتراضية.',
  },
  {
    nameEn: 'Yas Island',
    nameAr: 'جزيرة ياس',
    slug: 'oriva-demo-yas-island',
    emirate: Emirate.ABU_DHABI,
    latitude: '24.492000',
    longitude: '54.606000',
    descriptionEn:
      'A setting for family life, green spaces and everyday discovery. Demonstration inventory only.',
    descriptionAr:
      'مكان للحياة العائلية والمساحات الخضراء والاكتشاف اليومي. العقارات المعروضة تجريبية فقط.',
  },
];
const agents = [
  {
    firstName: 'Sara',
    lastName: 'Noor',
    displayName: 'Sara Noor',
    displayNameAr: 'سارة نور',
    area: 0,
  },
  {
    firstName: 'Adam',
    lastName: 'Nasser',
    displayName: 'Adam Nasser',
    displayNameAr: 'آدم ناصر',
    area: 1,
  },
  {
    firstName: 'Mariam',
    lastName: 'Amin',
    displayName: 'Mariam Amin',
    displayNameAr: 'مريم أمين',
    area: 2,
  },
];
const projects = [
  {
    nameEn: 'Sora Residences',
    nameAr: 'مساكن سورا',
    slug: 'sora-residences-demo',
    area: 1,
    price: '1850000.00',
    min: 1,
    max: 3,
    image: 1,
    types: [PropertyType.APARTMENT, PropertyType.PENTHOUSE],
    handover: '2029-06-30',
    detailEn:
      'Light-filled residences arranged around a planted courtyard, with generous terraces and a calm material palette.',
    detailAr: 'مساكن يغمرها الضوء حول فناء مزروع، مع شرفات واسعة وألوان ومواد هادئة.',
  },
  {
    nameEn: 'The Palm Atelier',
    nameAr: 'بالم أتيليه',
    slug: 'palm-atelier-demo',
    area: 0,
    price: '6900000.00',
    min: 3,
    max: 5,
    image: 0,
    types: [PropertyType.VILLA, PropertyType.TOWNHOUSE],
    handover: '2029-12-31',
    detailEn:
      'A small collection of courtyard homes where indoor rooms open onto private gardens and shaded outdoor spaces.',
    detailAr: 'مجموعة من منازل الأفنية تتصل غرفها الداخلية بحدائق خاصة ومساحات خارجية مظللة.',
  },
  {
    nameEn: 'Mira Garden Quarter',
    nameAr: 'حي ميرا جاردن',
    slug: 'mira-garden-quarter-demo',
    area: 2,
    price: '2350000.00',
    min: 2,
    max: 4,
    image: 3,
    types: [PropertyType.TOWNHOUSE, PropertyType.APARTMENT],
    handover: '2030-03-31',
    detailEn:
      'A walkable family neighbourhood with green courtyards, flexible layouts and shared places to gather.',
    detailAr: 'حي عائلي يسهل التنقل فيه سيراً، مع أفنية خضراء ومخططات مرنة وأماكن مشتركة للقاء.',
  },
];
const listings = [
  {
    titleEn: 'The Garden Terrace',
    titleAr: 'شرفة الحديقة',
    slug: 'garden-terrace-demo',
    type: PropertyType.APARTMENT,
    area: 1,
    beds: 2,
    baths: 3,
    sqm: '146.00',
    price: '2450000.00',
    image: 1,
    purpose: ListingPurpose.SALE,
    detailEn:
      'A generous living room flows onto a planted terrace. Natural materials, soft light and a flexible second bedroom make space for the way you live.',
    detailAr:
      'غرفة معيشة واسعة تنفتح على شرفة مزروعة. مواد طبيعية وضوء ناعم وغرفة ثانية مرنة تمنحك مساحة تناسب أسلوب حياتك.',
  },
  {
    titleEn: 'Palm Courtyard Villa',
    titleAr: 'فيلا بالم كورت يارد',
    slug: 'palm-courtyard-villa-demo',
    type: PropertyType.VILLA,
    area: 0,
    beds: 4,
    baths: 5,
    sqm: '428.00',
    price: '8900000.00',
    image: 0,
    purpose: ListingPurpose.SALE,
    detailEn:
      'An open-plan villa arranged around a private pool and shaded courtyard. Four bedrooms, a study and sheltered outdoor dining create a considered family home.',
    detailAr:
      'فيلا بمخطط مفتوح حول مسبح خاص وفناء مظلل. أربع غرف نوم ومكتب ومنطقة طعام خارجية محمية لتكوين منزل عائلي مدروس.',
  },
  {
    titleEn: 'Creekside Atelier',
    titleAr: 'كريك سايد أتيليه',
    slug: 'creekside-atelier-demo',
    type: PropertyType.APARTMENT,
    area: 1,
    beds: 1,
    baths: 2,
    sqm: '89.00',
    price: '145000.00',
    image: 2,
    purpose: ListingPurpose.RENT,
    detailEn:
      'A furnished one-bedroom home with a bright living space, integrated kitchen and private balcony. A quiet place to return to after a full day.',
    detailAr:
      'منزل مفروش بغرفة نوم واحدة ومساحة معيشة مشرقة ومطبخ متكامل وشرفة خاصة. مكان هادئ للعودة إليه بعد يوم حافل.',
  },
  {
    titleEn: 'The Horizon Penthouse',
    titleAr: 'بنتهاوس الأفق',
    slug: 'horizon-penthouse-demo',
    type: PropertyType.PENTHOUSE,
    area: 1,
    beds: 3,
    baths: 4,
    sqm: '312.00',
    price: '7650000.00',
    image: 5,
    purpose: ListingPurpose.SALE,
    detailEn:
      'A three-bedroom penthouse with open living spaces, a wraparound terrace and separate guest accommodation. Designed around long views and everyday comfort.',
    detailAr:
      'بنتهاوس بثلاث غرف نوم ومساحات معيشة مفتوحة وشرفة محيطة وإقامة منفصلة للضيوف. تصميم يركز على الإطلالات الواسعة والراحة اليومية.',
  },
  {
    titleEn: 'Mira Family Townhouse',
    titleAr: 'تاون هاوس ميرا العائلي',
    slug: 'mira-family-townhouse-demo',
    type: PropertyType.TOWNHOUSE,
    area: 2,
    beds: 3,
    baths: 4,
    sqm: '238.00',
    price: '3150000.00',
    image: 3,
    purpose: ListingPurpose.SALE,
    detailEn:
      'A family townhouse with three bedrooms, a flexible study and a private garden. The kitchen and living room open onto an easy outdoor entertaining space.',
    detailAr:
      'تاون هاوس عائلي بثلاث غرف نوم ومكتب مرن وحديقة خاصة. ينفتح المطبخ وغرفة المعيشة على مساحة خارجية مناسبة لاستقبال الأصدقاء.',
  },
  {
    titleEn: 'The Sunlit Studio',
    titleAr: 'استوديو ضوء الشمس',
    slug: 'sunlit-studio-demo',
    type: PropertyType.STUDIO,
    area: 1,
    beds: 0,
    baths: 1,
    sqm: '48.00',
    price: '82000.00',
    image: 4,
    purpose: ListingPurpose.RENT,
    detailEn:
      'A compact furnished studio with distinct sleeping and living zones, fitted storage and natural light. A simple starting point for your next chapter.',
    detailAr:
      'استوديو مفروش بمساحات واضحة للنوم والمعيشة وتخزين مدمج وضوء طبيعي. بداية بسيطة لفصل جديد من حياتك.',
  },
  {
    titleEn: 'Sora Sky Residence',
    titleAr: 'مساكن سورا سكاي',
    slug: 'sora-sky-residence-demo',
    type: PropertyType.APARTMENT,
    area: 1,
    beds: 2,
    baths: 3,
    sqm: '132.00',
    price: '2180000.00',
    image: 6,
    purpose: ListingPurpose.SALE,
    project: 0,
    detailEn:
      'An off-plan two-bedroom residence with a wide balcony, separate utility space and an open-plan kitchen. Explore the illustrative construction payment plan.',
    detailAr:
      'شقة على الخارطة بغرفتي نوم وشرفة واسعة ومساحة خدمات منفصلة ومطبخ مفتوح. استكشف خطة سداد الإنشاء التوضيحية.',
  },
  {
    titleEn: 'The Quiet Courtyard',
    titleAr: 'الفناء الهادئ',
    slug: 'quiet-courtyard-demo',
    type: PropertyType.VILLA,
    area: 0,
    beds: 5,
    baths: 6,
    sqm: '512.00',
    price: '420000.00',
    image: 7,
    purpose: ListingPurpose.RENT,
    detailEn:
      'A spacious five-bedroom villa centred on a garden courtyard. Generous reception rooms and a separate study offer flexibility for work, guests and family life.',
    detailAr:
      'فيلا واسعة بخمس غرف نوم تتمحور حول فناء حديقة. غرف استقبال رحبة ومكتب منفصل يمنحان مرونة للعمل والضيوف والحياة العائلية.',
  },
  {
    titleEn: 'Mira Park Apartment',
    titleAr: 'شقة ميرا بارك',
    slug: 'mira-park-apartment-demo',
    type: PropertyType.APARTMENT,
    area: 2,
    beds: 2,
    baths: 2,
    sqm: '118.00',
    price: '1850000.00',
    image: 2,
    purpose: ListingPurpose.SALE,
    detailEn:
      'A well-proportioned two-bedroom apartment with a green outlook, balcony and separate dining area. Thoughtful storage helps keep everyday spaces calm.',
    detailAr:
      'شقة متوازنة المساحات بغرفتي نوم وإطلالة خضراء وشرفة ومنطقة طعام منفصلة. تخزين مدروس يحافظ على هدوء المساحات اليومية.',
  },
  {
    titleEn: 'The Palm Pavilion',
    titleAr: 'بالم بافيليون',
    slug: 'palm-pavilion-demo',
    type: PropertyType.VILLA,
    area: 0,
    beds: 4,
    baths: 5,
    sqm: '386.00',
    price: '7200000.00',
    image: 0,
    purpose: ListingPurpose.SALE,
    project: 1,
    detailEn:
      'An off-plan courtyard villa with shaded terraces and a private pool. The four-bedroom layout balances shared spaces with quiet places to retreat.',
    detailAr:
      'فيلا فناء على الخارطة مع شرفات مظللة ومسبح خاص. يوازن مخطط الغرف الأربع بين المساحات المشتركة وأماكن الهدوء والخصوصية.',
  },
  {
    titleEn: 'Creek Harbour Loft',
    titleAr: 'لوفت خور دبي',
    slug: 'creek-harbour-loft-demo',
    type: PropertyType.DUPLEX,
    area: 1,
    beds: 2,
    baths: 3,
    sqm: '172.00',
    price: '215000.00',
    image: 5,
    purpose: ListingPurpose.RENT,
    detailEn:
      'A two-level furnished home with a double-height living room, open stair and mezzanine workspace. The balcony extends the living space outdoors.',
    detailAr:
      'منزل مفروش من مستويين بغرفة معيشة مزدوجة الارتفاع ودرج مفتوح ومساحة عمل في الميزانين. تمتد مساحة المعيشة إلى الخارج عبر الشرفة.',
  },
  {
    titleEn: 'Mira Garden House',
    titleAr: 'منزل ميرا جاردن',
    slug: 'mira-garden-house-demo',
    type: PropertyType.TOWNHOUSE,
    area: 2,
    beds: 3,
    baths: 4,
    sqm: '254.00',
    price: '2680000.00',
    image: 3,
    purpose: ListingPurpose.SALE,
    project: 2,
    detailEn:
      'An off-plan garden home with three bedrooms, a multipurpose family room and private outdoor space. View the sample staged payment plan before exploring the next step.',
    detailAr:
      'منزل حديقة على الخارطة بثلاث غرف نوم وغرفة عائلية متعددة الاستخدامات ومساحة خارجية خاصة. اطلع على خطة السداد المرحلية النموذجية قبل الخطوة التالية.',
  },
];

/** Create-only fixtures: re-running this never overwrites staff edits or account credentials. */
export async function seedCatalogue(prisma: PrismaClient, uploadDirectory: string): Promise<void> {
  const root = resolve(uploadDirectory);
  const assets = resolve(__dirname, '../demo-assets');
  await mkdir(root, { recursive: true, mode: 0o700 });
  const photos = await Promise.all(
    Array.from({ length: 8 }, async (_, n) => {
      const data = await readFile(join(assets, `property-${String(n + 1).padStart(2, '0')}.webp`));
      const metadata = await sharp(data, { limitInputPixels: 24000000 }).metadata();
      if (metadata.format !== 'webp' || !metadata.width || !metadata.height)
        throw new ScriptInputError('A demo photo asset is invalid.');
      return {
        data,
        width: metadata.width,
        height: metadata.height,
        key: `${id(601 + n)}.webp`,
        mediaId: id(601 + n),
      };
    }),
  );
  const passwordHash = await new PasswordService().hash(randomBytes(48).toString('base64url'));
  const createdFiles: string[] = [];
  try {
    await prisma.$transaction(
      async (db) => {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(86603)`;
        for (let n = 0; n < areas.length; n++)
          await db.area.upsert({
            where: { id: id(301 + n) },
            update: {},
            create: { id: id(301 + n), ...areas[n]!, isActive: true },
          });
        const developerId = id(1);
        await db.developer.upsert({
          where: { id: developerId },
          update: {},
          create: {
            id: developerId,
            slug: 'oriva-demo-collection',
            nameEn: 'ORIVA Collection',
            nameAr: 'مجموعة أوريفا',
            descriptionEn:
              'Fictional developer created for this interactive website demonstration.',
            descriptionAr: 'مطور افتراضي أنشئ لعرض هذا الموقع التفاعلي.',
            isActive: true,
          },
        });
        for (let n = 0; n < agents.length; n++) {
          const person = agents[n]!;
          const email = `oriva.demo.agent.${n + 1}@example.test`;
          const existing = await db.user.findUnique({
            where: { id: id(101 + n) },
            select: { email: true, role: true },
          });
          if (existing && (existing.email !== email || existing.role !== Role.AGENT))
            throw new ScriptInputError(
              'A reserved demo account was changed. No account was overwritten.',
            );
          await db.user.upsert({
            where: { id: id(101 + n) },
            update: {},
            create: {
              id: id(101 + n),
              email,
              passwordHash,
              firstName: person.firstName,
              lastName: person.lastName,
              role: Role.AGENT,
              isActive: true,
              emailVerifiedAt: publishedAt,
            },
          });
          await db.agentProfile.upsert({
            where: { id: id(201 + n) },
            update: {},
            create: {
              id: id(201 + n),
              userId: id(101 + n),
              slug: `oriva-demo-${person.firstName.toLowerCase()}`,
              displayName: person.displayName,
              bioEn:
                'Fictional property advisor for the interactive ORIVA demonstration. Use the enquiry form to test the website; this profile is not a real brokerage identity.',
              bioAr: `${person.displayNameAr} شخصية استشارية افتراضية لعرض أوريفا التفاعلي. استخدم نموذج الاستفسار لاختبار الموقع؛ لا يمثل هذا الملف وسيطاً حقيقياً.`,
              languages: ['English', 'Arabic'],
              isPublic: true,
              areaId: id(301 + person.area),
            },
          });
        }
        for (const photo of photos) {
          try {
            await writeFile(join(root, photo.key), photo.data, { flag: 'wx', mode: 0o600 });
            createdFiles.push(photo.key);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
            if (!(await readFile(join(root, photo.key))).equals(photo.data))
              throw new ScriptInputError(
                'A demo media path contains different data; no file was overwritten.',
              );
          }
          await db.media.upsert({
            where: { id: photo.mediaId },
            update: {},
            create: {
              id: photo.mediaId,
              ownerId: id(101),
              storageKey: photo.key,
              mimeType: 'image/webp',
              size: photo.data.length,
              width: photo.width,
              height: photo.height,
            },
          });
        }
        const amenityDefinitions = [
          ['pool', 'Swimming pool', 'مسبح'],
          ['gym', 'Fitness studio', 'استوديو لياقة'],
          ['garden', 'Landscaped gardens', 'حدائق منسقة'],
          ['parking', 'Covered parking', 'مواقف مغطاة'],
          ['balcony', 'Private terrace', 'شرفة خاصة'],
          ['concierge', 'Concierge', 'خدمة استقبال'],
        ];
        for (let n = 0; n < amenityDefinitions.length; n++) {
          const item = amenityDefinitions[n]!;
          await db.amenity.upsert({
            where: { id: id(701 + n) },
            update: {},
            create: {
              id: id(701 + n),
              slug: `oriva-demo-${item[0]}`,
              nameEn: item[1]!,
              nameAr: item[2]!,
            },
          });
        }
        for (let n = 0; n < projects.length; n++) {
          const project = projects[n]!;
          await db.project.upsert({
            where: { id: id(401 + n) },
            update: {},
            create: {
              id: id(401 + n),
              slug: project.slug,
              nameEn: project.nameEn,
              nameAr: project.nameAr,
              descriptionEn: `Fictional demo project with illustrative stock photography and sample prices. ${project.detailEn} No actual property offer or investment return is represented.`,
              descriptionAr: `مشروع تجريبي افتراضي بصور توضيحية وأسعار نموذجية. ${project.detailAr} لا يمثل عرضاً عقارياً حقيقياً أو عائداً استثمارياً.`,
              status: PublicationStatus.PUBLISHED,
              startingPriceAed: project.price,
              handoverDate: new Date(`${project.handover}T00:00:00.000Z`),
              minBedrooms: project.min,
              maxBedrooms: project.max,
              propertyTypes: project.types,
              paymentPlan: [
                { labelEn: 'On reservation', labelAr: 'عند الحجز', percentage: 10 },
                { labelEn: 'During construction', labelAr: 'أثناء الإنشاء', percentage: 50 },
                { labelEn: 'On handover', labelAr: 'عند التسليم', percentage: 40 },
              ],
              floorPlans: [
                {
                  nameEn: 'Garden residence',
                  nameAr: 'مسكن الحديقة',
                  bedrooms: project.min,
                  areaSqm: n === 1 ? '386.00' : '132.00',
                },
              ],
              latitude: areas[project.area]!.latitude,
              longitude: areas[project.area]!.longitude,
              developerId,
              areaId: id(301 + project.area),
              publishedAt,
              media: {
                create: [project.image, (project.image + 1) % 8].map((photo, position) => ({
                  mediaId: id(601 + photo),
                  position,
                  altEn: 'Illustrative stock photograph; fictional demonstration project',
                  altAr: 'صورة توضيحية لمشروع تجريبي افتراضي',
                })),
              },
              amenities: {
                create: [701, 702, 703, 704].map((value) => ({ amenityId: id(value) })),
              },
            },
          });
        }
        for (let n = 0; n < listings.length; n++) {
          const listing = listings[n]!;
          const project = 'project' in listing ? projects[listing.project!] : null;
          const rental = listing.purpose === ListingPurpose.RENT;
          await db.listing.upsert({
            where: { id: id(501 + n) },
            update: {},
            create: {
              id: id(501 + n),
              reference: `ORIVA-DEMO-${String(n + 1).padStart(4, '0')}`,
              slug: listing.slug,
              titleEn: listing.titleEn,
              titleAr: listing.titleAr,
              descriptionEn: `Fictional demo listing. The stock photographs are illustrative and do not depict an advertised UAE unit. ${listing.detailEn} All prices and availability are sample data.`,
              descriptionAr: `إعلان تجريبي افتراضي. الصور توضيحية ولا تمثل وحدة معلنة في الإمارات. ${listing.detailAr} جميع الأسعار وحالة التوفر بيانات نموذجية.`,
              purpose: listing.purpose,
              propertyType: listing.type,
              completion: project ? CompletionStatus.OFF_PLAN : CompletionStatus.READY,
              furnishing: rental ? Furnishing.FURNISHED : Furnishing.UNFURNISHED,
              status: PublicationStatus.PUBLISHED,
              priceAed: listing.price,
              rentalPeriod: rental ? RentalPeriod.YEAR : null,
              areaSqm: listing.sqm,
              plotAreaSqm:
                listing.type === PropertyType.VILLA ? `${Number(listing.sqm) * 1.8}` : null,
              bedrooms: listing.beds,
              bathrooms: listing.baths,
              parking: listing.beds >= 3 ? 2 : 1,
              addressEn: `${areas[listing.area]!.nameEn}, ${listing.area === 2 ? 'Abu Dhabi' : 'Dubai'} — demonstration only`,
              addressAr: `${areas[listing.area]!.nameAr}، ${listing.area === 2 ? 'أبوظبي' : 'دبي'} — للعرض فقط`,
              latitude: areas[listing.area]!.latitude,
              longitude: areas[listing.area]!.longitude,
              handoverDate: project ? new Date(`${project.handover}T00:00:00.000Z`) : null,
              isExclusive: n % 3 === 0,
              areaId: id(301 + listing.area),
              agentId: id(101 + listing.area),
              projectId: 'project' in listing ? id(401 + listing.project!) : null,
              publishedAt,
              media: {
                create: [listing.image, (listing.image + 2) % 8, (listing.image + 4) % 8].map(
                  (photo, position) => ({
                    mediaId: id(601 + photo),
                    position,
                    altEn: 'Illustrative stock photograph of a home; fictional demo listing',
                    altAr: 'صورة منزل توضيحية لإعلان تجريبي افتراضي',
                  }),
                ),
              },
              amenities: {
                create: [701, 703, 704, ...(n % 2 === 0 ? [702, 705] : [706])].map((value) => ({
                  amenityId: id(value),
                })),
              },
            },
          });
        }
      },
      { timeout: 60000 },
    );
  } catch (error) {
    await Promise.all(createdFiles.map((key) => unlink(join(root, key)).catch(() => undefined)));
    throw error;
  }
}
