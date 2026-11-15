'use client';
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Plus, Minus } from 'lucide-react';
import type { Locale } from '@/lib/api';
import { useSiteText } from './site-content-provider';
const questions = [
  {
    en: [
      'Where should I begin?',
      'Start with how you want to live: your preferred neighbourhood, the space you need, and a comfortable budget. Explore the collection using filters, open a home for its full details, and request a conversation or viewing when a place feels right.',
    ],
    ar: [
      'من أين أبدأ؟',
      'ابدأ بطريقة الحياة التي تريدها: الحي الذي تفضله والمساحة التي تحتاجها والميزانية المناسبة. استخدم المرشحات لاستكشاف المجموعة، واطّلع على التفاصيل ثم اطلب محادثة أو زيارة عندما تجد ما يناسبك.',
    ],
  },
  {
    en: [
      'Can I explore both buying and renting?',
      'Of course. Choose Buy or Rent in the property collection. You can narrow the results by property type, location, bedrooms and price. Rental prices show the rental period so you can compare like for like.',
    ],
    ar: [
      'هل يمكنني استكشاف الشراء والاستئجار؟',
      'بالتأكيد. اختر الشراء أو الاستئجار في مجموعة العقارات، ثم حدّد نوع العقار والموقع وعدد غرف النوم والسعر. تعرض العقارات الإيجارية فترة الإيجار لتكون المقارنة واضحة.',
    ],
  },
  {
    en: [
      'What should I look for in an off-plan home?',
      'Consider the location, proposed layout, estimated handover, payment milestones and the developer. Project pages bring these details together. Schedules and plans should always be checked with the relevant parties before you make a commitment.',
    ],
    ar: [
      'ما الذي أبحث عنه في عقار قيد الإنشاء؟',
      'ضع في الاعتبار الموقع والتوزيع المقترح وموعد التسليم التقديري ومراحل السداد والمطور. تجمع صفحات المشاريع هذه المعلومات، ويجب تأكيد المواعيد والخطط مع الجهات المعنية قبل أي التزام.',
    ],
  },
  {
    en: [
      'Are these live property offers?',
      'This is a demonstration collection. The properties, project names, availability and prices are illustrative; photography represents a style of living rather than a verified unit. The browsing experience and enquiry forms are connected and functional.',
    ],
    ar: [
      'هل هذه عروض عقارية فعلية؟',
      'هذه مجموعة تجريبية. العقارات وأسماء المشاريع والأسعار وحالة التوفر توضيحية، والصور تعبّر عن أسلوب حياة وليست لوحدة موثّقة. تجربة التصفح ونماذج الاستفسار متصلة وتعمل فعلياً.',
    ],
  },
];
export default function Faq({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState<number | null>(0);
  const reduced = useReducedMotion();
  const text = useSiteText(locale);
  return (
    <div className="faq-list">
      {questions.map((question, index) => {
        const fallback = locale === 'ar' ? question.ar : question.en;
        const title = text(`faq.${index}.question`, fallback[0]),
          answer = text(`faq.${index}.answer`, fallback[1]);
        return (
          <div className={`faq-item${open === index ? ' faq-open' : ''}`} key={index}>
            <button
              id={`faq-question-${index}`}
              aria-expanded={open === index}
              aria-controls={`faq-answer-${index}`}
              onClick={() => setOpen(open === index ? null : index)}
            >
              <span className="faq-number">0{index + 1}</span>
              <span>{title}</span>
              {open === index ? <Minus size={20} /> : <Plus size={20} />}
            </button>
            <AnimatePresence initial={false}>
              {open === index && (
                <motion.div
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-question-${index}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.28 }}
                >
                  <p>{answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
