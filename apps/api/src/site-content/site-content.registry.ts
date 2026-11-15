export interface SiteContentField {
  key: string;
  section: string;
  label: string;
  maxLength: number;
  defaultValue: { en: string; ar: string };
}
export const siteContentFields: SiteContentField[] = [
  {
    key: 'story.0.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 1 · label',
    maxLength: 200,
    defaultValue: {
      en: 'BURJ KHALIFA / A DUBAI STORY',
      ar: 'برج خليفة / حكاية من دبي',
    },
  },
  {
    key: 'story.0.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 1 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: 'Burj Khalifa.',
      ar: 'برج خليفة.',
    },
  },
  {
    key: 'story.0.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 1 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'Built by vision.',
      ar: 'تُشيّده الرؤية.',
    },
  },
  {
    key: 'story.0.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 1 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'From a line in the sand to a landmark in the sky. Scroll through the foundations, the people and the extraordinary details that bring a tower to life.',
      ar: 'من خطّ في الرمال إلى معلم في السماء. مرّر لاكتشاف الأساسات والأشخاص والتفاصيل التي تمنح هذا البرج الحياة.',
    },
  },
  {
    key: 'story.1.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 2 · label',
    maxLength: 200,
    defaultValue: {
      en: '01 / SURVEY & SET OUT',
      ar: '٠١ / المسح والتخطيط',
    },
  },
  {
    key: 'story.1.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 2 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: 'First, a point.',
      ar: 'أولاً، نقطة.',
    },
  },
  {
    key: 'story.1.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 2 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'Then, a skyline.',
      ar: 'ثم أفقٌ جديد.',
    },
  },
  {
    key: 'story.1.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 2 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'Surveyors establish the grid. Engineers check every coordinate. At ground level, a human-scale team prepares the first steps of an extraordinary climb.',
      ar: 'يضع المسّاحون شبكة القياس ويراجع المهندسون الإحداثيات. على الأرض، يستعدّ الفريق البشري للخطوات الأولى من هذا الصعود الاستثنائي.',
    },
  },
  {
    key: 'story.2.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 3 · label',
    maxLength: 200,
    defaultValue: {
      en: '02 / EXCAVATION & PILING',
      ar: '٠٢ / الحفر والخوازيق',
    },
  },
  {
    key: 'story.2.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 3 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: 'Below the city.',
      ar: 'تحت المدينة.',
    },
  },
  {
    key: 'story.2.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 3 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'Beyond the ordinary.',
      ar: 'وأبعد من المعتاد.',
    },
  },
  {
    key: 'story.2.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 3 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'The excavation opens, the rig turns and deep piles begin their work. Excavators and delivery vehicles move through separate working routes around the site.',
      ar: 'يتّسع الحفر وتدور معدّات الخوازيق لتبدأ مهمّتها في الأعماق. تتحرّك الحفّارات وشاحنات التوريد عبر مسارات عمل منفصلة حول الموقع.',
    },
  },
  {
    key: 'story.3.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 4 · label',
    maxLength: 200,
    defaultValue: {
      en: '03 / THE REINFORCED RAFT',
      ar: '٠٣ / اللبشة المسلحة',
    },
  },
  {
    key: 'story.3.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 4 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: 'The unseen strength.',
      ar: 'قوة لا تُرى.',
    },
  },
  {
    key: 'story.3.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 4 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'Of everything above.',
      ar: 'تحمل كلّ ما فوقها.',
    },
  },
  {
    key: 'story.3.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 4 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'A dense reinforcement cage connects the foundation. Mixer trucks deliver concrete while the reinforced raft takes shape over the deep piles.',
      ar: 'تصل شبكة كثيفة من التسليح أجزاء الأساس. تنقل خلاطات الخرسانة مواد البناء بينما تتشكّل اللبشة المسلحة فوق الخوازيق العميقة.',
    },
  },
  {
    key: 'story.4.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 5 · label',
    maxLength: 200,
    defaultValue: {
      en: '04 / THE BUTTRESSED CORE',
      ar: '٠٤ / النواة المدعّمة',
    },
  },
  {
    key: 'story.4.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 5 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: 'Three wings.',
      ar: 'ثلاثة أجنحة.',
    },
  },
  {
    key: 'story.4.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 5 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'One rising core.',
      ar: 'ونواة ترتفع.',
    },
  },
  {
    key: 'story.4.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 5 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'Three wings support a central hexagonal core. The distinctive Y-shaped plan becomes visible as the concrete structure rises, one supported level at a time.',
      ar: 'تدعم ثلاثة أجنحة نواة سداسية مركزية. يتّضح المخطط المميّز على شكل حرف Y مع ارتفاع الهيكل الخرساني، طابقاً مسنوداً بعد آخر.',
    },
  },
  {
    key: 'story.5.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 6 · label',
    maxLength: 200,
    defaultValue: {
      en: '05 / THE SPIRALLING SETBACKS',
      ar: '٠٥ / التراجعات الحلزونية',
    },
  },
  {
    key: 'story.5.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 6 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: 'Level by level.',
      ar: 'طابقاً بعد طابق.',
    },
  },
  {
    key: 'story.5.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 6 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'Skyward, together.',
      ar: 'نحو السماء، معاً.',
    },
  },
  {
    key: 'story.5.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 6 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'The wings step back in a rising spiral. Climbing cranes, suspended loads and working platforms follow the structure upward, shaping the unmistakable silhouette.',
      ar: 'تتراجع الأجنحة في تسلسل حلزوني صاعد. تتبع الرافعات المتسلّقة والحمولات المعلّقة ومنصّات العمل الهيكل، فترسم ملامح البرج المعروفة.',
    },
  },
  {
    key: 'story.6.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 7 · label',
    maxLength: 200,
    defaultValue: {
      en: '06 / A VERTICAL CITY',
      ar: '٠٦ / مدينة عمودية',
    },
  },
  {
    key: 'story.6.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 7 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: 'A vertical city.',
      ar: 'مدينة ترتفع.',
    },
  },
  {
    key: 'story.6.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 7 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'Connected within.',
      ar: 'مترابطة من الداخل.',
    },
  },
  {
    key: 'story.6.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 7 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'Behind the concrete, service risers and lift routes connect a city of spaces. The camera follows the working height as the next levels join the skyline.',
      ar: 'خلف الخرسانة، تربط مسارات الخدمات والمصاعد مدينة من المساحات. تتبع الكاميرا مستوى العمل بينما تنضمّ الطوابق التالية إلى الأفق.',
    },
  },
  {
    key: 'story.7.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 8 · label',
    maxLength: 200,
    defaultValue: {
      en: '07 / THE CURTAIN WALL',
      ar: '٠٧ / الواجهة الزجاجية',
    },
  },
  {
    key: 'story.7.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 8 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: 'Silver. Glass.',
      ar: 'فضّة وزجاج.',
    },
  },
  {
    key: 'story.7.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 8 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'A changing horizon.',
      ar: 'وأفقٌ يتغيّر.',
    },
  },
  {
    key: 'story.7.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 8 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'Reflective glazing follows the structure from below. Dense aluminium fins, horizontal floor bands and the terraces at each setback catch the changing light.',
      ar: 'تصعد الواجهة الزجاجية العاكسة خلف الهيكل. تلتقط الزعانف المعدنية وخطوط الطوابق والشرفات عند كل تراجع تغيّر الضوء.',
    },
  },
  {
    key: 'story.8.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 9 · label',
    maxLength: 200,
    defaultValue: {
      en: '08 / CROWN & SPIRE',
      ar: '٠٨ / التاج والقمة',
    },
  },
  {
    key: 'story.8.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 9 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: 'The final ascent.',
      ar: 'الصعود الأخير.',
    },
  },
  {
    key: 'story.8.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 9 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'A needle in the sky.',
      ar: 'إبرة في السماء.',
    },
  },
  {
    key: 'story.8.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 9 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'The upper steel crown narrows above the concrete wings. Its final sections lead to the slender spire, completing the tower’s remarkable taper.',
      ar: 'يضيق التاج الفولاذي العلوي فوق الأجنحة الخرسانية. تقود قطاعاته الأخيرة إلى القمة الرفيعة لتكتمل استدقاقات البرج المميّزة.',
    },
  },
  {
    key: 'story.9.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 10 · label',
    maxLength: 200,
    defaultValue: {
      en: '09 / LANDSCAPE & WATER',
      ar: '٠٩ / الحدائق والمياه',
    },
  },
  {
    key: 'story.9.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 10 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: 'A tower, rooted.',
      ar: 'برج له جذور.',
    },
  },
  {
    key: 'story.9.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 10 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'In a living city.',
      ar: 'في مدينة حيّة.',
    },
  },
  {
    key: 'story.9.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 10 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'Working routes give way to planted walks, palms and water. The construction site becomes a setting, with light and movement returning to the ground.',
      ar: 'تفسح مسارات العمل المجال للممرّات المزروعة والنخيل والمياه. يتحوّل موقع البناء إلى مكان نابض بالضوء والحركة على الأرض.',
    },
  },
  {
    key: 'story.10.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 11 · label',
    maxLength: 200,
    defaultValue: {
      en: '10 / THE COMPLETE SILHOUETTE',
      ar: '١٠ / الملامح المكتملة',
    },
  },
  {
    key: 'story.10.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 11 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: '828 metres.',
      ar: '٨٢٨ متراً.',
    },
  },
  {
    key: 'story.10.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 11 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'A new perspective.',
      ar: 'ومنظور جديد.',
    },
  },
  {
    key: 'story.10.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 11 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'From the triple-lobed base to the sculpted spire, the completed Burj Khalifa reveals its proportions. A Dubai landmark, assembled through your scroll.',
      ar: 'من القاعدة ثلاثية الفصوص إلى القمة المنحوتة، يكشف برج خليفة المكتمل عن أبعاده. معلم من دبي اكتملت حكايته مع تمريرك.',
    },
  },
  {
    key: 'story.11.label',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 12 · label',
    maxLength: 200,
    defaultValue: {
      en: '11 / YOUR NEXT CHAPTER',
      ar: '١١ / فصلك القادم',
    },
  },
  {
    key: 'story.11.title1',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 12 · titleLine1',
    maxLength: 200,
    defaultValue: {
      en: 'Think beyond.',
      ar: 'فكّر أبعد.',
    },
  },
  {
    key: 'story.11.title2',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 12 · titleLine2',
    maxLength: 200,
    defaultValue: {
      en: 'Find your place.',
      ar: 'واعثر على مكانك.',
    },
  },
  {
    key: 'story.11.description',
    section: 'Burj Khalifa construction story',
    label: 'Chapter 12 · description',
    maxLength: 1500,
    defaultValue: {
      en: 'Extraordinary architecture changes how we imagine living. Explore the UAE property collection and start a conversation about your own next chapter.',
      ar: 'تغيّر العمارة الاستثنائية تصوّرنا للحياة. استكشف مجموعة عقارات الإمارات وابدأ حواراً عن فصلك القادم.',
    },
  },
  {
    key: 'site.name',
    section: 'Site',
    label: 'Brand name',
    maxLength: 80,
    defaultValue: {
      en: 'oriva',
      ar: 'أوريفا',
    },
  },
  {
    key: 'site.description',
    section: 'Site',
    label: 'Tagline',
    maxLength: 300,
    defaultValue: {
      en: 'A new perspective on UAE living.',
      ar: 'منظور جديد للحياة في الإمارات.',
    },
  },
  {
    key: 'site.navStory',
    section: 'Navigation',
    label: 'Our story',
    maxLength: 80,
    defaultValue: {
      en: 'Our story',
      ar: 'حكايتنا',
    },
  },
  {
    key: 'site.navProperties',
    section: 'Navigation',
    label: 'Properties',
    maxLength: 80,
    defaultValue: {
      en: 'Properties',
      ar: 'العقارات',
    },
  },
  {
    key: 'site.navProjects',
    section: 'Navigation',
    label: 'Developments',
    maxLength: 80,
    defaultValue: {
      en: 'New developments',
      ar: 'مشاريع جديدة',
    },
  },
  {
    key: 'site.navInvest',
    section: 'Navigation',
    label: 'Invest',
    maxLength: 80,
    defaultValue: {
      en: 'Invest',
      ar: 'استثمر',
    },
  },
  {
    key: 'site.navQa',
    section: 'Navigation',
    label: 'QA',
    maxLength: 80,
    defaultValue: {
      en: 'QA',
      ar: 'اسأل فريقنا',
    },
  },
  {
    key: 'site.contactCta',
    section: 'Navigation',
    label: 'Contact',
    maxLength: 80,
    defaultValue: {
      en: 'Let’s talk',
      ar: 'لنتحدث',
    },
  },
  {
    key: 'footer.eyebrow',
    section: 'Footer',
    label: 'Eyebrow',
    maxLength: 200,
    defaultValue: {
      en: 'ROOM FOR YOUR NEXT CHAPTER',
      ar: 'مساحة لبداية جديدة',
    },
  },
  {
    key: 'footer.title',
    section: 'Footer',
    label: 'Invitation',
    maxLength: 500,
    defaultValue: {
      en: 'The future starts\nwith a conversation.',
      ar: 'المستقبل يبدأ بمحادثة.',
    },
  },
  {
    key: 'footer.disclosure',
    section: 'Footer',
    label: 'Disclosure',
    maxLength: 500,
    defaultValue: {
      en: 'Demo experience · Illustrative properties & prices',
      ar: 'نسخة تجريبية · العقارات والأسعار توضيحية',
    },
  },
  {
    key: 'flag.eyebrow',
    section: 'Emirates flag',
    label: 'Eyebrow',
    maxLength: 200,
    defaultValue: {
      en: 'FROM HERE, WE SEE FURTHER',
      ar: 'من هنا، نرى أبعد',
    },
  },
  {
    key: 'flag.title1',
    section: 'Emirates flag',
    label: 'Heading line 1',
    maxLength: 200,
    defaultValue: {
      en: 'Seven emirates.',
      ar: 'سبع إمارات.',
    },
  },
  {
    key: 'flag.title2',
    section: 'Emirates flag',
    label: 'Heading line 2',
    maxLength: 200,
    defaultValue: {
      en: 'One shared horizon.',
      ar: 'وأفق يجمعنا.',
    },
  },
  {
    key: 'flag.description',
    section: 'Emirates flag',
    label: 'Description',
    maxLength: 1500,
    defaultValue: {
      en: 'A place where ambition becomes possibility, and people make their next chapter their own. The Emirates, in spirit and in outlook, inspire our perspective on living.',
      ar: 'مكانٌ تتحوّل فيه الطموحات إلى إمكانات، ويكتب الناس فيه فصولهم القادمة. الإمارات، بروحها وأفقها، تلهم منظورنا للحياة.',
    },
  },
  {
    key: 'flag.caption',
    section: 'Emirates flag',
    label: 'Caption',
    maxLength: 200,
    defaultValue: {
      en: 'ONE SPIRIT. ENDLESS POSSIBILITY.',
      ar: 'روح واحدة. إمكانات بلا حدود.',
    },
  },
  {
    key: 'qa.eyebrow',
    section: 'QA',
    label: 'Eyebrow',
    maxLength: 200,
    defaultValue: {
      en: 'THE PEOPLE BEHIND ORIVA',
      ar: 'الناس خلف أوريفا',
    },
  },
  {
    key: 'qa.title1',
    section: 'QA',
    label: 'Heading line 1',
    maxLength: 200,
    defaultValue: {
      en: 'Every question.',
      ar: 'كل سؤال.',
    },
  },
  {
    key: 'qa.title2',
    section: 'QA',
    label: 'Heading line 2',
    maxLength: 200,
    defaultValue: {
      en: 'A real person.',
      ar: 'يبدأ بإنسان.',
    },
  },
  {
    key: 'qa.description',
    section: 'QA',
    label: 'Description',
    maxLength: 1500,
    defaultValue: {
      en: 'Welcome to QA. Meet the team, choose who you would like to talk to, and start a private conversation with the person behind the name.',
      ar: 'مرحباً بك في QA. تعرّف إلى فريقنا، اختر من تودّ الحديث معه، وابدأ محادثة خاصة تصل مباشرةً إلى الشخص الذي اخترته.',
    },
  },
  {
    key: 'qa.directoryTitle',
    section: 'QA',
    label: 'Directory heading',
    maxLength: 200,
    defaultValue: {
      en: 'Let’s talk.',
      ar: 'لنتحدّث.',
    },
  },
  {
    key: 'contact.eyebrow',
    section: 'Contact',
    label: 'Eyebrow',
    maxLength: 200,
    defaultValue: {
      en: 'GREAT PLACES START WITH PEOPLE',
      ar: 'الأماكن العظيمة تبدأ بالناس',
    },
  },
  {
    key: 'contact.title1',
    section: 'Contact',
    label: 'Heading line 1',
    maxLength: 200,
    defaultValue: {
      en: 'Big plans?',
      ar: 'لديك فكرة؟',
    },
  },
  {
    key: 'contact.title2',
    section: 'Contact',
    label: 'Heading line 2',
    maxLength: 200,
    defaultValue: {
      en: 'Small question?',
      ar: 'لنتحدث عنها.',
    },
  },
  {
    key: 'contact.title3',
    section: 'Contact',
    label: 'Heading line 3',
    maxLength: 200,
    defaultValue: {
      en: 'We’re here.',
      ar: '',
    },
  },
  {
    key: 'contact.description',
    section: 'Contact',
    label: 'Description',
    maxLength: 1500,
    defaultValue: {
      en: 'Every next chapter starts with a conversation. Tell us a little about your plans, and we’ll help you explore what could come next.',
      ar: 'كل خطوة جديدة تبدأ بحديث. أخبرنا عن خططك وسنساعدك في استكشاف ما يمكن أن يأتي بعدها.',
    },
  },
  {
    key: 'home.featuredEyebrow',
    section: 'Home collection',
    label: 'Eyebrow',
    maxLength: 200,
    defaultValue: {
      en: 'A CONSIDERED COLLECTION',
      ar: 'مجموعة مختارة بعناية',
    },
  },
  {
    key: 'home.featuredTitle1',
    section: 'Home collection',
    label: 'Heading line 1',
    maxLength: 200,
    defaultValue: {
      en: 'More than an address.',
      ar: 'أكثر من عنوان.',
    },
  },
  {
    key: 'home.featuredTitle2',
    section: 'Home collection',
    label: 'Heading line 2',
    maxLength: 200,
    defaultValue: {
      en: 'A point of view.',
      ar: 'منظور للحياة.',
    },
  },
  {
    key: 'home.featuredDescription',
    section: 'Home collection',
    label: 'Description',
    maxLength: 1500,
    defaultValue: {
      en: 'Different spaces. Different ambitions. Find the place that feels like your next move.',
      ar: 'مساحات مختلفة لطموحات مختلفة. ابحث عن المكان الذي يشبه خطوتك القادمة.',
    },
  },
  {
    key: 'home.perspectiveEyebrow',
    section: 'Home perspective',
    label: 'Eyebrow',
    maxLength: 200,
    defaultValue: {
      en: 'A DIFFERENT WAY OF SEEING',
      ar: 'ما نراه، مختلف',
    },
  },
  {
    key: 'home.perspectiveTitle1',
    section: 'Home perspective',
    label: 'Heading line 1',
    maxLength: 200,
    defaultValue: {
      en: 'Real estate.',
      ar: 'عقارات.',
    },
  },
  {
    key: 'home.perspectiveTitle2',
    section: 'Home perspective',
    label: 'Heading line 2',
    maxLength: 200,
    defaultValue: {
      en: 'More human.',
      ar: 'بلمسة إنسانية.',
    },
  },
  {
    key: 'home.perspectiveDescription',
    section: 'Home perspective',
    label: 'Description',
    maxLength: 1500,
    defaultValue: {
      en: 'We look beyond the square metres. To the rhythm of a neighbourhood. The warmth of a material. The feeling you get when you walk through the door.',
      ar: 'نرى وراء الأمتار المربعة. في إيقاع الحي، ودفء المواد، والشعور الذي يستقبلك عند الدخول.',
    },
  },
  {
    key: 'home.projectsEyebrow',
    section: 'Home projects',
    label: 'Eyebrow',
    maxLength: 200,
    defaultValue: {
      en: 'NEXT ON THE HORIZON',
      ar: 'القادم إلى الأفق',
    },
  },
  {
    key: 'home.projectsTitle1',
    section: 'Home projects',
    label: 'Heading line 1',
    maxLength: 200,
    defaultValue: {
      en: 'Today’s vision.',
      ar: 'رؤية اليوم.',
    },
  },
  {
    key: 'home.projectsTitle2',
    section: 'Home projects',
    label: 'Heading line 2',
    maxLength: 200,
    defaultValue: {
      en: 'Tomorrow’s address.',
      ar: 'عنوان الغد.',
    },
  },
  {
    key: 'home.areasEyebrow',
    section: 'Home neighbourhoods',
    label: 'Eyebrow',
    maxLength: 200,
    defaultValue: {
      en: 'FIND YOUR RHYTHM',
      ar: 'ابحث عن إيقاعك',
    },
  },
  {
    key: 'home.areasTitle1',
    section: 'Home neighbourhoods',
    label: 'Heading line 1',
    maxLength: 200,
    defaultValue: {
      en: 'Not just where.',
      ar: 'ليس مجرد مكان.',
    },
  },
  {
    key: 'home.areasTitle2',
    section: 'Home neighbourhoods',
    label: 'Heading line 2',
    maxLength: 200,
    defaultValue: {
      en: 'How you live.',
      ar: 'طريقة للحياة.',
    },
  },
  {
    key: 'home.areasDescription',
    section: 'Home neighbourhoods',
    label: 'Description',
    maxLength: 1500,
    defaultValue: {
      en: 'Waterfront mornings. Garden-side quiet. The energy of a city. Where do you feel most like you?',
      ar: 'صباح على الواجهة المائية، أو هدوء حديقة، أو طاقة المدينة. أي إيقاع يشبهك؟',
    },
  },
  {
    key: 'home.investEyebrow',
    section: 'Home investment',
    label: 'Eyebrow',
    maxLength: 200,
    defaultValue: {
      en: 'A CLEARER VIEW OF YOUR FUTURE',
      ar: 'استثمر برؤية أوضح',
    },
  },
  {
    key: 'home.investTitle1',
    section: 'Home investment',
    label: 'Heading line 1',
    maxLength: 200,
    defaultValue: {
      en: 'Big dreams.',
      ar: 'أحلام كبيرة.',
    },
  },
  {
    key: 'home.investTitle2',
    section: 'Home investment',
    label: 'Heading line 2',
    maxLength: 200,
    defaultValue: {
      en: 'Clear thinking.',
      ar: 'تفكير مدروس.',
    },
  },
  {
    key: 'home.investDescription',
    section: 'Home investment',
    label: 'Description',
    maxLength: 1500,
    defaultValue: {
      en: 'Before the next move, see the bigger picture. Explore mortgage estimates, understand rental yield, and put your possibilities into perspective.',
      ar: 'قبل اتخاذ الخطوة، افهم الصورة. استكشف تقديرات التمويل وعائد الإيجار وحدد الأسئلة التي تستحق أن تطرحها.',
    },
  },
  {
    key: 'home.faqEyebrow',
    section: 'Home FAQ',
    label: 'Eyebrow',
    maxLength: 200,
    defaultValue: {
      en: 'LET’S MAKE THINGS CLEAR',
      ar: 'لنوضح الصورة',
    },
  },
  {
    key: 'home.faqTitle1',
    section: 'Home FAQ',
    label: 'Heading line 1',
    maxLength: 200,
    defaultValue: {
      en: 'Good questions.',
      ar: 'أسئلة جيدة.',
    },
  },
  {
    key: 'home.faqTitle2',
    section: 'Home FAQ',
    label: 'Heading line 2',
    maxLength: 200,
    defaultValue: {
      en: 'A clearer next step.',
      ar: 'خطوات أوضح.',
    },
  },
  {
    key: 'site.title',
    section: 'Site',
    label: 'Page title',
    maxLength: 200,
    defaultValue: {
      en: 'ORIVA — UAE Real Estate',
      ar: 'أوريفا — عقارات الإمارات',
    },
  },
  {
    key: 'footer.description',
    section: 'Footer',
    label: 'Description',
    maxLength: 300,
    defaultValue: {
      en: 'A new perspective on UAE living.',
      ar: 'منظور جديد للحياة في الإمارات.',
    },
  },
  {
    key: 'home.ctaEyebrow',
    section: 'Home closing',
    label: 'Eyebrow',
    maxLength: 200,
    defaultValue: {
      en: 'EVERY STORY NEEDS A STARTING POINT',
      ar: 'كل حكاية تحتاج إلى بداية',
    },
  },
  {
    key: 'home.ctaTitle1',
    section: 'Home closing',
    label: 'Heading line 1',
    maxLength: 200,
    defaultValue: {
      en: 'Let’s find your',
      ar: 'لنجد مكانك',
    },
  },
  {
    key: 'home.ctaTitle2',
    section: 'Home closing',
    label: 'Heading line 2',
    maxLength: 200,
    defaultValue: {
      en: 'place in the story.',
      ar: 'في الحكاية.',
    },
  },
  {
    key: 'faq.0.question',
    section: 'FAQ',
    label: 'Question 1 · question',
    maxLength: 300,
    defaultValue: {
      en: 'Where should I begin?',
      ar: 'من أين أبدأ؟',
    },
  },
  {
    key: 'faq.0.answer',
    section: 'FAQ',
    label: 'Question 1 · answer',
    maxLength: 3000,
    defaultValue: {
      en: 'Start with how you want to live: your preferred neighbourhood, the space you need, and a comfortable budget. Explore the collection using filters, open a home for its full details, and request a conversation or viewing when a place feels right.',
      ar: 'ابدأ بطريقة الحياة التي تريدها: الحي الذي تفضله والمساحة التي تحتاجها والميزانية المناسبة. استخدم المرشحات لاستكشاف المجموعة، واطّلع على التفاصيل ثم اطلب محادثة أو زيارة عندما تجد ما يناسبك.',
    },
  },
  {
    key: 'faq.1.question',
    section: 'FAQ',
    label: 'Question 2 · question',
    maxLength: 300,
    defaultValue: {
      en: 'Can I explore both buying and renting?',
      ar: 'هل يمكنني استكشاف الشراء والاستئجار؟',
    },
  },
  {
    key: 'faq.1.answer',
    section: 'FAQ',
    label: 'Question 2 · answer',
    maxLength: 3000,
    defaultValue: {
      en: 'Of course. Choose Buy or Rent in the property collection. You can narrow the results by property type, location, bedrooms and price. Rental prices show the rental period so you can compare like for like.',
      ar: 'بالتأكيد. اختر الشراء أو الاستئجار في مجموعة العقارات، ثم حدّد نوع العقار والموقع وعدد غرف النوم والسعر. تعرض العقارات الإيجارية فترة الإيجار لتكون المقارنة واضحة.',
    },
  },
  {
    key: 'faq.2.question',
    section: 'FAQ',
    label: 'Question 3 · question',
    maxLength: 300,
    defaultValue: {
      en: 'What should I look for in an off-plan home?',
      ar: 'ما الذي أبحث عنه في عقار قيد الإنشاء؟',
    },
  },
  {
    key: 'faq.2.answer',
    section: 'FAQ',
    label: 'Question 3 · answer',
    maxLength: 3000,
    defaultValue: {
      en: 'Consider the location, proposed layout, estimated handover, payment milestones and the developer. Project pages bring these details together. Schedules and plans should always be checked with the relevant parties before you make a commitment.',
      ar: 'ضع في الاعتبار الموقع والتوزيع المقترح وموعد التسليم التقديري ومراحل السداد والمطور. تجمع صفحات المشاريع هذه المعلومات، ويجب تأكيد المواعيد والخطط مع الجهات المعنية قبل أي التزام.',
    },
  },
  {
    key: 'faq.3.question',
    section: 'FAQ',
    label: 'Question 4 · question',
    maxLength: 300,
    defaultValue: {
      en: 'Are these live property offers?',
      ar: 'هل هذه عروض عقارية فعلية؟',
    },
  },
  {
    key: 'faq.3.answer',
    section: 'FAQ',
    label: 'Question 4 · answer',
    maxLength: 3000,
    defaultValue: {
      en: 'This is a demonstration collection. The properties, project names, availability and prices are illustrative; photography represents a style of living rather than a verified unit. The browsing experience and enquiry forms are connected and functional.',
      ar: 'هذه مجموعة تجريبية. العقارات وأسماء المشاريع والأسعار وحالة التوفر توضيحية، والصور تعبّر عن أسلوب حياة وليست لوحدة موثّقة. تجربة التصفح ونماذج الاستفسار متصلة وتعمل فعلياً.',
    },
  },
];
export const siteContentDefaults = Object.fromEntries(
  siteContentFields.map((field) => [field.key, field.defaultValue]),
);
