# واجهات خارجية مرشّحة للمشروع

- المصدر: `README.md` في مستودع [public-apis/public-apis](https://github.com/public-apis/public-apis)، جُلب في 2026-10-12.
- أعمدة «المصادقة/CORS» منقولة كما وردت في القائمة. أما «العربية» و«الاستخدام» فهي تقديرنا نحن.
- الجداول من 1 إلى 6 هي الترشيح الأصلي (2026-10-12)، والنتائج الفعلية في قسم «نتائج الفحص الفعلي» تحتها.
- CORS = «No» أو «Unknown» يعني أن الاستدعاء يتم من مسار خادم في `src/app/api/`، لا من المتصفح مباشرة.

## نتائج الفحص الفعلي (2026-10-17)

- **الأداة:** `GET /api/enrich/health` (`src/lib/external/health.ts`). تحتاج تسجيل دخول بأي دور.
- **مكان التشغيل:** Vercel Sandbox في المنطقة iad1، مع شبكة مفتوحة. بيئة التطوير السحابية الأصلية ما زالت تحجب هذه النطاقات.
- **النتيجة:** 13 من 16 تعمل بلا مفتاح.
- **معنى الأعمدة:**
  - «عربي» يعني أن الرد يحتوي نصًا عربيًا عند البحث بكلمة «تعليم».
  - «CORS» هي قيمة `Access-Control-Allow-Origin` في الرد.
- هذه نتيجة لحظة واحدة من خادم واحد. الحدود ومنع عناوين IP قد تختلف على Vercel Functions نفسها.

| الواجهة | النتيجة | HTTP | عربي | CORS | ملاحظة |
|---|---|---|---|---|---|
| Wikipedia (ar) | ✅ | 200 | نعم | لا* | **مدمجة** (`/api/enrich/wikipedia`) |
| Wiktionary (ar) | ✅ | 200 | نعم | لا* | جاهزة لمسرد المصطلحات (cr-ekm.3) |
| Wikidata (قراءة) | ✅ | 200 | نعم | لا* | القراءة لا تحتاج OAuth، وهذا يؤكد الافتراض السابق |
| Open Library | ✅ | 200 | نعم | `*` | **مدمجة** (`/api/enrich/books`)، لكن الكتب العربية فيها قليلة |
| Google Books (بلا مفتاح) | ❌ | 429 | — | — | الحصة اليومية المشتركة بلا مفتاح نفدت، فيلزم مفتاح API خاص بالمشروع |
| Archive.org | ✅ | 200 | نعم | `*` | |
| Gutendex | ❌ | 403 | — | — | يرفض عناوين خوادم Vercel حتى مع User-Agent متصفح |
| OpenAlex | ✅ | 200 | — | `*` | **مدمجة** (`/api/enrich/research`)، وتعطي نتائج عربية وإنجليزية |
| Semantic Scholar | ❌ | 429 | — | — | الحد المشترك بلا مفتاح. يلزم مفتاح أو الاكتفاء بـ OpenAlex |
| Crossref | ✅ | 200 | — | `*` | |
| LibreTranslate (العام) | ⚠️ | 200 | — | `*` | قائمة اللغات تتضمن العربية، لكن `/translate` يرد: «Visit portal.libretranslate.com to get an API key». الخادم العام يحتاج مفتاحًا، والبديل تشغيله ذاتيًا |
| CodeCogs | ✅ | 200 | — | `*` | يعيد SVG |
| Quran Cloud | ✅ | 200 | نعم | `*` | |
| Quran-api (jsDelivr) | ✅ | 200 | نعم | `*` | |
| Universities List | ✅ | 200 | — | `*` | يعمل عبر HTTP فقط، وفيه «Sultan Qaboos» |
| World Bank | ✅ | 200 | — | `*` | |

\* واجهة MediaWiki لا ترسل CORS إلا إذا أُضيف `origin=*` إلى الطلب. لا يهمنا هذا لأن الاستدعاء يتم من الخادم.

### ملاحظات من الاستخدام الفعلي

- **البحث بالعربية في OpenAlex** قد يخلط بين المعاني. مثلًا كلمة «الكسور» أعادت أيضًا أبحاثًا عن كسور الأسنان. لهذا صار مربع البحث قابلًا للتعديل، ويمكن كتابة كلمات إنجليزية فيه، فالبحث بـ `teaching fractions elementary` أعاد نتائج دقيقة.
- **مقالات ويكيبيديا** تُعرض بترخيص CC BY-SA، والواجهة تذكر المصدر تحت النتائج.
- الردود تُخزَّن في ذاكرة Next المؤقتة يومًا كاملًا (`next.revalidate = 86400`)، فلا يتكرر الطلب نفسه.

## 1. المعرفة والمصطلحات (ويكيبيديا وأخواتها)

| الواجهة | المصادقة | CORS | العربية | الاستخدام في المشروع |
|---|---|---|---|---|
| [Wikipedia (MediaWiki API)](https://www.mediawiki.org/wiki/API:Main_page) | لا | ؟ | نطاق `ar.wikipedia.org` | ملخص ورابط مرجعي لكل موضوع في الوحدة |
| [Wiktionary](https://en.wiktionary.org/w/api.php) | لا | نعم | نطاق `ar.wiktionary.org` | تعريفات لمسرد مصطلحات المنهج |
| [Wikidata](https://www.wikidata.org/w/api.php?action=help) | OAuth* | ؟ | تسميات متعددة اللغات | مسرد ثنائي اللغة (عربي/إنجليزي) للمصطلحات |

\* القائمة تذكر OAuth، والأرجح أنه للتعديل فقط وأن القراءة مفتوحة. هذا لم يُتحقق منه.

## 2. الكتب والمراجع

| الواجهة | المصادقة | CORS | العربية | الاستخدام |
|---|---|---|---|---|
| [Open Library](https://openlibrary.org/developers/api) | لا | لا | فيها كتب عربية، والتغطية غير معروفة | اقتراح كتب ومراجع لكل وحدة |
| [Google Books](https://developers.google.com/books/) | OAuth | ؟ | ؟ | بديل أوسع تغطية |
| [Archive.org](https://archive.readme.io/docs) | لا | لا | ؟ | مصادر مفتوحة ومواد قديمة |
| [Gutendex](https://gutendex.com/) | لا | ؟ | محدودة على الأرجح | أولوية منخفضة |

## 3. البحث التربوي (لمحلّل المناهج والمراجعين)

| الواجهة | المصادقة | CORS | الاستخدام |
|---|---|---|---|
| [OpenAlex](https://docs.openalex.org/) | لا | نعم | أبحاث تدعم قرارات التصميم (بلوم، المواءمة، إلخ) |
| [Semantic Scholar](https://api.semanticscholar.org/) | لا | ؟ | بديل/مكمّل |
| [Crossref](https://github.com/CrossRef/rest-api-doc) | لا | ؟ | بيانات DOI للاستشهاد |
| [Unpaywall](https://unpaywall.org/products/api) | لا | نعم | روابط النص الكامل المفتوح |

## 4. الترجمة

| الواجهة | المصادقة | CORS | ملاحظة |
|---|---|---|---|
| [LibreTranslate](https://libretranslate.com/docs) | لا (حسب القائمة) | ؟ | مفتوح المصدر ويمكن تشغيله ذاتيًا، مثل Ollama في المشروع. نعتقد أنه يدعم العربية، ونعتقد أن الخادم العام صار يطلب مفتاحًا. **الأمران يحتاجان تحقق.** |
| [Hirak Translation](https://translate.hirak.site/) | apiKey | ؟ | 21 لغة، ولا نعرف إن كانت العربية منها. لا علاقة له بهوية «حراك» رغم تشابه الاسم. |

ملاحظة: النموذج اللغوي الموجود في المشروع يترجم أصلًا. لذلك نحتاج واجهة ترجمة فقط إذا أردنا ترجمة حتمية، أو أرخص، أو تعمل بدون النموذج.

## 5. مزوّدات نماذج متوافقة مع `AI_BASE_URL`

`src/lib/ai.ts` يقبل أي خادم متوافق مع OpenAI. وهذه الخدمات مذكورة في القائمة بمستوى مجاني:

| الخدمة | المصادقة | ملاحظة |
|---|---|---|
| [Groq](https://console.groq.com/docs/quickstart) | apiKey | استدلال سريع لنماذج مفتوحة |
| [OpenRouter](https://openrouter.ai/docs/quick-start) | apiKey | واجهة واحدة لنماذج كثيرة، منها Qwen |
| [Together AI](https://docs.together.ai/docs/quickstart) | apiKey | نماذج مفتوحة منها Qwen وDeepSeek |
| [Hugging Face](https://huggingface.co) | apiKey | مركز النماذج |

التبديل يكون بضبط `AI_BASE_URL` و`AI_MODEL` و`AI_API_KEY` فقط، دون تغيير في الكود. لكن هذا افتراض مبني على أن هذه الخدمات تستخدم المسار `/chat/completions` نفسه.

## 6. أدوات خاصة بنوع المحتوى

| الواجهة | المصادقة | الاستخدام |
|---|---|---|
| [CodeCogs](https://editor.codecogs.com/docs/4-LaTeX_rendering.php) | لا | عرض معادلات LaTeX في مناهج الرياضيات والعلوم |
| [Sahifa](https://sahifa.dev/en/docs) | apiKey | تحويل HTML إلى PDF مع دعم العربية والكتابة من اليمين لليسار، لتصدير المنهج. البديل بلا خدمة خارجية: طباعة المتصفح. |
| [Quran Cloud](https://alquran.cloud/api) / [Quran-api](https://github.com/fawazahmed0/quran-api#readme) | لا | الآيات بنصها العربي لمناهج التربية الإسلامية |
| [Universities List](https://github.com/Hipo/university-domains-list) | لا | قائمة الجامعات حسب الدولة، ومنها عُمان، لحقل المؤسسة |
| [World Bank](https://datahelpdesk.worldbank.org/knowledgebase/topics/125589) | لا | مؤشرات تعليمية لعُمان في التقارير |

## ما استُبعد ولماذا

- **قواميس الإنجليزية** (Free Dictionary وMerriam-Webster وOxford وغيرها): لا تخدم محتوى عربيًا.
- **Open Trivia / quizapi**: أسئلة إنجليزية عامة لا ترتبط بأهداف المنهج.
- **بيانات حكومية وتعليمية لدول أخرى** (الهند، الولايات المتحدة، غانا…): خارج السياق.
- **القائمة لا تحتوي واجهة لبيانات عُمان الحكومية.** أقرب ما فيها: Open Government, Saudi Arabia.
