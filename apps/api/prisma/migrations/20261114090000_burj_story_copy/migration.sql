-- Refresh only untouched legacy story defaults; preserve every customized locale.
WITH replacements(key, previous, next) AS (
  VALUES
    ('story.0.label', '{"en":"THE FIRST SPARK","ar":"الشرارة الأولى"}', '{"en":"BURJ KHALIFA / A DUBAI STORY","ar":"برج خليفة / حكاية من دبي"}'),
    ('story.0.title1', '{"en":"A single idea.","ar":"فكرة واحدة."}', '{"en":"Burj Khalifa.","ar":"برج خليفة."}'),
    ('story.0.title2', '{"en":"A whole new world.","ar":"وعالمٌ جديد."}', '{"en":"Built by vision.","ar":"تُشيّده الرؤية."}'),
    ('story.0.description', '{"en":"Every place begins with a possibility. Stay with the story, from the first mark on the ground to the smallest finishing detail.","ar":"يبدأ كل مكان بإمكانٍ جديد. تابع الحكاية من أول علامة على الأرض إلى أصغر تفاصيلها الأخيرة."}', '{"en":"From a line in the sand to a landmark in the sky. Scroll through the foundations, the people and the extraordinary details that bring a tower to life.","ar":"من خطّ في الرمال إلى معلم في السماء. مرّر لاكتشاف الأساسات والأشخاص والتفاصيل التي تمنح هذا البرج الحياة."}'),
    ('story.1.label', '{"en":"01 / MEASURE & MARK","ar":"٠١ / القياس والتخطيط"}', '{"en":"01 / SURVEY & SET OUT","ar":"٠١ / المسح والتخطيط"}'),
    ('story.1.title1', '{"en":"Before the first lift.","ar":"قبل أول رفعة."}', '{"en":"First, a point.","ar":"أولاً، نقطة."}'),
    ('story.1.title2', '{"en":"Every line matters.","ar":"لكل خطّ أهميته."}', '{"en":"Then, a skyline.","ar":"ثم أفقٌ جديد."}'),
    ('story.1.description', '{"en":"Survey points, boundary strings and a carefully planned site. Precision starts long before the skyline changes.","ar":"نقاط مساحية وخيوط تحديد وموقع مدروس. تبدأ الدقة قبل أن يتغيّر الأفق."}', '{"en":"Surveyors establish the grid. Engineers check every coordinate. At ground level, a human-scale team prepares the first steps of an extraordinary climb.","ar":"يضع المسّاحون شبكة القياس ويراجع المهندسون الإحداثيات. على الأرض، يستعدّ الفريق البشري للخطوات الأولى من هذا الصعود الاستثنائي."}'),
    ('story.2.label', '{"en":"02 / BELOW THE SURFACE","ar":"٠٢ / تحت السطح"}', '{"en":"02 / EXCAVATION & PILING","ar":"٠٢ / الحفر والخوازيق"}'),
    ('story.2.title1', '{"en":"Room for roots.","ar":"مساحة للجذور."}', '{"en":"Below the city.","ar":"تحت المدينة."}'),
    ('story.2.title2', '{"en":"Space for the future.","ar":"ومكان للمستقبل."}', '{"en":"Beyond the ordinary.","ar":"وأبعد من المعتاد."}'),
    ('story.2.description', '{"en":"The excavation opens in measured steps. Temporary retaining walls hold the edges as the ground is prepared for the foundations.","ar":"يتّسع الحفر بخطوات متتابعة. تثبّت الجوانب مؤقتاً وتُجهّز الأرض لاستقبال الأساسات."}', '{"en":"The excavation opens, the rig turns and deep piles begin their work. Excavators and delivery vehicles move through separate working routes around the site.","ar":"يتّسع الحفر وتدور معدّات الخوازيق لتبدأ مهمّتها في الأعماق. تتحرّك الحفّارات وشاحنات التوريد عبر مسارات عمل منفصلة حول الموقع."}'),
    ('story.3.label', '{"en":"03 / REINFORCED BEGINNINGS","ar":"٠٣ / بداية متينة"}', '{"en":"03 / THE REINFORCED RAFT","ar":"٠٣ / اللبشة المسلحة"}'),
    ('story.3.title1', '{"en":"Steel. Concrete.","ar":"الحديد ثم الخرسانة."}', '{"en":"The unseen strength.","ar":"قوة لا تُرى."}'),
    ('story.3.title2', '{"en":"Strength within.","ar":"قوة من الداخل."}', '{"en":"Of everything above.","ar":"تحمل كلّ ما فوقها."}'),
    ('story.3.description', '{"en":"Footings find their positions. Reinforcement crosses and connects before concrete forms a continuous base beneath the building.","ar":"تأخذ القواعد مواضعها وتتصل قضبان التسليح قبل أن تصنع الخرسانة قاعدة متّصلة تحت المبنى."}', '{"en":"A dense reinforcement cage connects the foundation. Mixer trucks deliver concrete while the reinforced raft takes shape over the deep piles.","ar":"تصل شبكة كثيفة من التسليح أجزاء الأساس. تنقل خلاطات الخرسانة مواد البناء بينما تتشكّل اللبشة المسلحة فوق الخوازيق العميقة."}'),
    ('story.4.label', '{"en":"04 / THE FIRST STRUCTURE","ar":"٠٤ / الهيكل الأول"}', '{"en":"04 / THE BUTTRESSED CORE","ar":"٠٤ / النواة المدعّمة"}'),
    ('story.4.title1', '{"en":"From lines","ar":"من خطوط الأرض"}', '{"en":"Three wings.","ar":"ثلاثة أجنحة."}'),
    ('story.4.title2', '{"en":"to a rising frame.","ar":"إلى أبعاد حقيقية."}', '{"en":"One rising core.","ar":"ونواة ترتفع."}'),
    ('story.4.description', '{"en":"Columns and beams complete their cycle before the next slab is cast. Formwork and props support the work as it rises.","ar":"تكتمل الأعمدة والجسور قبل صبّ السقف التالي. تحمل القوالب والدعائم العمل أثناء ارتفاعه."}', '{"en":"Three wings support a central hexagonal core. The distinctive Y-shaped plan becomes visible as the concrete structure rises, one supported level at a time.","ar":"تدعم ثلاثة أجنحة نواة سداسية مركزية. يتّضح المخطط المميّز على شكل حرف Y مع ارتفاع الهيكل الخرساني، طابقاً مسنوداً بعد آخر."}'),
    ('story.5.label', '{"en":"05 / FLOOR BY FLOOR","ar":"٠٥ / طابق بعد طابق"}', '{"en":"05 / THE SPIRALLING SETBACKS","ar":"٠٥ / التراجعات الحلزونية"}'),
    ('story.5.title1', '{"en":"One level higher.","ar":"طابق أعلى."}', '{"en":"Level by level.","ar":"طابقاً بعد طابق."}'),
    ('story.5.title2', '{"en":"A little more possible.","ar":"وإمكانات أوسع."}', '{"en":"Skyward, together.","ar":"نحو السماء، معاً."}'),
    ('story.5.description', '{"en":"The trolley travels. A bundle lifts. Deck panels and temporary supports move up with the team, one considered level at a time.","ar":"تتحرّك عربة الرافعة وترتفع حمولة. تتقدّم ألواح القالب والدعائم مع الفريق، طابقاً مدروساً بعد آخر."}', '{"en":"The wings step back in a rising spiral. Climbing cranes, suspended loads and working platforms follow the structure upward, shaping the unmistakable silhouette.","ar":"تتراجع الأجنحة في تسلسل حلزوني صاعد. تتبع الرافعات المتسلّقة والحمولات المعلّقة ومنصّات العمل الهيكل، فترسم ملامح البرج المعروفة."}'),
    ('story.6.label', '{"en":"06 / THE HIDDEN NETWORK","ar":"٠٦ / الشبكة الداخلية"}', '{"en":"06 / A VERTICAL CITY","ar":"٠٦ / مدينة عمودية"}'),
    ('story.6.title1', '{"en":"Behind the walls,","ar":"خلف كل غرفة،"}', '{"en":"A vertical city.","ar":"مدينة ترتفع."}'),
    ('story.6.title2', '{"en":"life, connected.","ar":"عالم متّصل."}', '{"en":"Connected within.","ar":"مترابطة من الداخل."}'),
    ('story.6.description', '{"en":"Stairs link the floors. Service risers, ducts and pipework take their routes while the structure is still open to view.","ar":"تصل السلالم بين الطوابق وتأخذ مجاري الهواء والأنابيب والخدمات مساراتها بينما لا يزال الهيكل مكشوفاً."}', '{"en":"Behind the concrete, service risers and lift routes connect a city of spaces. The camera follows the working height as the next levels join the skyline.","ar":"خلف الخرسانة، تربط مسارات الخدمات والمصاعد مدينة من المساحات. تتبع الكاميرا مستوى العمل بينما تنضمّ الطوابق التالية إلى الأفق."}'),
    ('story.7.label', '{"en":"07 / THE ENVELOPE","ar":"٠٧ / الغلاف الخارجي"}', '{"en":"07 / THE CURTAIN WALL","ar":"٠٧ / الواجهة الزجاجية"}'),
    ('story.7.title1', '{"en":"A quieter world.","ar":"عالم أكثر هدوءاً."}', '{"en":"Silver. Glass.","ar":"فضّة وزجاج."}'),
    ('story.7.title2', '{"en":"Behind every pane.","ar":"خلف كل نافذة."}', '{"en":"A changing horizon.","ar":"وأفقٌ يتغيّر."}'),
    ('story.7.description', '{"en":"Frames, transoms and glazing settle into place, from the lower levels upward. The structure starts to become a collection of rooms.","ar":"تأخذ الإطارات والعوارض والزجاج أماكنها من الأسفل إلى الأعلى. يبدأ الهيكل بالتحوّل إلى غرف ومساحات."}', '{"en":"Reflective glazing follows the structure from below. Dense aluminium fins, horizontal floor bands and the terraces at each setback catch the changing light.","ar":"تصعد الواجهة الزجاجية العاكسة خلف الهيكل. تلتقط الزعانف المعدنية وخطوط الطوابق والشرفات عند كل تراجع تغيّر الضوء."}'),
    ('story.8.label', '{"en":"08 / CLOSELY CONSIDERED","ar":"٠٨ / تفاصيل مدروسة"}', '{"en":"08 / CROWN & SPIRE","ar":"٠٨ / التاج والقمة"}'),
    ('story.8.title1', '{"en":"The little things.","ar":"تفاصيل صغيرة."}', '{"en":"The final ascent.","ar":"الصعود الأخير."}'),
    ('story.8.title2', '{"en":"The lasting feeling.","ar":"وأثر يدوم."}', '{"en":"A needle in the sky.","ar":"إبرة في السماء."}'),
    ('story.8.description', '{"en":"Balcony edges return around the corners. Shading fins, door details and drainage lines give every elevation a more considered finish.","ar":"تلتفّ حواجز الشرفات حول زواياها. وتمنح كاسرات الشمس والأبواب وخطوط التصريف الواجهات اكتمالها."}', '{"en":"The upper steel crown narrows above the concrete wings. Its final sections lead to the slender spire, completing the tower’s remarkable taper.","ar":"يضيق التاج الفولاذي العلوي فوق الأجنحة الخرسانية. تقود قطاعاته الأخيرة إلى القمة الرفيعة لتكتمل استدقاقات البرج المميّزة."}'),
    ('story.9.label', '{"en":"09 / ROOF TO GARDEN","ar":"٠٩ / من السطح إلى الحديقة"}', '{"en":"09 / LANDSCAPE & WATER","ar":"٠٩ / الحدائق والمياه"}'),
    ('story.9.title1', '{"en":"Open to the sky.","ar":"منفتح على السماء."}', '{"en":"A tower, rooted.","ar":"برج له جذور."}'),
    ('story.9.title2', '{"en":"Grounded in life.","ar":"وقريب من الحياة."}', '{"en":"In a living city.","ar":"في مدينة حيّة."}'),
    ('story.9.description', '{"en":"Mounted solar panels, screened roof equipment and a planted courtyard. Paths, pool edges and a sheltered entrance complete the setting.","ar":"ألواح شمسية مثبتة وتجهيزات سطح محجوبة وفناء مزروع. تكتمل المسارات وحواف المسبح ومدخل مظلّل."}', '{"en":"Working routes give way to planted walks, palms and water. The construction site becomes a setting, with light and movement returning to the ground.","ar":"تفسح مسارات العمل المجال للممرّات المزروعة والنخيل والمياه. يتحوّل موقع البناء إلى مكان نابض بالضوء والحركة على الأرض."}'),
    ('story.10.label', '{"en":"10 / A PLACE COMES ALIVE","ar":"١٠ / مكان ينبض بالحياة"}', '{"en":"10 / THE COMPLETE SILHOUETTE","ar":"١٠ / الملامح المكتملة"}'),
    ('story.10.title1', '{"en":"Built with care.","ar":"بُني بعناية."}', '{"en":"828 metres.","ar":"٨٢٨ متراً."}'),
    ('story.10.title2', '{"en":"Ready for a story.","ar":"ليحمل حكاية."}', '{"en":"A new perspective.","ar":"ومنظور جديد."}'),
    ('story.10.description', '{"en":"Tools are parked. The entrance lights glow. Follow the handrails, the walkway and the small details that turn a structure into a place.","ar":"تستقر المعدات وتضيء أنوار المدخل. تأمّل الدرابزين والممرات والتفاصيل التي تحوّل البناء إلى مكان."}', '{"en":"From the triple-lobed base to the sculpted spire, the completed Burj Khalifa reveals its proportions. A Dubai landmark, assembled through your scroll.","ar":"من القاعدة ثلاثية الفصوص إلى القمة المنحوتة، يكشف برج خليفة المكتمل عن أبعاده. معلم من دبي اكتملت حكايته مع تمريرك."}'),
    ('story.11.label', '{"en":"11 / YOUR NEXT CHAPTER","ar":"١١ / فصلك التالي"}', '{"en":"11 / YOUR NEXT CHAPTER","ar":"١١ / فصلك القادم"}'),
    ('story.11.title1', '{"en":"A place to live.","ar":"مكان للحياة."}', '{"en":"Think beyond.","ar":"فكّر أبعد."}'),
    ('story.11.title2', '{"en":"A future to shape.","ar":"ومستقبل تصنعه."}', '{"en":"Find your place.","ar":"واعثر على مكانك."}'),
    ('story.11.description', '{"en":"From an idea to an entire world of detail. Explore a space to belong to, and a next chapter to make your own.","ar":"من فكرة إلى عالم كامل من التفاصيل. اكتشف مساحة تنتمي إليها وفصلاً جديداً تكتبه بطريقتك."}', '{"en":"Extraordinary architecture changes how we imagine living. Explore the UAE property collection and start a conversation about your own next chapter.","ar":"تغيّر العمارة الاستثنائية تصوّرنا للحياة. استكشف مجموعة عقارات الإمارات وابدأ حواراً عن فصلك القادم."}')
), patches AS (
  SELECT s.key AS record_key, jsonb_object_agg(r.key,
    jsonb_build_object(
      'en', CASE WHEN s.values->r.key->>'en' = r.previous::jsonb->>'en' THEN r.next::jsonb->>'en' ELSE COALESCE(s.values->r.key->>'en', r.next::jsonb->>'en') END,
      'ar', CASE WHEN s.values->r.key->>'ar' = r.previous::jsonb->>'ar' THEN r.next::jsonb->>'ar' ELSE COALESCE(s.values->r.key->>'ar', r.next::jsonb->>'ar') END
    )) AS patch
  FROM "SiteContent" s CROSS JOIN replacements r
  WHERE s.key = 'main' AND s.values ? r.key
    AND (s.values->r.key->>'en' = r.previous::jsonb->>'en' OR s.values->r.key->>'ar' = r.previous::jsonb->>'ar')
  GROUP BY s.key
)
UPDATE "SiteContent" s SET values = s.values || patches.patch, version = s.version + 1, "updatedAt" = CURRENT_TIMESTAMP
FROM patches WHERE s.key = patches.record_key;
