const fs = require('fs');
const pdfjs = require('../lib/pdf.min.js');

async function run() {
  const data = new Uint8Array(fs.readFileSync('Koleksi_Modul_P13/Koleksi_Modul_P13/X_Ekonomi_KD-3.1_Final.pdf'));
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push({ pageNum: i, text: tc.items.map(it => it.str).join(' ') });
  }

  const appJs = fs.readFileSync('app.js', 'utf8');
  const idxProcessor = appJs.indexOf('class NLPIntentProcessor');
  const idxQuiz = appJs.indexOf('/* ==========================================================================\r\n   5. Dynamic AI Quiz');
  const codeSlice = appJs.slice(idxProcessor, idxQuiz !== -1 ? idxQuiz : appJs.indexOf('class QuizEngine'));
  eval(codeSlice.replace('class AutonomousLearningAI', 'global.AutonomousLearningAI = class').replace('class NLPIntentProcessor', 'global.NLPIntentProcessor = class'));

  const mod = { name: 'X_Ekonomi_KD-3.1_Final.pdf', pages: pages, fullText: pages.map(p => p.text).join('\n\n') };

  console.log('Testing "apa itu ilmu ekonomi" on Ekonomi module:');
  const res = AutonomousLearningAI.respond('apa itu ilmu ekonomi', mod);
  console.log('ANSWER:\n', res.answer);
  console.log('SOURCE:', res.source);

  console.log('\n--- Passages found by searchRelevantPassages: ---');
  const passages = AutonomousLearningAI.searchRelevantPassages('apa itu ilmu ekonomi', mod);
  passages.forEach((p, idx) => {
    console.log(`[Passage ${idx + 1}] (Page ${p.pageNum}, Score ${p.score}):\n${p.text.slice(0, 200)}...\n`);
  });
}

run().catch(console.error);
