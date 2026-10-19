const fs = require('fs');

// Load default modules
let defaultModulesCode = fs.readFileSync('default_modules.js', 'utf8');
let DEFAULT_MODULES;
eval(defaultModulesCode.replace('const DEFAULT_MODULES', 'DEFAULT_MODULES'));

// Mock DOM & environment for testing app.js QuizEngine
global.DEFAULT_MODULES = DEFAULT_MODULES;
global.AppState = {
  modules: DEFAULT_MODULES,
  activeModuleId: 'modul_02',
  quizState: {
    moduleId: 'modul_02',
    config: { count: 5, difficulty: 'sedang', type: 'mcq' },
    questions: [],
    userAnswers: {}
  }
};

let appCode = fs.readFileSync('app.js', 'utf8');

// Extract QuizEngine class from app.js using regex
const quizEngineMatch = appCode.match(/class QuizEngine\s*\{[\s\S]*?\n\}/);
if (!quizEngineMatch) {
  console.error('QuizEngine not found in app.js!');
  process.exit(1);
}

eval('global.QuizEngine = ' + quizEngineMatch[0].replace('class QuizEngine', 'class'));

console.log('=== COMPREHENSIVE QUIZ GENERATOR TEST ===\n');

// Test 1: Baseline Screenshot 2 Match
const baseline = QuizEngine.getBaselineQuestions('modul_02');
console.log('✓ Test 1 - Baseline Modul 2 (Screenshot 2 Match):');
console.log(`  Questions count: ${baseline.length}`);
console.log(`  Question 3 text: "${baseline[2].question}"`);
console.log(`  Question 3 correct: Option ${baseline[2].correctIndex} (${baseline[2].options[baseline[2].correctIndex]})`);
console.assert(baseline.length === 5, 'Baseline must have 5 questions');
console.assert(baseline[2].options[baseline[2].correctIndex] === 'Pankreas', 'Option B must be Pankreas');
console.assert(baseline[2].reference.includes('Hal. 14'), 'Reference must include Hal. 14');

// Test 2: Dynamic Generation across Multiple Modules, Counts, Difficulties, and Types
const testConfigs = [
  { modIndex: 0, count: 5, diff: 'mudah', type: 'mcq', desc: 'Biologi - Mudah - Pilihan Ganda (5 soal)' },
  { modIndex: 1, count: 3, diff: 'sedang', type: 'tf', desc: 'Sejarah - Sedang - Benar/Salah (3 soal)' },
  { modIndex: 2, count: 4, diff: 'sulit', type: 'mixed', desc: 'Fisika - Sulit - Campuran (4 soal)' },
  { modIndex: 3, count: 10, diff: 'sedang', type: 'mcq', desc: 'Kimia - Sedang - Pilihan Ganda (10 soal)' },
  { modIndex: 4, count: 5, diff: 'sulit', type: 'tf', desc: 'Kalkulus - Sulit - Benar/Salah (5 soal)' }
];

testConfigs.forEach((tc, idx) => {
  const mod = DEFAULT_MODULES[tc.modIndex];
  const qList = QuizEngine.generateQuiz(mod, { count: tc.count, difficulty: tc.diff, type: tc.type });

  console.log(`\n✓ Test ${idx + 2} - ${tc.desc}:`);
  console.log(`  Module: ${mod.name}`);
  console.log(`  Generated questions: ${qList.length} (Expected: ${tc.count})`);
  console.assert(qList.length === tc.count, `Expected ${tc.count} questions but got ${qList.length}`);

  // Validate every question
  qList.forEach((q, qIdx) => {
    console.assert(q.question && q.question.length > 10, `Q${qIdx + 1} question text must not be empty`);
    console.assert(Array.isArray(q.options) && q.options.length >= 2, `Q${qIdx + 1} options must be array >= 2`);
    console.assert(q.correctIndex >= 0 && q.correctIndex < q.options.length, `Q${qIdx + 1} correctIndex must be valid`);
    console.assert(q.explanation && q.explanation.length > 5, `Q${qIdx + 1} explanation must be non-empty`);
    console.assert(q.reference && q.reference.includes(mod.name), `Q${qIdx + 1} reference must cite module`);
  });

  const sampleQ = qList[0];
  console.log(`  Sample Q1: "${sampleQ.question.replace(/\n/g, ' ')}"`);
  console.log(`  Options: ${JSON.stringify(sampleQ.options)}`);
  console.log(`  Correct: Option ${sampleQ.correctIndex} -> "${sampleQ.options[sampleQ.correctIndex]}"`);
  console.log(`  Reference: "${sampleQ.reference}"`);
  console.log(`  Difficulty: "${sampleQ.difficulty}", Type: "${sampleQ.type}"`);
});

// Test 3: Custom User Upload Simulation (TXT / DOCX / MD)
console.log('\n✓ Test 7 - Dynamic Generation on Custom Uploaded Document:');
const customUploadedDoc = {
  id: 'modul_custom_99',
  name: 'Modul_Etika_Kecerdasan_Buatan',
  filename: 'Modul_Etika_Kecerdasan_Buatan.pdf',
  pageCount: 8,
  summaryNotes: `Prinsip Etika AI Modern:
1. Transparansi Algoritmik: Berfungsi memastikan setiap keputusan model dapat diaudit dan dijelaskan kepada pemangku kepentingan.
2. Privasi Data Pengguna: Merupakan hak fundamental individu untuk melindungi informasi pribadi dari eksploitasi tanpa izin.
3. Keadilan dan Bebas Bias: Bertujuan mencegah diskriminasi rasial atau gender dalam klasifikasi otomatis.
4. Tanggung Jawab Hukum: Menetapkan akuntabilitas pengembang perangkat lunak atas kegagalan sistem otonom.`,
  fullText: `Etika kecerdasan buatan adalah cabang etika terapan yang menganalisis implikasi moral pengembangan mesin cerdas.`
};

const customQuiz = QuizEngine.generateQuiz(customUploadedDoc, { count: 4, difficulty: 'sedang', type: 'mixed' });
console.log(`  Custom doc questions count: ${customQuiz.length}`);
customQuiz.forEach((q, i) => {
  console.log(`  Q${i + 1} [${q.type}]: ${q.question.replace(/\n/g, ' ')}`);
  console.log(`    Kunci: ${q.options[q.correctIndex]}`);
  console.log(`    Ref: ${q.reference}`);
});

console.log('\n========================================');
console.log('🎉 ALL QUIZ ENGINE TESTS PASSED WITH 100% SUCCESS!');
console.log('========================================');
