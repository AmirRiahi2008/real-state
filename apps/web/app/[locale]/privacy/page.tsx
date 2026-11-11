import type { Locale } from '@/lib/api';
import Link from 'next/link';
export default async function Privacy({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const ar = locale === 'ar';
  return (
    <section className="container section legal-page page-shell">
      <p className="eyebrow">ORIVA</p>
      <h1>{ar ? 'الخصوصية في هذه التجربة' : 'Privacy in this experience'}</h1>
      <p>
        {ar
          ? 'هذا الموقع تجربة عرض لعقارات توضيحية. عند إرسال استفسار، نحفظ الاسم والبريد الإلكتروني ورقم الهاتف والرسالة وتفضيلات الزيارة التي تقدمها، مع موافقتك، لمتابعة طلبك.'
          : 'This website is a demonstration with illustrative property data. When you submit an enquiry, the name, email address, phone number, message and viewing preferences you provide are stored with your consent so the request can be followed up.'}
      </p>
      <h2>{ar ? 'ما نحفظه في متصفحك' : 'What your browser remembers'}</h2>
      <p>
        {ar
          ? 'يُحفظ تفضيل المظهر الفاتح أو الداكن في متصفحك. اللغة جزء من عنوان الصفحة. لا يتطلب تصفح العقارات إنشاء حساب.'
          : 'Your light or dark appearance preference is remembered in your browser. Language is part of the page address. Browsing the collection does not require an account.'}
      </p>
      <h2>{ar ? 'حول بيانات الاستفسار' : 'About enquiry information'}</h2>
      <p>
        {ar
          ? 'الاستفسارات ليست عامة، والوصول إليها مقيّد. لا ترسل وثائق هوية أو معلومات بنكية أو غيرها من البيانات الحساسة عبر نموذج الاستفسار. الموقع ليس قناة لإجراء المدفوعات أو إبرام العقود.'
          : 'Enquiries are not public and access is restricted. Please do not send identity documents, bank details or other sensitive information through the enquiry form. This website is not a channel for payments or contracts.'}
      </p>
      <Link className="button button-outline" href={`/${locale}/contact`}>
        {ar ? 'تواصل معنا' : 'Contact us'}
      </Link>
    </section>
  );
}
