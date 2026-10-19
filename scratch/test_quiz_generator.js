const fs = require('fs');

let code = fs.readFileSync('default_modules.js', 'utf8');
let DEFAULT_MODULES;
eval(code.replace('const DEFAULT_MODULES', 'DEFAULT_MODULES'));

class QuizEngine {
  static generateQuiz(moduleData, config = {}) {
    const targetCount = parseInt(config.count, 10) || 5;
    const difficulty = (config.difficulty || 'sedang').toLowerCase();
    const qType = (config.type || 'mcq').toLowerCase(); // 'mcq', 'tf', 'mixed'

    if (!moduleData || (!moduleData.fullText && !moduleData.summaryNotes)) {
      return this.getFallbackQuestions(moduleData, targetCount, difficulty, qType);
    }

    const fullText = (moduleData.fullText || '') + '\n' + (moduleData.summaryNotes || '');
    
    // 1. Extract candidate factual statements
    const rawSentences = fullText
      .split(/[\r\n]+|[.!?]\s+/)
      .map(s => s.trim())
      .filter(s => {
        if (s.length < 35 || s.length > 250) return false;
        if (/^(KATA PENGANTAR|DAFTAR ISI|Halaman|Dokumen Akademik|SMA Mutiara|Disusun Oleh)/i.test(s)) return false;
        if (/^[\d\s\-_.,;:]+$/.test(s)) return false;
        return true;
      });

    // 2. Extract facts and key entities
    const facts = [];
    const entityPool = new Set();
    const functionPool = [];

    // Common patterns in Indonesian texts
    const patterns = [
      {
        regex: /([A-Z][a-zA-Z0-9\s()\-]{2,35})\s+(adalah|merupakan|diartikan sebagai|didefinisikan sebagai)\s+([^,;.]{15,140})/i,
        type: 'definition'
      },
      {
        regex: /([A-Z][a-zA-Z0-9\s()\-]{2,35})\s+(berfungsi untuk|berfungsi|berperan dalam|bertujuan untuk|bertugas)\s+([^,;.]{15,140})/i,
        type: 'function'
      },
      {
        regex: /([A-Z][a-zA-Z0-9\s()\-]{2,35})\s+(terdiri dari|terdiri atas|mencakup|meliputi|terbagi menjadi)\s+([^,;.]{15,140})/i,
        type: 'composition'
      },
      {
        regex: /([A-Z][a-zA-Z0-9\s()\-]{2,35})\s+(menghasilkan|mensekresikan|mengeluarkan|membentuk)\s+([^,;.]{15,140})/i,
        type: 'production'
      },
      {
        regex: /([A-Z][a-zA-Z0-9\s()\-]{2,35})\s+(disebabkan oleh|diakibatkan oleh|terjadi akibat)\s+([^,;.]{15,140})/i,
        type: 'cause'
      }
    ];

    for (const sent of rawSentences) {
      for (const p of patterns) {
        const m = sent.match(p.regex);
        if (m) {
          const subject = m[1].replace(/^(Dalam|Pada|Sedangkan|Namun|Selain itu|Sebagai contoh)\s+/i, '').trim();
          const predicate = m[2].trim();
          const detail = m[3].trim();

          if (subject.length > 3 && subject.length < 40 && detail.length > 12) {
            entityPool.add(subject);
            if (p.type === 'function' || p.type === 'definition') {
              functionPool.push(detail);
            }
            facts.push({
              subject,
              predicate,
              detail,
              type: p.type,
              fullSentence: sent
            });
          }
        }
      }
    }

    // Also harvest capitalized multi-word keywords
    for (const sent of rawSentences) {
      const properNouns = sent.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3}\b/g);
      if (properNouns) {
        properNouns.forEach(pn => {
          if (!pn.includes('Dokumen') && !pn.includes('Mutiara') && !pn.includes('SMA')) {
            entityPool.add(pn);
          }
        });
      }
    }

    const entities = Array.from(entityPool);
    const questions = [];
    const usedSubjects = new Set();

    // Determine type for each question
    let questionTypes = [];
    for (let i = 0; i < targetCount; i++) {
      if (qType === 'tf') {
        questionTypes.push('tf');
      } else if (qType === 'mcq') {
        questionTypes.push('mcq');
      } else {
        questionTypes.push(i % 2 === 0 ? 'mcq' : 'tf');
      }
    }

    // Generate questions from extracted facts
    let factIdx = 0;
    for (let i = 0; i < targetCount; i++) {
      const currentType = questionTypes[i];
      let fact = null;

      // Find an unused fact if possible
      while (factIdx < facts.length) {
        const candidate = facts[factIdx++];
        if (!usedSubjects.has(candidate.subject.toLowerCase())) {
          fact = candidate;
          usedSubjects.add(candidate.subject.toLowerCase());
          break;
        }
      }

      // If facts ran out, reuse or synthesize from raw sentences
      if (!fact && facts.length > 0) {
        fact = facts[i % facts.length];
      }

      // If still no fact, create from sentence
      if (!fact) {
        const fallbackSent = rawSentences[i % rawSentences.length] || `Materi ${moduleData.name} mengkaji prinsip dan aplikasi fundamental.`;
        fact = {
          subject: (moduleData.name || 'Konsep Materi').replace(/_/g, ' '),
          predicate: 'mengkaji',
          detail: fallbackSent,
          type: 'definition',
          fullSentence: fallbackSent
        };
      }

      // Find page citation reference
      let pageRef = `Halaman ${1 + (i * 3) % (moduleData.pageCount || 10)}`;
      if (moduleData.pages && Array.isArray(moduleData.pages)) {
        const foundP = moduleData.pages.find(p => p.text && p.text.includes(fact.subject));
        if (foundP) pageRef = `Halaman ${foundP.pageNumber}`;
      }
      const refString = `${moduleData.name || moduleData.filename} • ${pageRef}`;

      if (currentType === 'tf') {
        // --- TRUE / FALSE QUESTION ---
        const isTrueStatement = (i % 2 === 0);
        let qText = '';
        let correctIdx = 0;
        let explanation = '';

        if (isTrueStatement) {
          qText = `Berdasarkan isi materi dokumen, apakah pernyataan berikut BENAR atau SALAH?\n\n"${fact.subject} ${fact.predicate} ${fact.detail}."`;
          correctIdx = 0; // Benar
          explanation = `Pernyataan tersebut BENAR. Hal ini tertulis secara faktual dalam materi: "${fact.fullSentence || (fact.subject + ' ' + fact.predicate + ' ' + fact.detail)}."`;
        } else {
          // Falsify by picking another entity from the pool
          const otherEntity = entities.find(e => e.toLowerCase() !== fact.subject.toLowerCase()) || 'Faktor Eksternal Sekunder';
          qText = `Berdasarkan isi materi dokumen, apakah pernyataan berikut BENAR atau SALAH?\n\n"${otherEntity} ${fact.predicate} ${fact.detail}."`;
          correctIdx = 1; // Salah
          explanation = `Pernyataan tersebut SALAH. Yang ${fact.predicate} ${fact.detail} yang tepat menurut materi adalah "${fact.subject}", bukan "${otherEntity}".`;
        }

        questions.push({
          id: `q_${i + 1}`,
          question: qText,
          options: ['Benar', 'Salah'],
          correctIndex: correctIdx,
          explanation: explanation,
          reference: refString,
          difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
          type: 'Benar / Salah'
        });

      } else {
        // --- MULTIPLE CHOICE QUESTION (MCQ) ---
        let qText = '';
        let correctOption = '';
        let distractorOptions = [];
        let explanation = '';

        // Distractor generation
        const potentialDistractors = entities.filter(e => e.toLowerCase() !== fact.subject.toLowerCase());
        const shuffledDistractors = potentialDistractors.sort(() => 0.5 - Math.random());

        if (difficulty === 'mudah') {
          // Format 1: Direct definition / term identification
          if (i % 2 === 0) {
            qText = `Berdasarkan teks modul, istilah manakah yang ${fact.predicate} "${fact.detail}"?`;
            correctOption = fact.subject;
            distractorOptions = shuffledDistractors.slice(0, 3);
            if (distractorOptions.length < 3) {
              distractorOptions.push('Variabel Komplemen Sistem', 'Komponen Kontrol Tambahan', 'Parameter Uji Mandiri');
            }
            explanation = `Jawaban yang benar adalah ${fact.subject}. Sesuai materi: "${fact.subject} ${fact.predicate} ${fact.detail}".`;
          } else {
            qText = `Apakah fungsi atau peran utama dari "${fact.subject}" sebagaimana dijelaskan dalam dokumen materi?`;
            correctOption = fact.detail.charAt(0).toUpperCase() + fact.detail.slice(1);
            
            const otherDetails = functionPool.filter(f => f !== fact.detail).sort(() => 0.5 - Math.random()).slice(0, 3);
            distractorOptions = otherDetails.map(d => d.charAt(0).toUpperCase() + d.slice(1));
            while (distractorOptions.length < 3) {
              distractorOptions.push('Menstabilkan interaksi variabel bebas lingkungan', 'Memodifikasi fase transisi tanpa melibatkan reaksi langsung', 'Menghambat pertukaran massa pada kondisi standar');
            }
            explanation = `Peran utama ${fact.subject} adalah ${fact.detail}. Hal ini dijelaskan pada bagian materi tersebut.`;
          }

        } else if (difficulty === 'sulit') {
          // Format 3: Analytical & synthesis
          qText = `Analisis Konseptual: Dalam kerangka kerja sistem pada "${moduleData.name}", manakah simpulan yang paling valid mengenai peranan fundamental "${fact.subject}"?`;
          correctOption = `${fact.subject} secara terukur bertindak untuk ${fact.predicate} ${fact.detail}.`;
          
          const altSubject1 = shuffledDistractors[0] || 'Elemen sekunder';
          const altSubject2 = shuffledDistractors[1] || 'Faktor katalis';
          distractorOptions = [
            `${altSubject1} menggantikan seluruh mekanisme dan meniadakan proses pembentukan ${fact.detail.slice(0, 25)}.`,
            `Terjadi disosiasi independen di mana sistem tidak memerlukan ${fact.subject} dalam kondisi operasional apa pun.`,
            `${fact.subject} hanya aktif secara pasif apabila ${altSubject2} diisolasi dari lingkungan sistem.`
          ];
          explanation = `Analisis yang tepat: Dalam materi ditekankan bahwa ${fact.subject} ${fact.predicate} ${fact.detail}, yang menjadi pilar fundamental dalam mekanisme tersebut.`;

        } else {
          // Format 2: Sedang (Concept & Process)
          qText = `Berdasarkan pembahasan materi, bagaimanakah penjelasan yang paling tepat terkait "${fact.subject}"?`;
          correctOption = `${fact.subject} ${fact.predicate} ${fact.detail}.`;

          const otherSubject = shuffledDistractors[0] || 'Komponen Lain';
          const otherDetail = functionPool.find(f => f !== fact.detail) || 'menjaga keseimbangan dinamis internal';

          distractorOptions = [
            `${fact.subject} bertentangan dengan mekanisme sistem dan tidak terlibat dalam ${fact.detail.slice(0, 30)}.`,
            `${otherSubject} adalah satu-satunya entitas yang ${fact.predicate} ${fact.detail}, bukan ${fact.subject}.`,
            `${fact.subject} hanya bertugas ${otherDetail}.`
          ];
          explanation = `Penjelasan yang tepat: "${fact.subject} ${fact.predicate} ${fact.detail}". Informasi ini tercantum dalam pembahasan materi.`;
        }

        // Shuffle options and record correct index
        const options = [correctOption, ...distractorOptions.slice(0, 3)];
        // Shuffle with Fisher-Yates
        for (let j = options.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [options[j], options[k]] = [options[k], options[j]];
        }
        const correctIndex = options.indexOf(correctOption);

        questions.push({
          id: `q_${i + 1}`,
          question: qText,
          options: options,
          correctIndex: correctIndex,
          explanation: explanation,
          reference: refString,
          difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
          type: 'Pilihan Ganda'
        });
      }
    }

    return questions;
  }

  static getFallbackQuestions(moduleData, count, difficulty, type) {
    const modTitle = (moduleData ? (moduleData.name || moduleData.filename) : 'Modul Pembelajaran').replace(/_/g, ' ');
    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push({
        id: `q_${i + 1}`,
        question: `Apakah fokus kajian ilmiah utama yang diuraikan pada "${modTitle}" pada sub-bagian ${i + 1}?`,
        options: [
          `Prinsip fundamental dan penerapan analitis pada ${modTitle}`,
          `Koleksi glosarium terpisah tanpa uji empiris`,
          `Pengantar umum tanpa eksplorasi data komparatif`,
          `Rujukan bibliografi sekunder luar kurikulum`
        ],
        correctIndex: 0,
        explanation: `Modul "${modTitle}" menyajikan landasan teoritis komprehensif dan penalaran saintifik terstruktur.`,
        reference: `${modTitle} • Halaman ${i + 1}`,
        difficulty: difficulty,
        type: type === 'tf' ? 'Benar / Salah' : 'Pilihan Ganda'
      });
    }
    return questions;
  }
}

// Test on Modul 2, Modul 1, Modul 3
console.log('--- TESTING QUIZ GENERATOR ---');
const qMod2 = QuizEngine.generateQuiz(DEFAULT_MODULES[0], { count: 3, difficulty: 'sedang', type: 'mcq' });
console.log('MODUL 2 MCQ:');
console.log(JSON.stringify(qMod2, null, 2));

const qMod1TF = QuizEngine.generateQuiz(DEFAULT_MODULES[1], { count: 3, difficulty: 'mudah', type: 'tf' });
console.log('\nMODUL 1 TRUE/FALSE:');
console.log(JSON.stringify(qMod1TF, null, 2));

const qMod3Mixed = QuizEngine.generateQuiz(DEFAULT_MODULES[2], { count: 4, difficulty: 'sulit', type: 'mixed' });
console.log('\nMODUL 3 SULIT MIXED:');
console.log(JSON.stringify(qMod3Mixed, null, 2));
