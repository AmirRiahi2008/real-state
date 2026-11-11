# UAE Real Estate API

بک‌اند پلتفرم املاک امارات با **NestJS 12، TypeScript، PostgreSQL 17، Prisma 7 و Redis 7**. این مخزن فعلاً API را پیاده‌سازی می‌کند؛ مرحله رابط کاربری Next.js جداگانه انجام می‌شود.

قابلیت‌ها: ثبت‌نام و احراز هویت، تأیید ایمیل و بازیابی رمز، آگهی فروش و اجاره، پروژه‌های off-plan، مناطق و امکانات و توسعه‌دهندگان، پروفایل عمومی مشاوران، مدیریت انتشار، درخواست بازدید و مشاوره، علاقه‌مندی و جستجوی ذخیره‌شده، محتوای EN/AR، آپلود تصویر و محاسبه اقساط و بازده اجاره.

## اجرای محلی

پیش‌نیازها: **Node.js 24** با حداقل نسخه `24.11.0`، **npm 11+** و Docker Desktop با Docker Compose v2. فایل `.nvmrc` نسخه اصلی Node را مشخص می‌کند.

```bash
git clone https://github.com/AmirRiahi2008/real-state.git
cd real-state
nvm install
nvm use
npm ci
npm run setup:local
npm run infra:up
npm run db:generate
npm run db:deploy
npm run dev
```

اگر از nvm استفاده نمی‌کنید، Node 24 را نصب و دو دستور مربوط به nvm را رد کنید. `setup:local` فایل `apps/api/.env` را با رمزهای تصادفی PostgreSQL، Redis و JWT می‌سازد؛ اگر فایل موجود باشد آن را حفظ می‌کند. `infra:up` سرویس‌های محلی را راه‌اندازی و آماده شدن دیتابیس و Redis را بررسی می‌کند. نخستین نصب ممکن است به‌دلیل دریافت imageها طول بکشد.

نشانی‌های محلی:

| سرویس                      | نشانی                                                  |
| -------------------------- | ------------------------------------------------------ |
| API                        | `http://localhost:4000/api/v1`                         |
| Swagger                    | [مستندات تعاملی](http://localhost:4000/api/docs)       |
| OpenAPI JSON               | [قرارداد API](http://localhost:4000/api/openapi.json)  |
| سلامت فرایند               | [Liveness](http://localhost:4000/api/v1/health/live)   |
| آمادگی دیتابیس و Redis     | [Readiness](http://localhost:4000/api/v1/health/ready) |
| ایمیل‌های آزمایشی          | [Mailpit](http://localhost:8025)                       |
| PostgreSQL از سیستم میزبان | `localhost:5433`                                       |
| Redis از سیستم میزبان      | `localhost:6380`                                       |

ایمیل‌های تأیید و بازیابی در Mailpit دیده می‌شوند. لینک آن‌ها به صفحات فرانت آینده می‌رود؛ تا زمان ساخت فرانت، مقدار `token` لینک را در Swagger به `POST /auth/email/verify` یا `POST /auth/password-reset/confirm` بدهید. ایمیل توسط outbox با فاصله چند ثانیه ارسال می‌شود.

برای ایجاد مدیر، مقادیر `ADMIN_EMAIL` و `ADMIN_PASSWORD` را در `apps/api/.env` وارد کنید، سپس اجرا کنید:

```bash
npm run admin:create
```

رمز مدیر باید ۱۶ تا ۱۲۸ کاراکتر، حداقل ۸ کاراکتر متمایز و فاقد کاراکتر کنترلی باشد؛ از رمز تصادفی یا عبارت عبور طولانی استفاده کنید. این حساب از ثبت‌نام عمومی ساخته نمی‌شود. اگر ایمیل از قبل حساب داشته باشد، CLI آن را تغییر نمی‌دهد. بعد از ساخت، مقدار `ADMIN_PASSWORD` را از فایل محیطی حذف کنید. ورود در ابزار HTTP به هدر `Origin: http://localhost:3000` نیاز دارد؛ نمونه‌ها در [راهنمای API](docs/api-guide.md) آمده‌اند.

بعد از نصب، فهرست‌ها خالی هستند؛ مدیر می‌تواند اطلاعات واقعی را از API بسازد. دستور seed فقط برای داده‌های نمایشی است، به فعال‌سازی صریح نیاز دارد و در production اجرا نمی‌شود:

```bash
SEED_DEMO=true npm run db:seed
```

این دستور منطقه، توسعه‌دهنده، مشاور، پروژه، آگهی، تصویر و محتوای ساختگی EN/AR می‌سازد؛ داده‌های موجود را بازنویسی نمی‌کند. حساب مشاور demo رمز ورود منتشرشده ندارد. داده نمایشی را تنها روی دیتابیس توسعه اجرا کنید.

## دستورهای روزمره

| دستور                                                          | کاربرد                                           |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `npm run dev`                                                  | اجرای API با watch                               |
| `npm run check`                                                | lint، typecheck، تست واحد و build                |
| `npm run test:e2e`                                             | تست یکپارچه با PostgreSQL، Redis و Mailpit واقعی |
| `npm run build` سپس `npm start`                                | build و اجرای خروجی کامپایل‌شده                  |
| `npm run db:migrate -w @real-estate/api -- --name your_change` | ساخت migration در توسعه                          |
| `npm run db:deploy`                                            | اعمال migrationهای موجود                         |
| `npm run openapi:export`                                       | خروجی گرفتن قرارداد API                          |
| `npm run infra:down`                                           | توقف سرویس‌های محلی با حفظ داده‌ها               |

تست e2e به کاربر PostgreSQL با مجوز `CREATEDB` نیاز دارد؛ کاربر محلی Compose آن را دارد. تست دیتابیس موقت خودش و پیشوند مستقل Redis می‌سازد؛ از دیتابیس عملیاتی برای اجرای تست استفاده نکنید.

## اجرای API داخل Docker

بعد از setup، راه‌اندازی زیرساخت و `db:deploy` بالا:

```bash
docker compose --env-file apps/api/.env --profile app up -d --build api
```

این حالت از تنظیمات توسعه و Mailpit استفاده می‌کند و API را روی پورت 4000 میزبان می‌آورد. اگر `npm run dev` روشن است، ابتدا آن را متوقف کنید. داده‌های PostgreSQL، Redis و تصاویر در volume باقی می‌مانند. دیتابیس در startup برنامه migration نمی‌شود.

برای ساخت image تولید:

```bash
docker build --target runtime -t uae-real-estate-api:local .
```

image نهایی با کاربر غیر root اجرا می‌شود و dev dependencyها را ندارد. تنظیمات production، migration جداگانه، نگهداری تصاویر و محدودیت‌های استقرار در [معماری](docs/architecture.md) و [امنیت](SECURITY.md) توضیح داده شده‌اند.

## مستندات

- [معماری و تصمیم‌های فنی](docs/architecture.md)
- [مسیرها، نمونه درخواست و اتصال فرانت](docs/api-guide.md)
- [قواعد و عملیات امنیتی](SECURITY.md)
- [متغیرهای محیطی](apps/api/.env.example)

برای مشکل اتصال، ابتدا Docker Desktop و خروجی `docker compose --env-file apps/api/.env ps` را بررسی کنید. اگر پورت‌های 5433 یا 6380 اشغال‌اند، پورت Compose و پورت متناظر در `DATABASE_URL` یا `REDIS_URL` را با هم در `.env` تغییر دهید. فایل `.env` و فایل‌های آپلودشده در Git ثبت نمی‌شوند.
