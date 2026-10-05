// خادم وهمي يحاكي Ollama (/api/chat، /api/tags، /v1) لاختبارات harak.html: node 2026-10-05-mock-ollama.mjs
import http from 'node:http';
const draft = {modules:[{title:'أساسيات الملاحة البحرية',objective:'أن يحدد الطالب الموقع على الخريطة البحرية باستخدام خطوط الطول والعرض.',durationHours:6,topics:[{title:'خطوط الطول والعرض',description:'تعريف الإحداثيات الجغرافية.'},{title:'رموز الخرائط',description:'قراءة الرموز البحرية.'}]},{title:'البوصلة المغناطيسية',objective:'أن يستخدم الطالب البوصلة لتحديد الاتجاه.',durationHours:4,topics:[{title:'الانحراف المغناطيسي',description:'تصحيح القراءة.'}]}]};
const review = {score:72,overall:'منهج جيد البنية لكن أهدافه تتركز في المستويات الدنيا.',strengths:['تسلسل منطقي'],weaknesses:['غياب التقويم'],objectives:[{text:'أن يذكر الطالب أجزاء النبات',level:'تذكر',issue:'مستوى منخفض',rewrite:'أن يصنّف الطالب أجزاء النبات حسب وظيفتها'}],missing:['أنشطة للدرس الثالث'],recommendations:['أضف تقويمًا ختاميًا']};
function reply(body) {
  const sys = body.messages[0].content, last = body.messages.at(-1).content;
  if (sys.includes('أعد مخططًا')) return JSON.stringify(draft);
  if (sys.includes('مراجع مناهج خبير') && sys.includes('JSON')) return JSON.stringify(review);
  if (sys.includes('نفّذ طلب المستخدم')) return '# تقرير\n\n## الملاحظات\n- الدرس الأول: **الهدف** واضح 好的 ومقبول.\n- الدرس الثالث بلا تقويم.\n\n## التوصيات\n1. أضف تقويمًا.\n2. وحّد الصياغة.';
  if (/JSON/.test(last)) return '```json\n'+JSON.stringify(draft)+'\n```';
  return 'ردّ تجريبي من النموذج: 测试 الأهداف جيدة، أقترح إضافة نشاط عملي لكل وحدة.';
}
http.createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
  res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Headers','*');
  if (req.method==='OPTIONS'){res.end();return;}
  if (req.url==='/api/tags'){res.setHeader('content-type','application/json');res.end(JSON.stringify({models:[{name:'gemma4:31b-cloud'},{name:'llama3.2:latest'}]}));return;}
  const body=JSON.parse(b||'{}'); const text=reply(body); const words=text.split(' '); let i=0;
  if (req.url==='/api/chat') {
    if (!body.options || body.options.num_ctx !== 8192) { res.statusCode=400; res.end('missing num_ctx'); return; }
    res.setHeader('content-type','application/x-ndjson');
    const t=setInterval(()=>{ if(i>=words.length){res.write(JSON.stringify({done:true})+'\n');res.end();clearInterval(t);return;} res.write(JSON.stringify({message:{role:'assistant',content:(i?' ':'')+words[i++]},done:false})+'\n'); },4);
    return;
  }
  res.setHeader('content-type','text/event-stream');
  const t=setInterval(()=>{ if(i>=words.length){res.write('data: [DONE]\n\n');res.end();clearInterval(t);return;} res.write('data: '+JSON.stringify({choices:[{delta:{content:(i?' ':'')+words[i++]}}]})+'\n\n'); },4);
}); }).listen(11434);
