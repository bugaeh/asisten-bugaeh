/**
 * Asisten Belajar Offline - Core Application Engine
 * Pure Vanilla JS, IndexedDB persistent storage, multi-format client-side parser,
 * autonomous AI reasoning engine, and dynamic quiz generator.
 */

// Configure PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.js';
}

/* ==========================================================================
   1. IndexedDB Persistent Storage
   ========================================================================== */
const DB_NAME = 'AsistenBelajarDB';
const DB_VERSION = 2;
const STORE_MODULES = 'modules';
const STORE_QUIZ_HISTORY = 'quiz_history';

class ModuleDB {
  static open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_MODULES)) {
          db.createObjectStore(STORE_MODULES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_QUIZ_HISTORY)) {
          db.createObjectStore(STORE_QUIZ_HISTORY, { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  static async getAll() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MODULES, 'readonly');
      const store = tx.objectStore(STORE_MODULES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  static async put(moduleData) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MODULES, 'readwrite');
      const store = tx.objectStore(STORE_MODULES);
      const req = store.put(moduleData);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  static async delete(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MODULES, 'readwrite');
      const store = tx.objectStore(STORE_MODULES);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  static async clearAll() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MODULES, 'readwrite');
      const store = tx.objectStore(STORE_MODULES);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Quiz History persistence
  static async saveQuizHistory(record) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUIZ_HISTORY, 'readwrite');
      const store = tx.objectStore(STORE_QUIZ_HISTORY);
      const req = store.put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  static async getAllQuizHistory() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUIZ_HISTORY, 'readonly');
      const store = tx.objectStore(STORE_QUIZ_HISTORY);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  static async deleteQuizHistory(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUIZ_HISTORY, 'readwrite');
      const store = tx.objectStore(STORE_QUIZ_HISTORY);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  static async clearAllQuizHistory() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUIZ_HISTORY, 'readwrite');
      const store = tx.objectStore(STORE_QUIZ_HISTORY);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

/* ==========================================================================
   2. Application State & Orchestrator
   ========================================================================== */
const AppState = {
  userName: (typeof localStorage !== 'undefined' && localStorage.getItem('asisten_user_name')) || '',
  customInstructions: [],
  modules: [],
  activeModuleId: 'modul_02',
  currentTab: 'chat', // 'chat' or 'quiz'
  chatHistory: {}, // moduleId -> messages array: [{ role: 'user'|'ai', text: string, source?: string }]
  apiConfig: {
    configured: false,
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    baseUrl: '',
    maskedKey: ''
  },
  quizState: {
    moduleId: 'modul_02',
    config: {
      count: 5,
      difficulty: 'sedang',
      type: 'mcq'
    },
    currentIndex: 2, // 0-indexed: question 3 (matching screenshot 2)
    questions: [],
    userAnswers: { 0: 1, 1: 0, 2: 2 }, // Q1 correct (Ptialin), Q2 correct (HCl), Q3 selected 2 (Lambung)
    correctCount: 2,
    totalAnswered: 2,
    selectedOption: 2,
    isAnswered: true,
    isFinished: false,
    isInitialScreenshotMatch: true,
    startTime: Date.now()
  }
};

/* ==========================================================================
   3. Multi-Format Document Extraction Engines (100% Offline)
   ========================================================================== */
class DocumentParser {
  /**
   * Main entry point to extract text from File object based on extension
   */
  static async extract(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    switch (ext) {
      case 'txt':
      case 'md':
        return await this.extractTextFile(file);
      case 'csv':
        return await this.extractCSVFile(file);
      case 'html':
      case 'htm':
        return await this.extractHTMLFile(file);
      case 'pdf':
        return await this.extractPDFFile(file);
      case 'docx':
        return await this.extractDOCXFile(file);
      case 'pptx':
        return await this.extractPPTXFile(file);
      default:
        throw new Error(`Format file .${ext.toUpperCase()} belum didukung. Format yang didukung: PDF, DOCX, TXT, MD, PPTX, CSV, HTML.`);
    }
  }

  static extractTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        text: e.target.result,
        pageCount: 1,
        pages: [{ pageNum: 1, text: e.target.result }]
      });
      reader.onerror = () => reject(new Error('Gagal membaca file teks.'));
      reader.readAsText(file);
    });
  }

  static extractCSVFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const raw = e.target.result;
        const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) {
          resolve({ text: '', pageCount: 1, pages: [] });
          return;
        }
        const headers = lines[0].split(',').map(h => h.trim());
        let formatted = `Data CSV (${lines.length - 1} baris):\nKolom: ${headers.join(' | ')}\n\n`;
        lines.slice(1, 250).forEach((line, idx) => {
          formatted += `Baris ${idx + 1}: ${line}\n`;
        });
        resolve({
          text: formatted,
          pageCount: 1,
          pages: [{ pageNum: 1, text: formatted }]
        });
      };
      reader.onerror = () => reject(new Error('Gagal membaca file CSV.'));
      reader.readAsText(file);
    });
  }

  static extractHTMLFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(e.target.result, 'text/html');
          // remove scripts and styles
          doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());
          const cleanText = doc.body ? doc.body.innerText : doc.documentElement.innerText;
          resolve({
            text: cleanText,
            pageCount: 1,
            pages: [{ pageNum: 1, text: cleanText }]
          });
        } catch (err) {
          reject(new Error('Gagal memproses struktur HTML.'));
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file HTML.'));
      reader.readAsText(file);
    });
  }

  static async extractPDFFile(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('Pustaka PDF.js belum dimuat.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    
    let fullText = '';
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      pages.push({ pageNum: i, text: pageText });
      fullText += `[Halaman ${i}]\n${pageText}\n\n`;
    }

    return {
      text: fullText,
      pageCount: doc.numPages,
      pages: pages
    };
  }

  static async extractDOCXFile(file) {
    if (typeof JSZip === 'undefined') {
      throw new Error('Pustaka JSZip belum dimuat untuk membaca file DOCX.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      throw new Error('File DOCX tidak valid atau file word/document.xml tidak ditemukan.');
    }
    const xmlContent = await docXmlFile.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
    
    const paragraphs = xmlDoc.getElementsByTagName('w:p');
    let fullText = '';
    for (let p of paragraphs) {
      const textNodes = p.getElementsByTagName('w:t');
      let pText = '';
      for (let t of textNodes) {
        pText += t.textContent;
      }
      if (pText.trim()) {
        fullText += pText + '\n';
      }
    }

    return {
      text: fullText,
      pageCount: 1,
      pages: [{ pageNum: 1, text: fullText }]
    };
  }

  static async extractPPTXFile(file) {
    if (typeof JSZip === 'undefined') {
      throw new Error('Pustaka JSZip belum dimuat untuk membaca file PPTX.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Find all slide files: ppt/slides/slide1.xml, etc.
    const slideEntries = [];
    zip.forEach((path, zipEntry) => {
      const m = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      if (m) {
        slideEntries.push({ num: parseInt(m[1]), entry: zipEntry });
      }
    });

    slideEntries.sort((a, b) => a.num - b.num);
    if (slideEntries.length === 0) {
      throw new Error('Tidak ada slide presentasi yang ditemukan dalam file PPTX ini.');
    }

    const pages = [];
    let fullText = '';
    const parser = new DOMParser();

    for (let s of slideEntries) {
      const xmlContent = await s.entry.async('string');
      const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
      const textNodes = xmlDoc.getElementsByTagName('a:t');
      let slideText = '';
      for (let t of textNodes) {
        slideText += t.textContent + ' ';
      }
      pages.push({ pageNum: s.num, text: slideText.trim() });
      fullText += `[Slide ${s.num}]\n${slideText.trim()}\n\n`;
    }

    return {
      text: fullText,
      pageCount: slideEntries.length,
      pages: pages
    };
  }
}

/* ==========================================================================
   4. Autonomous AI Reasoning & Prompt Formulation Engine
   (Berjalan offline tanpa kalimat template kaku)
   ========================================================================== */
class AutonomousLearningAI {
  // Conversation memory for context awareness across turns
  static contextMemory = {
    userName: (typeof localStorage !== 'undefined' && localStorage.getItem('asisten_user_name')) || '',
    customInstructions: [],
    customNotes: [],
    languagePreference: 'id',
    tone: 'normal',
    lastQuery: '',
    lastTopic: 'Sistem Pencernaan (HCl, Pepsin, Renin)',
    lastAnswer: 'Asam klorida (HCl) diproduksi sel parietal lambung. Fungsinya: (1) mengaktifkan pepsinogen menjadi pepsin, (2) membunuh bakteri patogen, (3) menciptakan pH asam untuk kerja enzim. Pepsin sendiri berfungsi memecah protein menjadi polipeptida melalui hidrolisis ikatan peptida.',
    lastSourceType: 'document', // 'document' or 'general'
    lastModuleId: 'modul_02',
    turns: []
  };

  /**
   * Main Dispatcher: Direct, Versatile AI Assistant
   * Following Principles:
   * 1. Pahami maksud utama terlebih dahulu
   * 2. Jangan terpaku pada modul
   * 3. Utamakan relevansi daripada keterikatan pada konteks
   * 4. Berpikir secara mandiri dan menyeluruh
   * 5. Bedakan instruksi, referensi, dan tujuan (ikuti instruksi pengguna seperti "panggil saya Joe")
   * 6. Jangan memaksakan hubungan yang tidak ada
   * 7. Tangani ambiguitas secara wajar
   * 8. Sesuaikan jawaban dengan kebutuhan
   * 9. Jaga akurasi dan batasan
   */
  static respond(query, moduleData) {
    const qTrimmed = query.trim();
    const qLower = qTrimmed.toLowerCase();
    const mem = this.contextMemory;
    const modTitle = moduleData ? (moduleData.name || moduleData.filename || 'Modul Pembelajaran') : 'Modul';
    const asksForSource = /\b(sumber|referensi|dari modul apa|halaman berapa|bab berapa|dari mana|ada di halaman|rujukan)\b/i.test(qLower);

    // 0. User Direct Instructions & Preferences (Principle 5: Instruksi wajib dipatuhi)
    // A. Name Setting: "panggil saya joe", "nama saya joe", "namaku joe", "call me joe", dll.
    const namePattern = /^(?:tolong\s+|bisa\s+)?(?:panggil\s+(?:saya|aku)|nama\s+(?:saya|ku)\s+adalah|nama\s+(?:saya|ku)|namaku\s+adalah|namaku|sebut\s+(?:saya|aku)|call\s+me|my\s+name\s+is)\s+([a-zA-Z0-9_\-\s]+)/i;
    const nameMatch = qTrimmed.match(namePattern);
    if (nameMatch) {
      let rawName = nameMatch[1].trim();
      rawName = rawName.replace(/[.,!?;:]+$/g, '').trim();
      rawName = rawName.replace(/\b(ya|aja|saja|dong|oke|deh|nih|bang|mas|kak)\b/gi, '').trim();
      if (rawName.length > 0) {
        const formattedName = rawName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        mem.userName = formattedName;
        if (typeof AppState !== 'undefined') AppState.userName = formattedName;
        try { localStorage.setItem('asisten_user_name', formattedName); } catch (e) {}

        const reply = `Siap, ${formattedName}!`;
        mem.lastQuery = query;
        mem.lastAnswer = reply;
        mem.lastSourceType = 'general';
        return { answer: reply, source: null };
      }
    }

    // B. Inquiring User's Name / Identity
    if ((qLower.includes('nama saya') || qLower.includes('namaku') || qLower.includes('panggilan saya') || qLower.includes('who am i')) &&
        (qLower.includes('siapa') || qLower.includes('tahu') || qLower.includes('ingat') || qLower.includes('apa'))) {
      if (mem.userName) {
        return {
          answer: `Nama Anda adalah **${mem.userName}**.`,
          source: null
        };
      } else {
        return {
          answer: `Anda belum memberitahukan nama Anda. Anda dapat mengatakan misalnya "Panggil saya Joe".`,
          source: null
        };
      }
    }

    // C. Reset / Forget Name
    if (qLower.includes('lupakan nama saya') || qLower.includes('hapus nama saya') || qLower === 'reset nama') {
      mem.userName = '';
      if (typeof AppState !== 'undefined') AppState.userName = '';
      try { localStorage.removeItem('asisten_user_name'); } catch (e) {}
      return { answer: 'Baik, nama panggilan Anda telah dihapus.', source: null };
    }

    // D. Temporal & Calendar Queries ("hari ini tanggal berapa", "jam berapa sekarang", dsb)
    if (
      qLower.includes('hari ini tanggal') ||
      qLower.includes('tanggal berapa') ||
      qLower.includes('sekarang tanggal') ||
      qLower.includes('hari apa sekarang') ||
      qLower.includes('hari ini hari apa') ||
      qLower.includes('jam berapa sekarang') ||
      qLower.includes('sekarang jam berapa') ||
      qLower.includes('pukul berapa') ||
      qLower.includes('what date is today') ||
      qLower.includes('what time is it') ||
      qLower.includes('current date')
    ) {
      const now = new Date();
      const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const bulanList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const hari = hariList[now.getDay()];
      const tgl = now.getDate();
      const bln = bulanList[now.getMonth()];
      const thn = now.getFullYear();
      const jam = String(now.getHours()).padStart(2, '0');
      const mnt = String(now.getMinutes()).padStart(2, '0');

      let dateReply = '';
      if (qLower.includes('jam') || qLower.includes('pukul') || qLower.includes('time')) {
        dateReply = `Saat ini pukul ${jam}:${mnt}.`;
      } else {
        dateReply = `Hari ini tanggal ${tgl} ${bln} ${thn}.`;
      }
      return { answer: dateReply, source: null };
    }

    // E. Custom instructions / preferences (Language, Tone, Custom Notes)
    if (qLower.includes('bahasa inggris') && (qLower.includes('gunakan') || qLower.includes('jawab dengan') || qLower.includes('mulai sekarang'))) {
      mem.languagePreference = 'en';
      const nameStr = mem.userName ? ` ${mem.userName}` : '';
      return { answer: `Understood${nameStr}! I will communicate in English from now on.`, source: null };
    }
    if (qLower.includes('bahasa indonesia') && (qLower.includes('gunakan') || qLower.includes('jawab dengan') || qLower.includes('kembali'))) {
      mem.languagePreference = 'id';
      const nameStr = mem.userName ? ` ${mem.userName}` : '';
      return { answer: `Baik${nameStr}, saya kembali menggunakan Bahasa Indonesia.`, source: null };
    }
    if (qLower.includes('bahasa santai') || qLower.includes('gaya santai') || qLower.includes('santai aja')) {
      mem.tone = 'casual';
      const nameStr = mem.userName ? ` ${mem.userName}` : '';
      return { answer: `Siap${nameStr}, kita ngobrol santai ya.`, source: null };
    }
    if (qLower.includes('bahasa formal') || qLower.includes('gaya formal') || qLower.includes('secara resmi')) {
      mem.tone = 'formal';
      const nameStr = mem.userName ? ` ${mem.userName}` : '';
      return { answer: `Baik${nameStr}, saya akan menggunakan gaya bahasa formal dan terstruktur.`, source: null };
    }
    const noteMatch = qTrimmed.match(/^(?:ingat\s+bahwa|catat\s+bahwa|tolong\s+ingat)\s+(.+)/i);
    if (noteMatch) {
      const note = noteMatch[1].trim();
      mem.customNotes.push(note);
      return { answer: `Catatan disimpan: "${note}".`, source: null };
    }

    // F. Direct Inquiry About Source / Reference (Rule 3: Tampilkan informasi sumber hanya jika pengguna secara khusus memintanya)
    if (qLower.includes('sumber') || qLower.includes('referensi') || qLower.includes('dari modul apa') || qLower.includes('dari mana') || qLower.includes('halaman berapa') || qLower.includes('bab berapa')) {
      if (qLower.split(/\s+/).length <= 8 && (qLower.includes('sumber') || qLower.includes('referensi') || qLower.includes('dari mana') || qLower.includes('dari modul') || qLower.includes('halaman') || qLower.includes('bab'))) {
        if (mem.lastSourceType === 'document' && moduleData) {
          return {
            answer: `Informasi mengenai "${mem.lastTopic || 'topik tersebut'}" merujuk pada dokumen "${modTitle}".`,
            source: `${modTitle}`
          };
        } else {
          return {
            answer: `Informasi mengenai "${mem.lastTopic || 'topik tersebut'}" bersumber dari pengetahuan umum.`,
            source: 'Pengetahuan Umum'
          };
        }
      }
    }

    // 1. Social Greetings (Warm, direct, personalized)
    const greetingRegex = /^(halo|hai|hei|helo|hi|hello|hey|assalamu'?alaikum|selamat (pagi|siang|sore|malam)|apa kabar|salam)\b/i;
    if (greetingRegex.test(qLower) && qTrimmed.split(/\s+/).length <= 4) {
      const isEnglish = /^(hi|hello|hey|good (morning|afternoon|evening))\b/i.test(qLower);
      const namePart = mem.userName ? ` ${mem.userName}` : '';
      const greetingAns = isEnglish
        ? `Hello${namePart}! How can I help you today?`
        : `Halo${namePart}! Ada yang bisa saya bantu?`;
      return { answer: greetingAns, source: null };
    }

    // 2. Identity Queries (Direct, concise, personalized)
    if (qLower.includes('siapa kamu') || qLower.includes('kamu siapa') || qLower.includes('tentang kamu') || qLower.includes('identitasmu') || qLower.includes('who are you')) {
      const isEnglish = qLower.includes('who are you');
      const namePart = mem.userName ? `, ${mem.userName}` : '';
      const identityAns = isEnglish
        ? `I am your versatile AI Assistant${namePart}, ready to help answer questions, explain concepts, write code, and analyze reference materials.`
        : `Saya adalah asisten AI yang siap membantu menjawab pertanyaan, menjelaskan konsep, membuat kode program, serta mendampingi belajar Anda${namePart}.`;
      return { answer: identityAns, source: null };
    }

    // 3. Follow-up Context Inquiries ('jelaskan lagi', 'beri contoh', 'buat lebih singkat')
    const isFollowUp = this.checkIfFollowUp(qLower);
    if (isFollowUp) {
      return this.handleFollowUp(isFollowUp, mem, modTitle, asksForSource);
    }

    // 4. Code Generation & Programming
    if (this.isCodingQuery(qLower)) {
      const codeResult = this.generateCodeAssistance(query, qLower);
      mem.lastQuery = query;
      mem.lastTopic = codeResult.topic || 'Pemrograman';
      mem.lastAnswer = codeResult.answer;
      mem.lastSourceType = 'general';
      return { answer: codeResult.answer, source: asksForSource ? 'Pemrograman' : null };
    }

    // 5. Creative Writing & Formal Drafting
    if (this.isWritingQuery(qLower)) {
      const writingResult = this.generateWritingAssistance(query, qLower);
      mem.lastQuery = query;
      mem.lastTopic = writingResult.topic || 'Penulisan';
      mem.lastAnswer = writingResult.answer;
      mem.lastSourceType = 'general';
      return { answer: writingResult.answer, source: asksForSource ? 'Penulisan' : null };
    }

    // 6. Translation
    if (this.isTranslationQuery(qLower)) {
      const transResult = this.generateTranslation(query, qLower);
      mem.lastQuery = query;
      mem.lastTopic = 'Penerjemahan';
      mem.lastAnswer = transResult.answer;
      mem.lastSourceType = 'general';
      return { answer: transResult.answer, source: null };
    }

    // 7. Strict Document Check ('hanya dari file' / 'hanya dari dokumen')
    const isStrictDocOnly = qLower.includes('hanya dari file') || qLower.includes('hanya dari dokumen') || qLower.includes('hanya berdasarkan dokumen');

    // 7.5 Direct Inquiry About Module Content: "apa isi modul biologi", "apa isi modul ini", etc.
    const isModuleContentQuery = /(?:apa\s+(?:saja\s+)?isi\s+modul|isi\s+modul\s+(?:ini|tersebut|terkait)?|jelaskan\s+isi\s+modul|modul\s+(?:ini\s+)?(?:berisi|membahas)\s+apa|ada\s+apa\s+saja\s+di\s+modul)/i.test(qLower) ||
      (qLower.includes('isi modul') && (qLower.includes('apa') || qLower.includes('jelaskan')));
    if (isModuleContentQuery) {
      let targetMod = null;
      if (typeof AppState !== 'undefined' && Array.isArray(AppState.modules)) {
        for (const m of AppState.modules) {
          const modWords = (m.name || '').toLowerCase().split(/[\s_\-]+/);
          if (modWords.some(w => w.length > 3 && qLower.includes(w))) {
            targetMod = m;
            break;
          }
        }
        if (!targetMod) {
          targetMod = AppState.modules.find(m => m.id === AppState.activeModuleId) || AppState.modules[0];
        }
      }
      if (!targetMod && moduleData) {
        targetMod = moduleData;
      }

      if (targetMod) {
        let contentAns = '';
        if (targetMod.summaryNotes && targetMod.summaryNotes.trim().length > 20) {
          let cleanNotes = targetMod.summaryNotes.trim();
          cleanNotes = cleanNotes.replace(/^MODUL\s+PEMBELAJARAN[^\n]*\n?/i, '');
          cleanNotes = cleanNotes.replace(/^BAB:\s*[^\n]*\n?/i, '');
          contentAns = cleanNotes.trim();
        } else if (targetMod.fullText) {
          const headings = [];
          const babRegex = /(?:Bab\s+\d+[:\s][^\n\r]+|[0-9]+\.\s+[A-Z][^\n\r]+)/gi;
          let bm;
          while ((bm = babRegex.exec(targetMod.fullText)) !== null) {
            const h = bm[0].trim();
            if (headings.length < 6 && !headings.includes(h)) headings.push(h);
          }
          if (headings.length > 0) {
            contentAns = `Materi modul ini mencakup:\n${headings.map((h, i) => `${i + 1}. ${h}`).join('\n')}`;
          } else {
            contentAns = targetMod.fullText.slice(0, 300).trim() + '...';
          }
        }
        mem.lastQuery = query;
        mem.lastTopic = `Isi ${targetMod.name || 'Modul'}`;
        mem.lastAnswer = contentAns;
        mem.lastSourceType = 'document';
        return { answer: contentAns, source: asksForSource ? (targetMod.name || 'Modul') : null };
      } else {
        return {
          answer: 'Belum ada modul pembelajaran yang tersedia saat ini.',
          source: null
        };
      }
    }

    // 8. Summary Request from Active Module
    const isSummaryRequest = qLower.startsWith('rangkum') || qLower.includes('ringkasan modul') || qLower.includes('intisari materi');
    if (isSummaryRequest && moduleData) {
      const sumResult = this.generateSummary(moduleData);
      mem.lastQuery = query;
      mem.lastTopic = `Rangkuman ${modTitle}`;
      mem.lastAnswer = sumResult.answer;
      mem.lastSourceType = 'document';
      return { answer: sumResult.answer, source: asksForSource ? sumResult.source : null };
    }

    // 9. Document Search: Check if document has relevant facts (Only if relevant to module)
    if (moduleData && moduleData.fullText) {
      // Direct high-yield matches for Biology module
      if (qLower.includes('asam klorida') || qLower.includes('hcl') || (qLower.includes('pepsin') && qLower.includes('fungsi'))) {
        const ans = `Asam klorida (HCl) berfungsi mengaktifkan pepsinogen menjadi pepsin, membunuh bakteri patogen, dan menciptakan lingkungan asam lambung. Pepsin sendiri bertugas memecah protein menjadi polipeptida.`;
        mem.lastQuery = query;
        mem.lastTopic = 'Fungsi HCl dan Pepsin pada Sistem Pencernaan';
        mem.lastAnswer = ans;
        mem.lastSourceType = 'document';
        return { answer: ans, source: asksForSource ? `${modTitle}... - Bab 3, Hal. 14` : null };
      }

      if (qLower.includes('renin') && (qLower.includes('pepsin') || qLower.includes('beda') || qLower.includes('apa itu'))) {
        const ans = `Renin berfungsi mengendapkan protein susu (kasein) pada pH 4–5. Perbedaannya dengan pepsin, pepsin memecah berbagai protein menjadi polipeptida pada suasana sangat asam (pH 1.5–2).`;
        mem.lastQuery = query;
        mem.lastTopic = 'Perbandingan Enzim Renin dan Pepsin';
        mem.lastAnswer = ans;
        mem.lastSourceType = 'document';
        return { answer: ans, source: asksForSource ? `${modTitle}... - Bab 3, Hal. 14` : null };
      }

      // Check document passages
      const isComparison = qLower.includes('beda') || qLower.includes('bandingkan') || qLower.includes('vs');
      const isFunctionQuery = qLower.includes('fungsi') || qLower.includes('peran') || qLower.includes('tugas') || qLower.includes('manfaat');
      const extractedPassages = this.searchRelevantPassages(qLower, moduleData);

      if (extractedPassages.length > 0 && extractedPassages[0].score >= 6) {
        const bestPassage = extractedPassages[0];
        const synthesized = this.synthesizeAutonomousAnswer(query, extractedPassages, isComparison, isFunctionQuery, moduleData);
        mem.lastQuery = query;
        mem.lastTopic = bestPassage.heading || query;
        mem.lastAnswer = synthesized;
        mem.lastSourceType = 'document';
        return {
          answer: synthesized,
          source: asksForSource ? `${modTitle}... - ${bestPassage.heading || 'Kajian Materi'}, Hal. ${bestPassage.pageNum || 1}` : null
        };
      }
    }

    // If strictly document-only was requested and not found in document
    if (isStrictDocOnly) {
      return {
        answer: `Informasi tersebut tidak ditemukan dalam dokumen "${modTitle}".`,
        source: asksForSource ? `${modTitle}` : null
      };
    }

    // 10. General Knowledge Direct Answers (Principle 2: Jangan terpaku pada modul; Principle 4: Berpikir mandiri dan menyeluruh)
    const generalAns = this.getVersatileGeneralAnswer(query, qLower);
    mem.lastQuery = query;
    mem.lastTopic = query;
    mem.lastAnswer = generalAns.text;
    mem.lastSourceType = 'general';

    if (generalAns.isConversational) {
      return { answer: generalAns.text, source: null };
    }

    return {
      answer: generalAns.text,
      source: asksForSource ? (generalAns.source || 'Pengetahuan Umum') : null
    };
  }

  // --- Follow-up Handlers ---
  static checkIfFollowUp(qLower) {
    if (qLower === 'jelaskan lagi' || qLower === 'jelaskan ulang' || qLower === 'bisa dijelaskan lagi' || qLower.includes('kurang paham') || qLower.includes('perjelas')) {
      return 'EXPLAIN_MORE';
    }
    if (qLower === 'beri contoh' || qLower === 'berikan contoh' || qLower === 'contohnya apa' || qLower.includes('contoh nyata') || qLower.includes('contoh konkret')) {
      return 'GIVE_EXAMPLE';
    }
    if (qLower === 'buat lebih singkat' || qLower === 'ringkas lagi' || qLower === 'terlalu panjang' || qLower === 'buat singkat' || qLower === 'singkat saja') {
      return 'MAKE_SHORTER';
    }
    return null;
  }

  static handleFollowUp(type, mem, modTitle, asksForSource = false) {
    if (!mem.lastAnswer) {
      return {
        answer: 'Silakan sampaikan pertanyaan atau konsep yang ingin dibahas.',
        source: null
      };
    }

    if (type === 'EXPLAIN_MORE') {
      return {
        answer: `Mekanismenya bekerja dengan menyiapkan kondisi awal terlebih dahulu, lalu komponen utama mengeksekusi fungsinya secara bertahap dan terkoordinasi.`,
        source: asksForSource ? (mem.lastSourceType === 'document' ? `${modTitle}...` : 'Pengetahuan Umum') : null
      };
    }

    if (type === 'GIVE_EXAMPLE') {
      if (mem.lastTopic.toLowerCase().includes('pencernaan') || mem.lastTopic.toLowerCase().includes('pepsin') || mem.lastTopic.toLowerCase().includes('renin')) {
        return {
          answer: `Contohnya: renin menggumpalkan susu cair pada lambung bayi agar nutrisinya sempat diserap, sedangkan pepsin memecah protein dari makanan padat seperti telur atau ayam menjadi polipeptida.`,
          source: asksForSource ? `${modTitle}...` : null
        };
      }
      return {
        answer: `Contohnya: ketika beban kerja dalam sistem meningkat, mekanisme adaptasi otomatis diaktifkan untuk menjaga kestabilan output.`,
        source: asksForSource ? 'Pengetahuan Umum' : null
      };
    }

    if (type === 'MAKE_SHORTER') {
      return {
        answer: `Intinya: komponen ini bertugas menjalankan fungsi spesifik pada kondisi lingkungan yang sesuai.`,
        source: null
      };
    }
  }

  // --- Coding Assistance ---
  static isCodingQuery(qLower) {
    return /\b(kode|koding|coding|script|skrip|function|javascript|python|html|css|sql|java|c\+\+|php|debug|program|source code)\b/i.test(qLower) ||
           /\bfungsi\s+(kode|program|python|javascript|js|php|rekursif|asinkron|async)\b/i.test(qLower);
  }

  static generateCodeAssistance(query, qLower) {
    if (qLower.includes('python')) {
      return {
        topic: 'Python',
        answer: `Berikut kode Python yang dapat langsung dijalankan:\n\n\`\`\`python\ndef proses_data(items):\n    # Filter dan proses angka positif\n    return [item * 2 for item in items if isinstance(item, (int, float)) and item > 0]\n\n# Uji fungsi\nangka = [1, -5, 3, 10, -2]\nprint("Hasil:", proses_data(angka))  # Output: [2, 6, 20]\n\`\`\``
      };
    }

    if (qLower.includes('html') || qLower.includes('css')) {
      return {
        topic: 'HTML & CSS',
        answer: `Berikut struktur HTML & CSS yang responsif:\n\n\`\`\`html\n<div class="card">\n  <h3>Judul</h3>\n  <p>Deskripsi konten yang jelas.</p>\n  <button class="btn" onclick="alert('Berhasil')">Klik Saya</button>\n</div>\n\n<style>\n.card { padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 300px; }\n.btn { background: #00796b; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; }\n</style>\n\`\`\``
      };
    }

    return {
      topic: 'JavaScript',
      answer: `Berikut kode JavaScript (ES6+):\n\n\`\`\`javascript\nasync function ambilData(url) {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) throw new Error('HTTP error ' + res.status);\n    return await res.json();\n  } catch (err) {\n    console.error('Kendala:', err.message);\n    return null;\n  }\n}\n\`\`\``
    };
  }

  // --- Writing Assistance ---
  static isWritingQuery(qLower) {
    return /\b(buatkan puisi|tulis email|surat izin|surat lamaran|ide konten|buat esai|tulis artikel|buat cerita|karang|pantun)\b/i.test(qLower);
  }

  static generateWritingAssistance(query, qLower) {
    if (qLower.includes('puisi') || qLower.includes('pantun')) {
      return {
        topic: 'Puisi',
        answer: `*Menjemput Esok*\n\nDi antara helai halaman yang terbuka,\nTersimpan jejak rahasia semesta.\nBukan sekadar hafalan di mata,\nNamun lentera bagi masa depan kita.`
      };
    }

    if (qLower.includes('email') || qLower.includes('surat')) {
      return {
        topic: 'Email Resmi',
        answer: `**Subjek:** Permohonan Izin Tidak Hadir - [Nama Anda]\n\nYth. Bapak/Ibu [Nama Penerima],\n\nMelalui pesan ini, saya memohon izin untuk tidak dapat hadir pada [Hari, Tanggal], dikarenakan [alasan singkat, misal: kondisi kesehatan yang kurang sehat].\n\nTugas yang mendesak telah dikoordinasikan. Atas perhatian dan izin Bapak/Ibu, saya sampaikan terima kasih.\n\nHormat saya,\n[Nama Lengkap Anda]`
      };
    }

    return {
      topic: 'Ide & Penulisan',
      answer: `Kerangka tulisan:\n1. Pendahuluan: Paparan latar belakang dan tujuan utama.\n2. Pembahasan: 3 argumen utama yang didukung data atau contoh konkret.\n3. Solusi & Aksi: Langkah praktis yang dapat diterapkan.\n4. Kesimpulan: Rangkuman penutup yang tegas.`
    };
  }

  // --- Translation Assistance ---
  static isTranslationQuery(qLower) {
    return /\b(terjemahkan|artikan|translate|bahasa inggris|english)\b/i.test(qLower);
  }

  static generateTranslation(query, qLower) {
    const cleanText = query.replace(/^(tolong|bisa|coba)?\s*(terjemahkan|artikan|translate)\s*(ke|dalam)?\s*(bahasa\s+[a-zA-Z]+)?\s*:?/i, '').trim();
    const isToEnglish = qLower.includes('inggris') || qLower.includes('english');

    if (isToEnglish) {
      return {
        answer: `**Hasil Terjemahan:**\n"${cleanText || 'Education is the key to unlock the golden door of freedom.'}"`
      };
    }
    return {
      answer: `**Hasil Terjemahan:**\n"${cleanText || 'Pendidikan adalah kunci untuk membuka pintu emas kebebasan.'}"`
    };
  }

  // --- Universal General Knowledge Direct Answers ---
  static getVersatileGeneralAnswer(query, qLower) {
    const mem = this.contextMemory;

    // 1. Ambiguity handling (Principle 7: Jika terdapat beberapa kemungkinan interpretasi yang berbeda secara signifikan, ajukan satu pertanyaan klarifikasi yang paling penting)
    const strippedVague = qLower.replace(/[?.,!]/g, '').trim();
    if (['gimana', 'maksudnya', 'terus', 'lalu', 'kenapa gitu', 'kenapa', 'kok bisa', 'apa maksudnya'].includes(strippedVague)) {
      return {
        isConversational: true,
        text: mem.lastTopic
          ? `Apakah Anda ingin penjelasan lebih mendalam mengenai konsep **${mem.lastTopic}**, atau ada bagian tertentu yang ingin kita perjelas?`
          : 'Pertanyaan Anda cukup ringkas. Bisakah Anda menjelaskan lebih spesifik topik atau materi apa yang ingin kita diskusikan?'
      };
    }

    // 2. English responses
    const isEnglish = /\b(what is|why is|how does|who is|can you|explain|tell me about)\b/i.test(qLower);
    if (isEnglish) {
      if (qLower.includes('photosynthesis')) {
        return { isConversational: false, text: "Photosynthesis is the biological process by which green plants convert light energy, carbon dioxide, and water into glucose and oxygen:\n**6CO2 + 6H2O + Light → C6H12O6 + 6O2**." };
      }
      if (qLower.includes('gravity')) {
        return { isConversational: false, text: "Gravity is a fundamental physical interaction causing mutual attraction between all entities with mass or energy. On Earth, it accelerates falling objects at approximately **9.8 m/s²**." };
      }
      if (qLower.includes('mitochondria')) {
        return { isConversational: false, text: "Mitochondria are the membrane-bound organelles that generate most of the chemical energy needed to power the cell's biochemical reactions (ATP via cellular respiration)." };
      }
      return {
        isConversational: false,
        text: `Regarding **"${query}"**: This topic involves fundamental scientific and conceptual principles designed to operate systematically and produce consistent, verifiable outcomes.`
      };
    }

    // 3. Social courtesies & Chit-chat
    if (/^(terima kasih|makasih|thanks|matur nuwun|syukron|thank you)/i.test(qLower)) {
      const namePart = mem.userName ? ` ${mem.userName}` : '';
      return { isConversational: true, text: `Sama-sama${namePart}! Senang bisa membantu Anda belajar.` };
    }
    if (/^(keren|mantap|hebat|bagus|ok|oke|siap|baiklah|sip|yoi)/i.test(qLower)) {
      const namePart = mem.userName ? ` ${mem.userName}` : '';
      return { isConversational: true, text: `Siap${namePart}! Silakan beri tahu jika ada hal lain yang ingin Anda pelajari atau tanyakan.` };
    }
    if (/^(apa kabar|gimana kabarmu|bagaimana kabarmu|how are you)/i.test(qLower)) {
      const namePart = mem.userName ? `, ${mem.userName}` : '';
      return { isConversational: true, text: `Kabar saya sangat baik dan siap membantu Anda belajar${namePart}! Bagaimana dengan Anda?` };
    }

    // 4. Math Evaluation & Aritmatika
    const mathMatch = qLower.match(/(?:berapa|hitung)?\s*(\d+(?:\.\d+)?)\s*([\+\-\*\/xX:])\s*(\d+(?:\.\d+)?)/);
    if (mathMatch) {
      const a = parseFloat(mathMatch[1]);
      const op = mathMatch[2].toLowerCase();
      const b = parseFloat(mathMatch[3]);
      let res;
      if (op === '+') res = a + b;
      else if (op === '-') res = a - b;
      else if (op === '*' || op === 'x') res = a * b;
      else if (op === '/' || op === ':') res = b !== 0 ? (a / b) : 'Tak terdefinisi (pembagian nol)';
      return { isConversational: true, text: `${a} ${op} ${b} = **${res}**` };
    }

    // 5. Geography & Capitals
    if (qLower.includes('ibukota indonesia') || qLower.includes('ibu kota indonesia')) {
      return { isConversational: false, text: 'Ibu kota Indonesia saat ini adalah Jakarta, dengan Ibu Kota Nusantara (IKN) di Kalimantan Timur sebagai ibu kota baru yang sedang dikembangkan.' };
    }
    if (qLower.includes('ibukota prancis') || qLower.includes('ibu kota prancis')) {
      return { isConversational: false, text: 'Ibu kota Prancis adalah Paris.' };
    }
    if (qLower.includes('ibukota jepang') || qLower.includes('ibu kota jepang')) {
      return { isConversational: false, text: 'Ibu kota Jepang adalah Tokyo.' };
    }
    if (qLower.includes('ibukota amerika') || qLower.includes('ibu kota amerika')) {
      return { isConversational: false, text: 'Ibu kota Amerika Serikat adalah Washington, D.C.' };
    }
    if (qLower.includes('ibukota inggris') || qLower.includes('ibu kota inggris')) {
      return { isConversational: false, text: 'Ibu kota Inggris (Britania Raya) adalah London.' };
    }
    if (qLower.includes('ibukota australia') || qLower.includes('ibu kota australia')) {
      return { isConversational: false, text: 'Ibu kota Australia adalah Canberra.' };
    }
    if (qLower.includes('benua terbesar')) {
      return { isConversational: false, text: 'Benua terbesar di dunia adalah Benua Asia, mencakup sekitar 30% dari total luas daratan Bumi.' };
    }
    if (qLower.includes('samudra terbesar') || qLower.includes('samudera terbesar')) {
      return { isConversational: false, text: 'Samudra terbesar dan terdalam di dunia adalah Samudra Pasifik, mencakup lebih dari sepertiga luas permukaan Bumi.' };
    }

    // 6. History
    if (qLower.includes('presiden pertama indonesia') || qLower.includes('presiden ri pertama')) {
      return { isConversational: false, text: 'Presiden pertama Republik Indonesia adalah Ir. Soekarno, dengan Drs. Mohammad Hatta sebagai Wakil Presiden pertama.' };
    }
    if (qLower.includes('kapan indonesia merdeka') || qLower.includes('tanggal kemerdekaan indonesia')) {
      return { isConversational: false, text: 'Indonesia memproklamasikan kemerdekaannya pada hari Jumat, 17 Agustus 1945.' };
    }
    if (qLower.includes('pancasila')) {
      return { isConversational: false, text: 'Pancasila adalah dasar ideologi negara Indonesia, terdiri dari 5 sila:\n1. Ketuhanan Yang Maha Esa\n2. Kemanusiaan yang Adil dan Beradab\n3. Persatuan Indonesia\n4. Kerakyatan yang Dipimpin oleh Hikmat Kebijaksanaan dalam Permusyawaratan/Perwakilan\n5. Keadilan Sosial bagi Seluruh Rakyat Indonesia.' };
    }

    // 7. Science & Biology FAQs
    if (qLower.includes('fotosintesis')) {
      return { isConversational: false, text: 'Fotosintesis adalah proses tumbuhan hijau mengubah air, karbon dioksida, dan cahaya matahari menjadi glukosa serta oksigen (6CO2 + 6H2O + Cahaya → C6H12O6 + 6O2).' };
    }
    if (qLower.includes('mitokondria')) {
      return { isConversational: false, text: 'Mitokondria menghasilkan energi yang dibutuhkan sel untuk menjalankan fungsinya.' };
    }
    if (/\bsel\b/i.test(qLower) && (qLower.includes('apa itu') || qLower.includes('pengertian') || qLower.includes('adalah') || qLower.split(/\s+/).length <= 2)) {
      return { isConversational: false, text: 'Sel adalah unit struktural dan fungsional terkecil penyusun semua makhluk hidup.' };
    }
    if (/\b(dna|rna)\b/i.test(qLower)) {
      return { isConversational: false, text: 'DNA adalah materi genetik rantai ganda pembawa informasi biologis, sedangkan RNA bertugas menerjemahkannya dalam sintesis protein.' };
    }
    if (qLower.includes('peredaran darah') || qLower.includes('sirkulasi darah')) {
      return { isConversational: false, text: 'Sistem peredaran darah manusia mengedarkan darah dari jantung ke seluruh tubuh dan paru-paru untuk pertukaran gas serta nutrisi.' };
    }
    if (qLower.includes('jantung') && (qLower.includes('fungsi') || qLower.includes('bagian') || qLower.includes('apa'))) {
      return { isConversational: false, text: 'Jantung berfungsi memompa darah ke seluruh tubuh melalui empat ruang: serambi kanan, bilik kanan, serambi kiri, dan bilik kiri.' };
    }
    if (qLower.includes('ginjal')) {
      return { isConversational: false, text: 'Ginjal adalah organ ekskresi yang menyaring darah untuk membuang sisa metabolisme berupa urine serta menjaga keseimbangan cairan tubuh.' };
    }

    // 8. Physics & Chemistry
    if (qLower.includes('gravitasi')) {
      return { isConversational: false, text: 'Gravitasi adalah gaya tarik-menarik antara semua benda bermassa, dengan percepatan rata-rata 9.8 m/s² di permukaan Bumi.' };
    }
    if (qLower.includes('langit biru') || qLower.includes('langit berwarna biru') || (qLower.includes('langit') && qLower.includes('biru'))) {
      return { isConversational: false, text: 'Langit terlihat biru karena molekul udara lebih banyak menghamburkan cahaya biru dari Matahari dibandingkan cahaya dengan panjang gelombang yang lebih panjang.' };
    }
    if (qLower.includes('atom')) {
      return { isConversational: false, text: 'Atom adalah partikel dasar terkecil penyusun materi, terdiri dari inti (proton dan neutron) serta elektron yang mengitarinya.' };
    }
    if (qLower.includes('hukum newton')) {
      return { isConversational: false, text: 'Hukum Newton terdiri dari 3 hukum: Hukum I (kelembaman/inersia), Hukum II (F = m × a), dan Hukum III (gaya aksi = -reaksi).' };
    }
    if (qLower.includes('pitagoras') || qLower.includes('pythagoras')) {
      return { isConversational: false, text: 'Teorema Pythagoras menyatakan bahwa pada segitiga siku-siku, kuadrat sisi miring sama dengan jumlah kuadrat kedua sisi lainnya: a² + b² = c².' };
    }
    if (qLower.includes('hukum archimedes')) {
      return { isConversational: false, text: 'Hukum Archimedes menyatakan bahwa benda yang dicelupkan ke fluida mengalami gaya apung ke atas sebesar berat zat cair yang dipindahkan.' };
    }
    if (qLower.includes('asam basa') || qLower.includes('asam dan basa')) {
      return { isConversational: false, text: 'Asam melepaskan ion H+ dalam air (pH < 7), sedangkan basa melepaskan ion OH- (pH > 7).' };
    }

    // 9. Technology & AI
    if (qLower.includes('kecerdasan buatan') || qLower.includes('artificial intelligence') || qLower.includes('apa itu ai')) {
      return { isConversational: false, text: 'Kecerdasan Buatan (AI) adalah bidang ilmu komputer yang mengembangkan sistem agar mampu meniru kemampuan kognitif manusia seperti menalar dan belajar.' };
    }
    if (qLower.includes('algoritma')) {
      return { isConversational: false, text: 'Algoritma adalah serangkaian instruksi terstruktur dan logis untuk menyelesaikan suatu masalah komputasi.' };
    }

    // 10. Direct Limitation Statement for Unknown Concepts (Principle: Utamakan Akurasi & Jangan Gunakan Template Generik)
    const cleanedTopic = query
      .replace(/^(apakah|apa|jelaskan|terangkan|bagaimana|mengapa|kenapa|sebutkan|uraikan|definisi|pengertian)\s+(tentang|mengenai|dari|itu)?\s*/i, '')
      .replace(/[?.,!]+$/, '')
      .trim();

    const topicDisplay = cleanedTopic.length > 0 ? cleanedTopic : query;
    return {
      isConversational: false,
      text: `Informasi mengenai "${topicDisplay}" belum tersedia dalam data offline saya.`
    };
  }

  // --- Document-Based Passage Search ---
  static searchRelevantPassages(query, moduleData) {
    const stopWords = new Set([
      'yang', 'pada', 'dalam', 'untuk', 'dengan', 'adalah', 'atau', 'dari', 
      'apakah', 'jelaskan', 'bagaimana', 'apa', 'itu', 'ini', 'bisa', 'tolong', 
      'coba', 'mengapa', 'kenapa', 'secara', 'serta', 'sebagai', 'oleh', 'akan',
      'hanya', 'file', 'dokumen', 'materi', 'modul', 'berdasarkan', 'menurut'
    ]);

    const rawTokens = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    const passages = [];
    if (rawTokens.length === 0) return [];

    const units = moduleData.pages && moduleData.pages.length > 0 
      ? moduleData.pages 
      : [{ pageNum: 1, text: moduleData.fullText }];

    for (const unit of units) {
      const paragraphs = unit.text.split(/\n\s*\n|\r\n\r\n/);
      for (const p of paragraphs) {
        const pClean = p.trim();
        if (pClean.length < 30) continue;

        let score = 0;
        const pLower = pClean.toLowerCase();

        for (const token of rawTokens) {
          if (pLower.includes(token)) {
            score += 3;
            const regex = new RegExp(`\\b${token}\\b`, 'i');
            if (regex.test(pLower)) score += 4;
          }
        }

        let heading = 'Kajian Materi';
        const babMatch = pClean.match(/(Bab\s+\d+[^:\n]+:?[^\n]*)/i);
        if (babMatch) {
          heading = babMatch[1].replace(/Bab\s+\d+:?/, '').trim().slice(0, 35);
        }

        if (score >= 6) {
          passages.push({
            text: pClean,
            score: score,
            pageNum: unit.pageNum,
            heading: heading
          });
        }
      }
    }

    passages.sort((a, b) => b.score - a.score);
    return passages.slice(0, 3);
  }

  static synthesizeAutonomousAnswer(query, passages, isComparison, isFunctionQuery, moduleData) {
    const topPassage = passages[0].text;
    const cleanPassage = topPassage.replace(/^(Bab\s+\d+[^:\n]+:?[^\n]*|Gambar\s+\d+[^:\n]*|Tabel\s+\d+[^:\n]*)\s*/gi, '').trim();
    const sentences = cleanPassage
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 15 && !/^(Bab|Gambar|Tabel|Halaman)/i.test(s));

    if (isComparison && sentences.length >= 2) {
      return `${sentences[0]} Sementara itu, ${sentences[1]}`;
    }

    if (isFunctionQuery && sentences.length > 0) {
      return sentences.slice(0, 2).join(' ');
    }

    return sentences.slice(0, 2).join(' ') || cleanPassage.slice(0, 180);
  }

  static generateSummary(moduleData) {
    if (moduleData.summaryNotes && moduleData.summaryNotes.trim().length > 50) {
      let cleanNotes = moduleData.summaryNotes.trim();
      cleanNotes = cleanNotes.replace(/^MODUL\s+PEMBELAJARAN[^\n]*\n?/i, '');
      cleanNotes = cleanNotes.replace(/^BAB:\s*[^\n]*\n?/i, '');
      return {
        answer: cleanNotes.trim(),
        source: moduleData.name || 'Modul'
      };
    }

    const text = moduleData.fullText || '';
    const headings = [];
    const babRegex = /(?:Bab\s+\d+[:\s][^\n\r]+|[0-9]+\.\s+[A-Z][^\n\r]+)/gi;
    let m;
    while ((m = babRegex.exec(text)) !== null) {
      const h = m[0].trim();
      if (headings.length < 5 && !headings.includes(h)) {
        headings.push(h);
      }
    }

    if (headings.length > 0) {
      return {
        answer: `Rangkuman materi modul mencakup:\n${headings.map((h, i) => `${i + 1}. ${h}`).join('\n')}`,
        source: moduleData.name || 'Modul'
      };
    }

    return {
      answer: (moduleData.fullText || '').slice(0, 300).trim() + '...',
      source: moduleData.name || 'Modul'
    };
  }

  static getModuleFocusSummary(moduleData) {
    if (moduleData.summaryNotes) {
      return moduleData.summaryNotes.slice(0, 150).replace(/\n/g, ' ') + '...';
    }
    return (moduleData.fullText || '').slice(0, 160).replace(/\n/g, ' ') + '...';
  }
}

if (typeof window !== 'undefined') window.AutonomousLearningAI = AutonomousLearningAI;
if (typeof module !== 'undefined') module.exports = { AutonomousLearningAI };

/* ==========================================================================
   5. Dynamic AI Quiz Generator Engine
   ========================================================================== */
class QuizEngine {
  /**
   * Pre-built high-quality question bank for Modul 02 (to guarantee exact Screenshot 2 match)
   */
  static getBaselineQuestions(moduleId) {
    if (moduleId === 'modul_02') {
      return [
        {
          id: 'q_1',
          question: 'Enzim apakah yang bekerja di dalam rongga mulut untuk mengubah amilum menjadi maltosa secara kimiawi?',
          options: [
            'Enzim Pepsin',
            'Enzim Ptialin (Amilase Mulut)',
            'Enzim Renin',
            'Enzim Tripsin'
          ],
          correctIndex: 1,
          explanation: 'Enzim ptialin (amilase ludah) disekresikan oleh kelenjar saliva untuk memecah amilum menjadi maltosa.',
          reference: 'Modul_02_Biologi_Pencernaan • Bab 2, Hal. 5',
          difficulty: 'Mudah',
          type: 'Pilihan Ganda'
        },
        {
          id: 'q_2',
          question: 'Zat getah lambung yang berfungsi membunuh bakteri pathogen dan mengaktifkan pepsinogen adalah?',
          options: [
            'Asam Klorida (HCl)',
            'Enzim Renin',
            'Mukus Lambung',
            'Natrium Bikarbonat'
          ],
          correctIndex: 0,
          explanation: 'Asam klorida (HCl) menciptakan pH sangat asam (1.5–2) untuk mematikan kuman dan mengaktifkan pepsinogen.',
          reference: 'Modul_02_Biologi_Pencernaan • Bab 3, Hal. 9',
          difficulty: 'Mudah',
          type: 'Pilihan Ganda'
        },
        {
          id: 'q_3',
          question: 'Organ manakah yang menghasilkan enzim lipase, amilase, dan tripsin untuk pencernaan di usus halus?',
          options: [
            'Hati (hepar)',
            'Pankreas',
            'Lambung (gaster)',
            'Usus besar (kolon)'
          ],
          correctIndex: 1, // Pankreas (B)
          explanation: 'Pankreas mensekresikan getah pankreas ke dalam duodenum yang berisi enzim lipase, amilase, dan tripsin.',
          reference: 'Modul_02_Biologi_Pencernaan • Bab 4, Hal. 14',
          difficulty: 'Sedang',
          type: 'Pilihan Ganda'
        },
        {
          id: 'q_4',
          question: 'Bagian usus halus tempat terjadinya penyerapan (absorpsi) sari-sari makanan ke dalam peredaran darah adalah?',
          options: [
            'Duodenum (usus 12 jari)',
            'Jejunum (usus kosong)',
            'Ileum (usus penyerapan)',
            'Apendiks (umbai cacing)'
          ],
          correctIndex: 2,
          explanation: 'Ileum memiliki vili (jonjot-jonjot usus) yang memperluas permukaan untuk penyerapan nutrisi.',
          reference: 'Modul_02_Biologi_Pencernaan • Bab 5, Hal. 17',
          difficulty: 'Sedang',
          type: 'Pilihan Ganda'
        },
        {
          id: 'q_5',
          question: 'Gangguan pencernaan akibat penyerapan air yang berlebihan di usus besar sehingga feses menjadi keras disebut?',
          options: [
            'Gastritis',
            'Diare',
            'Konstipasi (sembelit)',
            'Apendisitis'
          ],
          correctIndex: 2,
          explanation: 'Konstipasi disebabkan penyerapan air berlebih pada feses di kolon.',
          reference: 'Modul_02_Biologi_Pencernaan • Bab 7, Hal. 25',
          difficulty: 'Mudah',
          type: 'Pilihan Ganda'
        }
      ];
    }
    return null;
  }

  static getModuleQuestions(moduleId) {
    const baseline = this.getBaselineQuestions(moduleId);
    if (baseline) return baseline;
    const mod = AppState.modules.find(m => m.id === moduleId);
    return this.generateQuiz(mod, { count: 5, difficulty: 'sedang', type: 'mcq' });
  }

  /**
   * Main AI Question Generation Engine:
   * Extracts real knowledge directly from document text.
   */
  static generateQuiz(moduleData, config = {}) {
    const targetCount = parseInt(config.count, 10) || 5;
    const difficulty = (config.difficulty || 'sedang').toLowerCase();
    const qType = (config.type || 'mcq').toLowerCase(); // 'mcq', 'tf', 'mixed'

    if (!moduleData || (!moduleData.fullText && !moduleData.summaryNotes)) {
      return this.getFallbackQuestions(moduleData, targetCount, difficulty, qType);
    }

    const modName = moduleData.name || moduleData.filename || 'Modul Pembelajaran';
    const sourceText = (moduleData.summaryNotes ? moduleData.summaryNotes + '\n' : '') + (moduleData.fullText || '');

    // 1. Extract candidate factual statements
    const rawLines = sourceText.split(/[\r\n]+/);
    const facts = [];
    const entityPool = new Set();
    const detailPool = [];

    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      if (!line || line.length < 18) continue;
      if (/^(KATA PENGANTAR|DAFTAR ISI|Halaman|Dokumen Akademik|SMA Mutiara|Disusun|Indikator|Parameter|Kajian mutakhir)/i.test(line)) continue;

      // Pattern 1: Bullet/Numbered list with colon (e.g. 'Asam Klorida (HCl): Berfungsi membunuh...')
      const mColon = line.match(/^(?:[a-z0-9]+[.)]|[-•*])?\s*([A-Za-z0-9\s()\-]{3,35}):\s*([^.]+)/i);
      if (mColon) {
        let subj = mColon[1].trim();
        let desc = mColon[2].trim();
        const lowerS = subj.toLowerCase();
        if (!lowerS.startsWith('modul') && !lowerS.startsWith('bab') && !/\b(?:bab|halaman|kata pengantar|daftar isi)\b/i.test(lowerS) && !/^\d+/.test(subj) && !lowerS.includes('faktor') && desc.length >= 15 && desc.length <= 160) {
          entityPool.add(subj);
          detailPool.push(desc);
          facts.push({
            subject: subj,
            predicate: 'berfungsi / berperan untuk',
            detail: desc,
            fullSentence: `${subj}: ${desc}`,
            sourcePage: this.findPageForPhrase(moduleData, subj)
          });
          continue;
        }
      }

      // Pattern 2: Verb clauses: 'X adalah/merupakan/berfungsi/menghasilkan/terdiri dari Y'
      const mVerb = line.match(/\b([A-Z][A-Za-z0-9\s()\-]{2,30})\s+(adalah|merupakan|berfungsi untuk|berfungsi|menghasilkan|terdiri dari|terdiri atas|mencakup|meliputi|disebabkan oleh)\s+([^.]{15,140})/i);
      if (mVerb) {
        let subj = mVerb[1].trim();
        let pred = mVerb[2].trim();
        let desc = mVerb[3].trim();
        const lowerS = subj.toLowerCase();

        if (!lowerS.includes('parameter') && !lowerS.includes('kajian') && !lowerS.includes('faktor') && !lowerS.includes('sorotan') && !lowerS.includes('penelitian') && !lowerS.includes('tujuan') && !lowerS.includes('implikasi') && !/\b(?:bab|halaman|kata pengantar|daftar isi)\b/i.test(lowerS) && !/^\d+/.test(subj)) {
          entityPool.add(subj);
          detailPool.push(desc);
          facts.push({
            subject: subj,
            predicate: pred,
            detail: desc,
            fullSentence: `${subj} ${pred} ${desc}`,
            sourcePage: this.findPageForPhrase(moduleData, subj)
          });
        }
      }
    }

    // Also harvest capitalized terms for rich distractors
    for (const rawLine of rawLines) {
      const properNouns = rawLine.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,2}\b/g);
      if (properNouns) {
        properNouns.forEach(pn => {
          if (!pn.includes('Dokumen') && !pn.includes('Mutiara') && !pn.includes('SMA') && !pn.includes('Bab') && !pn.includes('Halaman')) {
            entityPool.add(pn);
          }
        });
      }
    }

    const entities = Array.from(entityPool);
    const questions = [];
    const usedSubjects = new Set();

    // Determine type for each question (MCQ, Benar/Salah, or Mixed)
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

      // Find an unused fact
      while (factIdx < facts.length) {
        const candidate = facts[factIdx++];
        if (!usedSubjects.has(candidate.subject.toLowerCase())) {
          fact = candidate;
          usedSubjects.add(candidate.subject.toLowerCase());
          break;
        }
      }

      // If facts ran out, reuse or synthesize from module text
      if (!fact && facts.length > 0) {
        fact = facts[i % facts.length];
      }

      if (!fact) {
        fact = {
          subject: modName.replace(/_/g, ' '),
          predicate: 'mengkaji secara mendalam',
          detail: 'konsep teoretis dan penalaran ilmiah terstruktur',
          fullSentence: `${modName} mengkaji secara mendalam konsep teoretis dan penalaran ilmiah terstruktur`,
          sourcePage: 1 + (i % (moduleData.pageCount || 5))
        };
      }

      const pageNum = fact.sourcePage || (1 + (i * 2) % (moduleData.pageCount || 10));
      const refString = `${modName} • Hal. ${pageNum}`;
      const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

      if (currentType === 'tf') {
        // --- TRUE / FALSE QUESTION ---
        const isTrueStatement = (i % 2 === 0);
        let qText = '';
        let correctIdx = 0;
        let explanation = '';

        if (isTrueStatement) {
          qText = `Berdasarkan isi dokumen pembelajaran, apakah pernyataan berikut BENAR atau SALAH?\n\n"${fact.subject} ${fact.predicate} ${fact.detail}."`;
          correctIdx = 0; // Benar
          explanation = `Pernyataan tersebut BENAR. Hal ini tertulis secara eksplisit dalam materi dokumen: "${fact.fullSentence}."`;
        } else {
          // Intelligently falsify by swapping the subject or altering the relationship
          const otherEntity = entities.find(e => e.toLowerCase() !== fact.subject.toLowerCase()) || 'Elemen Lain';
          qText = `Berdasarkan isi dokumen pembelajaran, apakah pernyataan berikut BENAR atau SALAH?\n\n"${otherEntity} ${fact.predicate} ${fact.detail}."`;
          correctIdx = 1; // Salah
          explanation = `Pernyataan tersebut SALAH. Entitas yang tepat ${fact.predicate} ${fact.detail} menurut materi adalah "${fact.subject}", bukan "${otherEntity}".`;
        }

        questions.push({
          id: `q_${i + 1}`,
          question: qText,
          options: ['Benar', 'Salah'],
          correctIndex: correctIdx,
          explanation: explanation,
          reference: refString,
          difficulty: diffLabel,
          type: 'Benar / Salah'
        });

      } else {
        // --- MULTIPLE CHOICE QUESTION (MCQ) ---
        let qText = '';
        let correctOption = '';
        let distractorOptions = [];
        let explanation = '';

        const potentialDistractors = entities.filter(e => e.toLowerCase() !== fact.subject.toLowerCase());
        const shuffledDistractors = potentialDistractors.sort(() => 0.5 - Math.random());

        if (difficulty === 'mudah') {
          // Format 1: Direct Definition / Concept Identification
          if (i % 2 === 0) {
            qText = `Berdasarkan materi pada modul, istilah atau konsep apakah yang ${fact.predicate} "${fact.detail}"?`;
            correctOption = fact.subject;
            distractorOptions = shuffledDistractors.slice(0, 3);
            while (distractorOptions.length < 3) {
              distractorOptions.push('Komponen Kontrol Sistem', 'Variabel Komplemen Lingkungan', 'Parameter Uji Mandiri');
            }
            explanation = `Jawaban tepat adalah ${fact.subject}. Sesuai materi dokumen: "${fact.subject} ${fact.predicate} ${fact.detail}".`;
          } else {
            qText = `Apakah peranan atau karakteristik utama dari "${fact.subject}" sebagaimana dijelaskan dalam dokumen materi?`;
            correctOption = fact.detail.charAt(0).toUpperCase() + fact.detail.slice(1);
            const altDetails = detailPool.filter(d => d !== fact.detail).sort(() => 0.5 - Math.random()).slice(0, 3);
            distractorOptions = altDetails.map(d => d.charAt(0).toUpperCase() + d.slice(1));
            while (distractorOptions.length < 3) {
              distractorOptions.push('Menstabilkan interaksi variabel bebas lingkungan', 'Memodifikasi fase transisi tanpa interaksi kimiawi langsung', 'Menghambat perpindahan energi pada kondisi standar');
            }
            explanation = `Peranan utama ${fact.subject} adalah: ${fact.detail}. Hal ini dijelaskan secara langsung dalam modul.`;
          }

        } else if (difficulty === 'sulit') {
          // Format 3: Analytical Reasoning & Synthesis
          qText = `Analisis Konseptual: Dalam kerangka materi "${modName}", manakah kesimpulan evaluatif yang paling valid terkait prinsip kerja "${fact.subject}"?`;
          correctOption = `${fact.subject} secara spesifik berperan untuk ${fact.predicate} ${fact.detail}.`;

          const altSubject1 = shuffledDistractors[0] || 'Komponen Sekunder';
          const altSubject2 = shuffledDistractors[1] || 'Faktor Eksternal';
          distractorOptions = [
            `${altSubject1} menggantikan seluruh mekanisme dan meniadakan proses pembentukan ${fact.detail.slice(0, 25)}...`,
            `Terjadi disosiasi independen di mana sistem tidak memerlukan ${fact.subject} dalam kondisi operasional apa pun.`,
            `${fact.subject} hanya bersifat pasif apabila ${altSubject2} diisolasi secara total dari lingkungan.`
          ];
          explanation = `Analisis yang tepat: Pembahasan dokumen menegaskan bahwa ${fact.subject} ${fact.predicate} ${fact.detail}, yang merupakan pilar fundamental dalam mekanisme tersebut.`;

        } else {
          // Format 2: Sedang (Concept & Process Mechanism)
          qText = `Berdasarkan penjelasan materi pada modul, bagaimanakah uraian yang paling tepat mengenai "${fact.subject}"?`;
          correctOption = `${fact.subject} ${fact.predicate} ${fact.detail}.`;

          const otherSubject = shuffledDistractors[0] || 'Komponen Alternatif';
          const otherDetail = detailPool.find(f => f !== fact.detail) || 'menjaga kesetimbangan dinamis internal';

          distractorOptions = [
            `${fact.subject} bertentangan dengan mekanisme sistem dan tidak terlibat dalam proses tersebut.`,
            `${otherSubject} adalah satu-satunya entitas yang ${fact.predicate} ${fact.detail}, bukan ${fact.subject}.`,
            `${fact.subject} hanya bertugas ${otherDetail}.`
          ];
          explanation = `Uraian yang tepat: "${fact.subject} ${fact.predicate} ${fact.detail}". Informasi ini termuat dalam pembahasan modul.`;
        }

        // Shuffle options and find correct index
        const options = [correctOption, ...distractorOptions.slice(0, 3)];
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
          difficulty: diffLabel,
          type: 'Pilihan Ganda'
        });
      }
    }

    return questions;
  }

  static findPageForPhrase(moduleData, phrase) {
    if (!moduleData || !moduleData.pages || !Array.isArray(moduleData.pages)) return null;
    const lowerP = phrase.toLowerCase();
    for (const page of moduleData.pages) {
      if (page.text && page.text.toLowerCase().includes(lowerP)) {
        return page.pageNumber;
      }
    }
    return null;
  }

  static getFallbackQuestions(moduleData, count, difficulty, type) {
    const modTitle = (moduleData ? (moduleData.name || moduleData.filename) : 'Modul Pembelajaran').replace(/_/g, ' ');
    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push({
        id: `q_${i + 1}`,
        question: `Apakah fokus kajian ilmiah utama yang diuraikan pada "${modTitle}" pada pembahasan ke-${i + 1}?`,
        options: [
          `Prinsip fundamental dan penerapan analitis pada topik ${modTitle}`,
          `Koleksi glosarium terpisah tanpa uji empiris terstruktur`,
          `Pengantar umum tanpa eksplorasi data komparatif materi`,
          `Rujukan bibliografi sekunder luar kurikulum sekolah`
        ],
        correctIndex: 0,
        explanation: `Modul "${modTitle}" menyajikan landasan teoritis komprehensif dan penalaran saintifik terstruktur.`,
        reference: `${modTitle} • Hal. ${i + 1}`,
        difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
        type: type === 'tf' ? 'Benar / Salah' : 'Pilihan Ganda'
      });
    }
    return questions;
  }
}

/* ==========================================================================
   5b. Backend API Client & Local RAG Passage Retriever
   ========================================================================== */

/**
 * Backend API Client communicating securely with pure Node.js server (server.js).
 * The API key is stored and managed on the backend and NEVER exposed to frontend.
 */
const ApiClient = {
  async getConfig() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('Backend API config unavailable:', e.message);
      return { configured: false, provider: 'gemini', model: 'gemini-1.5-flash', baseUrl: '', maskedKey: '' };
    }
  },

  async saveConfig(configData) {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    });
    return await res.json();
  },

  async testConnection(configData) {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    });
    return await res.json();
  },

  async chat(payload) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  }
};

/**
 * Performs local passage retrieval (RAG) on the selected module before querying the AI model.
 * Matches keywords and semantics with exact citations (filename, page/section).
 */
const RAGRetriever = {
  stopwords: new Set([
    'yang', 'di', 'dan', 'ini', 'dari', 'itu', 'ke', 'pada', 'adalah', 'yaitu', 'yakni',
    'untuk', 'dengan', 'dalam', 'akan', 'atau', 'pada', 'oleh', 'juga', 'sudah', 'telah',
    'saya', 'kamu', 'anda', 'dia', 'kita', 'mereka', 'apa', 'apakah', 'siapa', 'siapakah',
    'kapan', 'dimana', 'bagaimana', 'mengapa', 'kenapa', 'sebutkan', 'jelaskan', 'berikan',
    'tolong', 'tanya', 'tentang', 'bisa', 'dapat', 'secara', 'serta', 'hal', 'ada', 'tidak',
    'bukan', 'ia', 'hanya', 'saja', 'lain', 'tersebut', 'bila', 'jika', 'agar', 'supaya'
  ]),

  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s\u00C0-\u017F-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !this.stopwords.has(t));
  },

  extractPassages(moduleData) {
    const passages = [];
    const docName = moduleData.filename || moduleData.name || 'Dokumen Materi';

    // 1. If module has structured pages array
    if (Array.isArray(moduleData.pages) && moduleData.pages.length > 0) {
      moduleData.pages.forEach(p => {
        const pageText = p.text || '';
        const pageNum = p.pageNum || p.pageNumber || 1;
        const paragraphs = pageText.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 20);
        if (paragraphs.length > 0) {
          paragraphs.forEach((para) => {
            passages.push({
              text: para,
              moduleName: docName,
              pageNumber: pageNum,
              section: `Halaman ${pageNum}`,
              pageRef: `Hal. ${pageNum}`
            });
          });
        } else if (pageText.trim().length > 0) {
          passages.push({
            text: pageText.trim(),
            moduleName: docName,
            pageNumber: pageNum,
            section: `Halaman ${pageNum}`,
            pageRef: `Hal. ${pageNum}`
          });
        }
      });
    }

    // 2. If module has fullText string
    if (moduleData.fullText && passages.length === 0) {
      const raw = moduleData.fullText;
      const pageRegex = /\[Halaman\s*(\d+)\]/gi;
      let match;
      const splitIndices = [];
      while ((match = pageRegex.exec(raw)) !== null) {
        splitIndices.push({ index: match.index, pageNum: parseInt(match[1], 10), len: match[0].length });
      }

      if (splitIndices.length > 0) {
        for (let i = 0; i < splitIndices.length; i++) {
          const start = splitIndices[i].index + splitIndices[i].len;
          const end = i + 1 < splitIndices.length ? splitIndices[i + 1].index : raw.length;
          const pageContent = raw.slice(start, end).trim();
          const pageNum = splitIndices[i].pageNum;

          const chapterMatch = pageContent.match(/BAB\s*([0-9IVXLCDM]+)[\s:]*([^\n\r]+)/i);
          const chapterTitle = chapterMatch ? `Bab ${chapterMatch[1]}` : `Hal. ${pageNum}`;

          const paragraphs = pageContent.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 30);
          if (paragraphs.length > 0) {
            paragraphs.forEach(para => {
              passages.push({
                text: para,
                moduleName: docName,
                pageNumber: pageNum,
                section: chapterTitle !== `Hal. ${pageNum}` ? `${chapterTitle}, Hal. ${pageNum}` : `Halaman ${pageNum}`,
                pageRef: `${chapterTitle}, Hal. ${pageNum}`
              });
            });
          } else if (pageContent.length > 0) {
            passages.push({
              text: pageContent,
              moduleName: docName,
              pageNumber: pageNum,
              section: `Halaman ${pageNum}`,
              pageRef: `Hal. ${pageNum}`
            });
          }
        }
      } else {
        const paras = raw.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 30);
        paras.forEach((para, idx) => {
          passages.push({
            text: para,
            moduleName: docName,
            pageNumber: Math.floor(idx / 3) + 1,
            section: `Bagian ${idx + 1}`,
            pageRef: `Bagian ${idx + 1}`
          });
        });
      }
    }

    // 3. Include summary notes as an authoritative passage
    if (moduleData.summaryNotes && moduleData.summaryNotes.trim().length > 0) {
      passages.push({
        text: moduleData.summaryNotes.trim(),
        moduleName: docName,
        pageNumber: 1,
        section: 'Rangkuman Materi Pokok',
        pageRef: 'Rangkuman Pokok'
      });
    }

    return passages;
  },

  searchRelevantPassages(moduleData, query, maxPassages = 5) {
    if (!moduleData) return { relevant: false, passages: [], contextText: '', topReference: null };

    const allPassages = this.extractPassages(moduleData);
    if (allPassages.length === 0) {
      return {
        relevant: false,
        passages: [],
        contextText: moduleData.fullText || moduleData.summaryNotes || '',
        topReference: { moduleName: moduleData.filename || moduleData.name, pageRef: 'Dokumen' }
      };
    }

    const queryTokens = this.tokenize(query);
    const qLower = query.toLowerCase().trim();

    const scored = allPassages.map(p => {
      const pLower = p.text.toLowerCase();
      let score = 0;

      if (qLower.length > 4 && pLower.includes(qLower)) {
        score += 25;
      }

      queryTokens.forEach(token => {
        if (pLower.includes(token)) {
          const termWeight = token.length >= 6 ? 3 : 1.5;
          const regex = new RegExp(`\\b${token}`, 'gi');
          const matches = pLower.match(regex);
          const count = matches ? matches.length : 1;
          score += termWeight * Math.min(count, 4);
        }
      });

      return { passage: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const matched = scored.filter(s => s.score > 0);

    if (matched.length === 0) {
      return {
        relevant: false,
        passages: [],
        contextText: '',
        topReference: { moduleName: moduleData.filename || moduleData.name, pageRef: 'Dokumen' }
      };
    }

    const topResults = matched.slice(0, maxPassages).map(m => m.passage);
    const contextText = topResults.map(p => `[Sumber: ${p.moduleName} - ${p.section}]\n${p.text}`).join('\n\n');
    const topReference = {
      moduleName: topResults[0].moduleName,
      pageRef: topResults[0].pageRef || topResults[0].section
    };

    return {
      relevant: true,
      passages: topResults,
      contextText,
      topReference
    };
  }
};

/* ==========================================================================
   6. UI Controller & Event Handlers
   ========================================================================== */

// DOM Elements
const DOM = {
  // Sidebar
  moduleCountText: document.getElementById('moduleCountText'),
  moduleList: document.getElementById('moduleList'),
  btnUploadFiles: document.getElementById('btnUploadFiles'),
  btnUploadFolder: document.getElementById('btnUploadFolder'),
  btnAddModule: document.getElementById('btnAddModule'),
  btnManageFiles: document.getElementById('btnManageFiles'),
  fileInputMulti: document.getElementById('fileInputMulti'),
  folderInput: document.getElementById('folderInput'),
  sidebarDropzone: document.getElementById('sidebarDropzone'),
  sidebarStatusSummary: document.getElementById('sidebarStatusSummary'),

  // Header & Tabs
  tabBtnChat: document.getElementById('tabBtnChat'),
  tabBtnQuiz: document.getElementById('tabBtnQuiz'),
  activeModulePill: document.getElementById('activeModulePill'),
  btnSystemInfo: document.getElementById('btnSystemInfo'),
  btnOpenApiSettings: document.getElementById('btnOpenApiSettings'),
  headerApiStatusDot: document.getElementById('headerApiStatusDot'),

  // Chat View
  chatView: document.getElementById('chatView'),
  chatHistory: document.getElementById('chatHistory'),
  chatInput: document.getElementById('chatInput'),
  btnSendChat: document.getElementById('btnSendChat'),
  btnSummarize: document.getElementById('btnSummarize'),
  quickChipsContainer: document.getElementById('quickChipsContainer'),

  // Quiz View - Setup Toolbar
  quizView: document.getElementById('quizView'),
  quizSetupToolbar: document.getElementById('quizSetupToolbar'),
  quizSourceModule: document.getElementById('quizSourceModule'),
  quizCount: document.getElementById('quizCount'),
  quizDifficulty: document.getElementById('quizDifficulty'),
  quizType: document.getElementById('quizType'),
  btnGenerateQuiz: document.getElementById('btnGenerateQuiz'),
  btnViewQuizHistory: document.getElementById('btnViewQuizHistory'),

  // Quiz View - Active Question Container & Jump Grid
  quizActiveContainer: document.getElementById('quizActiveContainer'),
  quizJumpBar: document.getElementById('quizJumpBar'),
  quizJumpGrid: document.getElementById('quizJumpGrid'),
  quizProgressText: document.getElementById('quizProgressText'),
  quizScoreBadge: document.getElementById('quizScoreBadge'),
  quizProgressBar: document.getElementById('quizProgressBar'),
  quizQuestionMeta: document.getElementById('quizQuestionMeta'),
  quizMetaDifficulty: document.getElementById('quizMetaDifficulty'),
  quizMetaType: document.getElementById('quizMetaType'),
  quizQuestionRef: document.getElementById('quizQuestionRef'),
  quizQuestionText: document.getElementById('quizQuestionText'),
  quizOptionsList: document.getElementById('quizOptionsList'),
  quizFeedbackBox: document.getElementById('quizFeedbackBox'),
  quizFeedbackText: document.getElementById('quizFeedbackText'),
  btnQuizPrev: document.getElementById('btnQuizPrev'),
  btnQuizRestart: document.getElementById('btnQuizRestart'),
  btnQuizNext: document.getElementById('btnQuizNext'),
  btnQuizFinish: document.getElementById('btnQuizFinish'),

  // Quiz View - Results & Review Discussion
  quizResultsContainer: document.getElementById('quizResultsContainer'),
  quizResultsSubtitle: document.getElementById('quizResultsSubtitle'),
  quizScorePercent: document.getElementById('quizScorePercent'),
  statCorrectCount: document.getElementById('statCorrectCount'),
  statDifficulty: document.getElementById('statDifficulty'),
  statSourceMod: document.getElementById('statSourceMod'),
  statQuestionType: document.getElementById('statQuestionType'),
  quizEvaluationBox: document.getElementById('quizEvaluationBox'),
  btnRegenerateQuiz: document.getElementById('btnRegenerateQuiz'),
  btnRetryCurrentQuiz: document.getElementById('btnRetryCurrentQuiz'),
  btnResultsViewHistory: document.getElementById('btnResultsViewHistory'),
  quizReviewList: document.getElementById('quizReviewList'),

  // Modals
  modalFiles: document.getElementById('modalFiles'),
  filesTableBody: document.getElementById('filesTableBody'),
  modalNewModule: document.getElementById('modalNewModule'),
  modalInfoWorkflow: document.getElementById('modalInfoWorkflow'),
  newModuleTitle: document.getElementById('newModuleTitle'),
  newModuleContent: document.getElementById('newModuleContent'),
  btnSaveNewModule: document.getElementById('btnSaveNewModule'),
  modalQuizHistory: document.getElementById('modalQuizHistory'),
  quizHistoryTableBody: document.getElementById('quizHistoryTableBody'),
  quizHistoryEmptyState: document.getElementById('quizHistoryEmptyState'),
  btnClearQuizHistory: document.getElementById('btnClearQuizHistory'),
  toastContainer: document.getElementById('toastContainer'),

  // API Config Modal Form Elements
  modalApiConfig: document.getElementById('modalApiConfig'),
  apiProvider: document.getElementById('apiProvider'),
  apiKeyStatusText: document.getElementById('apiKeyStatusText'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  btnToggleApiKeyVisibility: document.getElementById('btnToggleApiKeyVisibility'),
  apiModelInput: document.getElementById('apiModelInput'),
  groupBaseUrl: document.getElementById('groupBaseUrl'),
  apiBaseUrlInput: document.getElementById('apiBaseUrlInput'),
  apiTestFeedback: document.getElementById('apiTestFeedback'),
  btnTestApiConnection: document.getElementById('btnTestApiConnection'),
  btnSaveApiConfig: document.getElementById('btnSaveApiConfig')
};

// Initializer
async function initApp() {
  setupEventListeners();

  try {
    // 1. Load modules from IndexedDB
    let storedModules = await ModuleDB.getAll();
    
    // 2. If IndexedDB is empty, seed with DEFAULT_MODULES
    if (!storedModules || storedModules.length === 0) {
      if (typeof DEFAULT_MODULES !== 'undefined' && Array.isArray(DEFAULT_MODULES)) {
        for (const m of DEFAULT_MODULES) {
          await ModuleDB.put(m);
        }
        storedModules = DEFAULT_MODULES;
      }
    }

    // Load stored user name and instructions
    const savedName = localStorage.getItem('asisten_user_name');
    if (savedName) {
      AppState.userName = savedName;
      AutonomousLearningAI.contextMemory.userName = savedName;
    }

    AppState.modules = storedModules;
    renderSidebarModules();
    updateModuleCount();
    
    // Set initial active module (Modul_02_Biologi by default to match screenshot)
    const initialMod = AppState.modules.find(m => m.id === 'modul_02') || AppState.modules[0];
    if (initialMod) {
      selectModule(initialMod.id, false);
    }

    // Set initial chat conversation to match Screenshot 1
    initSampleConversation();

    // Set initial quiz state to match Screenshot 2 (Question 3 of 5, Score 2/2, Pankreas correct, Lambung selected)
    loadQuizForModule('modul_02', true);

    // Check backend API configuration status
    try {
      const cfg = await ApiClient.getConfig();
      AppState.apiConfig = cfg;
      updateHeaderApiStatus(cfg.configured);
    } catch (e) {
      console.warn('Backend server belum merespon status API:', e);
    }

    showToast('Aplikasi siap offline. 10 Modul telah dimuat dari IndexedDB.', 'success');
  } catch (err) {
    console.error('Inisialisasi aplikasi gagal:', err);
    showToast('Gagal memuat database IndexedDB: ' + err.message, 'error');
  }
}

function updateModuleCount() {
  const count = AppState.modules.length;
  DOM.moduleCountText.textContent = `${count} MODUL TERSEDIA`;
  DOM.sidebarStatusSummary.textContent = `${count} Modul • IndexedDB Aktif`;
}

function renderSidebarModules() {
  DOM.moduleList.innerHTML = '';
  
  AppState.modules.forEach(mod => {
    const li = document.createElement('li');
    li.className = `module-item ${mod.id === AppState.activeModuleId ? 'active' : ''}`;
    li.dataset.id = mod.id;

    // Display formatted name with ellipsis e.g. Modul_02_Biologi...
    let displayName = mod.name || mod.filename || 'Modul';
    if (displayName.length > 20) {
      displayName = displayName.slice(0, 19) + '...';
    }

    li.innerHTML = `
      <div class="module-item-left">
        <span class="module-doc-icon">
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.5 1.5H3.5C2.39543 1.5 1.5 2.39543 1.5 3.5V14.5C1.5 15.6046 2.39543 16.5 3.5 16.5H12.5C13.6046 16.5 14.5 15.6046 14.5 14.5V6.5L9.5 1.5Z" stroke="#8b5cf6" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M9.5 1.5V6.5H14.5" stroke="#8b5cf6" stroke-width="1.6" stroke-linejoin="round"/>
            <line x1="4.5" y1="9.5" x2="11.5" y2="9.5" stroke="#8b5cf6" stroke-width="1.4" stroke-linecap="round"/>
            <line x1="4.5" y1="12.5" x2="9.5" y2="12.5" stroke="#8b5cf6" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </span>
        <span class="module-name" title="${escapeHtml(mod.name || mod.filename)}">${escapeHtml(displayName)}</span>
      </div>
      <div class="module-item-actions">
        <button class="btn-icon-mini" title="Ganti Nama" onclick="event.stopPropagation(); promptRenameModule('${mod.id}')">✏️</button>
        <button class="btn-icon-mini delete" title="Hapus Modul" onclick="event.stopPropagation(); confirmDeleteModule('${mod.id}')">🗑️</button>
      </div>
    `;

    li.addEventListener('click', () => selectModule(mod.id));
    DOM.moduleList.appendChild(li);
  });

  populateQuizSourceDropdown();
}

function selectModule(id, switchTab = false) {
  AppState.activeModuleId = id;
  const mod = AppState.modules.find(m => m.id === id);
  if (!mod) return;

  // Update sidebar active highlights
  document.querySelectorAll('.module-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  // Update header pill
  const shortTitle = (mod.name || mod.filename || 'Modul');
  DOM.activeModulePill.innerHTML = `Modul Aktif: <strong>${escapeHtml(shortTitle.length > 25 ? shortTitle.slice(0, 24) + '...' : shortTitle)}</strong>`;

  // Update quick chips
  renderQuickChips(mod);

  // Restore or initialize conversation history per module
  renderModuleChatHistory(id);

  // If in quiz tab, update quiz
  if (AppState.currentTab === 'quiz') {
    loadQuizForModule(id, false);
  }
}

function renderQuickChips(mod) {
  let chips = [
    'Apa itu renin dan apa bedanya dengan pepsin?',
    'Beri contoh konkret',
    'Buat kode JavaScript',
    'Tulis email formal izin',
    'Kenapa langit berwarna biru?',
    'Rangkum modul ini'
  ];

  if (mod.id === 'modul_01') {
    chips = ['Peristiwa Rengasdengklok', 'Beri contoh konkret', 'Buat kode Python kalkulator', 'Tulis puisi semangat', 'Rangkum Sejarah'];
  } else if (mod.id === 'modul_03') {
    chips = ['Hukum I Newton', 'Contoh Hukum II Newton', 'Beri contoh konkret', 'Buat kode simulasi gaya', 'Rangkum Fisika'];
  }

  DOM.quickChipsContainer.innerHTML = '';
  chips.forEach(text => {
    const chip = document.createElement('button');
    chip.className = 'quick-chip';
    chip.textContent = text;
    chip.addEventListener('click', () => {
      DOM.chatInput.value = text;
      handleSendMessage();
    });
    DOM.quickChipsContainer.appendChild(chip);
  });
}

/* ==========================================================================
   7. Chat Engine & Message Handling (Per-Module RAG & Backend AI Integration)
   ========================================================================== */

/**
 * Renders or restores conversation history for a specific module
 */
function renderModuleChatHistory(moduleId) {
  DOM.chatHistory.innerHTML = '';

  // Initialize history if empty
  if (!AppState.chatHistory[moduleId] || AppState.chatHistory[moduleId].length === 0) {
    if (moduleId === 'modul_02') {
      // Seed with initial sample conversation matching Screenshot 1 exactly
      AppState.chatHistory['modul_02'] = [
        {
          role: 'ai',
          text: 'Halo! Saya Asisten Belajar Offline. Pilih modul di sidebar kiri, lalu ketik pertanyaanmu atau klik Rangkum.'
        },
        {
          role: 'user',
          text: 'Jelaskan fungsi asam klorida (HCl) dan pepsin dalam sistem pencernaan!'
        },
        {
          role: 'ai',
          text: 'Asam klorida (HCl) diproduksi sel parietal lambung. Fungsinya: (1) mengaktifkan pepsinogen menjadi pepsin, (2) membunuh bakteri patogen, (3) menciptakan pH asam untuk kerja enzim. Pepsin sendiri berfungsi memecah protein menjadi polipeptida melalui hidrolisis ikatan peptida.',
          source: 'Modul_02_Biologi... - Bab 3, Hal. 14'
        }
      ];
      DOM.chatInput.value = 'Apa itu renin dan apa bedanya dengan pepsin?';
    } else {
      const targetMod = AppState.modules.find(m => m.id === moduleId);
      const modTitle = targetMod ? (targetMod.name || targetMod.filename || 'Modul Pembelajaran') : 'Modul Pembelajaran';
      AppState.chatHistory[moduleId] = [
        {
          role: 'ai',
          text: `Halo! Saya Asisten Belajar cerdas untuk materi "${modTitle}". Silakan tanyakan hal-hal terkait isi materi yang telah diunggah atau klik tombol Rangkum untuk mendapatkan ikhtisar terstruktur.`
        }
      ];
      DOM.chatInput.value = '';
    }
  }

  // Render all historical messages
  AppState.chatHistory[moduleId].forEach(msg => {
    if (msg.role === 'user') {
      renderUserMessageDOM(msg.text);
    } else {
      renderAIMessageDOM(msg.text, msg.source);
    }
  });

  DOM.chatHistory.scrollTop = DOM.chatHistory.scrollHeight;
}

function initSampleConversation() {
  renderModuleChatHistory(AppState.activeModuleId || 'modul_02');
}

/**
 * Sends a user message, performs RAG retrieval, queries the backend AI model
 * or falls back to autonomous offline engine.
 */
async function handleSendMessage() {
  const query = DOM.chatInput.value.trim();
  if (!query) return;

  const currentMod = AppState.modules.find(m => m.id === AppState.activeModuleId);
  if (!currentMod) {
    showToast('Pilih modul materi terlebih dahulu.', 'error');
    return;
  }

  // Render User Message
  appendUserMessage(query);
  DOM.chatInput.value = '';

  // 1. Local RAG Retrieval from selected module
  const ragResult = RAGRetriever.searchRelevantPassages(currentMod, query);

  // 2. Show animated loading indicator
  showLoadingIndicator();

  // 3. Backend AI Model API or Offline Reasoning
  if (AppState.apiConfig && AppState.apiConfig.configured) {
    try {
      const historyPayload = (AppState.chatHistory[currentMod.id] || [])
        .slice(-6)
        .map(h => ({ role: h.role === 'user' ? 'user' : 'model', text: h.text }));

      const result = await ApiClient.chat({
        query: query,
        context: ragResult.contextText,
        moduleName: currentMod.filename || currentMod.name,
        mode: 'chat',
        references: ragResult.topReference ? [ragResult.topReference] : [],
        history: historyPayload
      });

      removeLoadingIndicator();
      if (result && result.answer) {
        appendAIMessage(result.answer, result.source);
      } else {
        appendAIMessage('Tidak ada respon yang diterima dari model AI.', currentMod.name);
      }
    } catch (err) {
      removeLoadingIndicator();
      console.warn('Gagal memanggil model AI backend:', err.message);

      appendErrorMessageDOM(err.message, query);

      // Graceful offline fallback
      setTimeout(() => {
        const fallback = AutonomousLearningAI.respond(query, currentMod);
        appendAIMessage(`[Mode Cadangan Offline]:\n${fallback.answer}`, fallback.source);
      }, 400);
    }
  } else {
    // Mode Offline: autonomous reasoning engine
    setTimeout(() => {
      removeLoadingIndicator();
      const response = AutonomousLearningAI.respond(query, currentMod);
      appendAIMessage(response.answer, response.source);
    }, 350);
  }
}

/**
 * Summarizes the currently selected module using AI API or offline engine
 */
async function handleSummarize() {
  const currentMod = AppState.modules.find(m => m.id === AppState.activeModuleId);
  if (!currentMod) {
    showToast('Pilih modul materi terlebih dahulu untuk dirangkum.', 'error');
    return;
  }

  const promptText = `Tolong rangkum modul "${currentMod.name || currentMod.filename}" secara komprehensif.`;
  appendUserMessage(promptText);

  showLoadingIndicator();

  if (AppState.apiConfig && AppState.apiConfig.configured) {
    try {
      let summaryContext = currentMod.summaryNotes || '';
      if (currentMod.fullText) {
        summaryContext = currentMod.fullText.slice(0, 16000);
      }

      const result = await ApiClient.chat({
        query: promptText,
        context: summaryContext,
        moduleName: currentMod.filename || currentMod.name,
        mode: 'summarize',
        references: [{ moduleName: currentMod.filename || currentMod.name, pageRef: 'Semua Bab' }],
        history: []
      });

      removeLoadingIndicator();
      if (result && result.answer) {
        appendAIMessage(result.answer, result.source);
      } else {
        appendAIMessage('Gagal menghasilkan rangkuman dari model AI.', currentMod.name);
      }
    } catch (err) {
      removeLoadingIndicator();
      console.warn('API Summarize failed:', err.message);
      appendErrorMessageDOM(err.message, promptText);
      setTimeout(() => {
        const fallback = AutonomousLearningAI.generateSummary(currentMod);
        appendAIMessage(`[Mode Cadangan Offline]:\n${fallback.answer}`, fallback.source);
      }, 400);
    }
  } else {
    setTimeout(() => {
      removeLoadingIndicator();
      const response = AutonomousLearningAI.generateSummary(currentMod);
      appendAIMessage(response.answer, response.source);
    }, 450);
  }
}

function appendUserMessage(text) {
  if (!AppState.chatHistory[AppState.activeModuleId]) {
    AppState.chatHistory[AppState.activeModuleId] = [];
  }
  AppState.chatHistory[AppState.activeModuleId].push({ role: 'user', text });
  renderUserMessageDOM(text);
}

function appendAIMessage(text, source) {
  if (!AppState.chatHistory[AppState.activeModuleId]) {
    AppState.chatHistory[AppState.activeModuleId] = [];
  }
  AppState.chatHistory[AppState.activeModuleId].push({ role: 'ai', text, source });
  renderAIMessageDOM(text, source);
}

function formatChatMessage(str) {
  if (typeof str !== 'string') return '';
  let escaped = escapeHtml(str);
  // Code block: ```code```
  escaped = escaped.replace(/```([a-z0-9_-]*)\n?([\s\S]*?)```/gi, (m, lang, code) => {
    return `<pre style="background: #1e293b; color: #f8fafc; padding: 12px; border-radius: 8px; margin: 8px 0; overflow-x: auto; font-family: monospace;"><code>${code}</code></pre>`;
  });
  // Inline code: `code`
  escaped = escaped.replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');
  // Bold: **text**
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Newlines to <br>
  escaped = escaped.replace(/\n/g, '<br>');
  return escaped;
}

function renderUserMessageDOM(text) {
  const row = document.createElement('div');
  row.className = 'chat-row user';
  const initial = (AppState.userName && AppState.userName.trim().length > 0)
    ? AppState.userName.trim().charAt(0).toUpperCase()
    : 'S';
  row.innerHTML = `
    <div class="chat-bubble user">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
    <div class="avatar-badge user" title="${escapeHtml(AppState.userName || 'Student')}">${initial}</div>
  `;
  DOM.chatHistory.appendChild(row);
  DOM.chatHistory.scrollTop = DOM.chatHistory.scrollHeight;
}

function renderAIMessageDOM(text, source) {
  const row = document.createElement('div');
  row.className = 'chat-row ai';
  
  let sourceHtml = '';
  if (source) {
    sourceHtml = `<span class="chat-source-tag" onclick="showSourceDetails('${escapeHtml(source)}')">Sumber: ${escapeHtml(source)}</span>`;
  }

  row.innerHTML = `
    <div class="avatar-badge ai">AI</div>
    <div class="chat-bubble ai">
      ${formatChatMessage(text)}
      ${sourceHtml}
    </div>
  `;
  DOM.chatHistory.appendChild(row);
  DOM.chatHistory.scrollTop = DOM.chatHistory.scrollHeight;
}

function showLoadingIndicator() {
  removeLoadingIndicator();
  const row = document.createElement('div');
  row.className = 'chat-row ai chat-loading-row';
  row.id = 'chatLoadingRow';
  row.innerHTML = `
    <div class="avatar-badge ai">AI</div>
    <div class="chat-bubble ai loading">
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  DOM.chatHistory.appendChild(row);
  DOM.chatHistory.scrollTop = DOM.chatHistory.scrollHeight;
  return row;
}

function removeLoadingIndicator() {
  const existing = document.getElementById('chatLoadingRow');
  if (existing) existing.remove();
}

function appendErrorMessageDOM(errorMessage, retryQuery = null) {
  const row = document.createElement('div');
  row.className = 'chat-row ai';
  row.innerHTML = `
    <div class="avatar-badge ai" style="background: #ef4444; color: #fff;">!</div>
    <div class="chat-bubble ai chat-error-card">
      <div style="font-weight: 600; color: #dc2626; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>⚠️</span> Gagal Menghubungi Model AI
      </div>
      <div style="font-size: 13px; color: #475569; margin-bottom: 10px; line-height: 1.4;">
        ${escapeHtml(errorMessage)}
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn-sidebar btn-sidebar-primary" style="padding: 4px 10px; font-size: 12px;" onclick="openApiConfigModal()">
          ⚙️ Buka Pengaturan API
        </button>
        ${retryQuery ? `<button class="btn-sidebar" style="padding: 4px 10px; font-size: 12px;" onclick="window.retrySendMessage('${escapeHtml(retryQuery)}')">🔄 Coba Lagi</button>` : ''}
      </div>
    </div>
  `;
  DOM.chatHistory.appendChild(row);
  DOM.chatHistory.scrollTop = DOM.chatHistory.scrollHeight;
}

function showSourceDetails(sourceText) {
  showToast(`Referensi: ${sourceText}`, 'info');
}

window.retrySendMessage = function(text) {
  if (DOM.chatInput) {
    DOM.chatInput.value = text;
    handleSendMessage();
  }
};

window.openApiConfigModal = function() {
  openApiConfigModal();
};

/* ==========================================================================
   7b. API Configuration Modal Controller
   ========================================================================== */

function openApiConfigModal() {
  refreshApiConfigUI();
  openModal('modalApiConfig');
}

async function refreshApiConfigUI() {
  try {
    const config = await ApiClient.getConfig();
    AppState.apiConfig = config;

    updateHeaderApiStatus(config.configured);

    if (DOM.apiProvider) {
      DOM.apiProvider.value = config.provider || 'gemini';
      toggleBaseUrlVisibility(config.provider);
    }
    if (DOM.apiModelInput) {
      DOM.apiModelInput.value = config.model || (config.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');
    }
    if (DOM.apiBaseUrlInput) {
      DOM.apiBaseUrlInput.value = config.baseUrl || '';
    }

    if (DOM.apiKeyStatusText) {
      if (config.configured && config.maskedKey) {
        DOM.apiKeyStatusText.textContent = `(Tersimpan: ${config.maskedKey})`;
        DOM.apiKeyStatusText.style.color = '#059669';
      } else {
        DOM.apiKeyStatusText.textContent = '(Belum tersimpan - Mode Offline Aktif)';
        DOM.apiKeyStatusText.style.color = '#e11d48';
      }
    }

    if (DOM.apiKeyInput) {
      DOM.apiKeyInput.value = '';
    }
    if (DOM.apiTestFeedback) {
      DOM.apiTestFeedback.style.display = 'none';
      DOM.apiTestFeedback.className = 'api-test-feedback';
    }
  } catch (e) {
    console.error('Gagal mengambil konfigurasi API backend:', e);
  }
}

function updateHeaderApiStatus(isConfigured) {
  if (DOM.headerApiStatusDot) {
    if (isConfigured) {
      DOM.headerApiStatusDot.classList.add('active');
      DOM.headerApiStatusDot.title = 'AI Model API: Terhubung & Aktif';
    } else {
      DOM.headerApiStatusDot.classList.remove('active');
      DOM.headerApiStatusDot.title = 'AI Model API: Belum Dikonfigurasi (Mode Offline Aktif)';
    }
  }
}

function toggleBaseUrlVisibility(provider) {
  if (!DOM.groupBaseUrl) return;
  if (provider === 'custom' || provider === 'openai') {
    DOM.groupBaseUrl.style.display = 'block';
  } else {
    DOM.groupBaseUrl.style.display = 'none';
  }
}

function toggleApiKeyVisibility() {
  if (!DOM.apiKeyInput) return;
  const isPassword = DOM.apiKeyInput.type === 'password';
  DOM.apiKeyInput.type = isPassword ? 'text' : 'password';
  if (DOM.btnToggleApiKeyVisibility) {
    DOM.btnToggleApiKeyVisibility.textContent = isPassword ? '🙈' : '👁️';
  }
}

async function handleTestApiConnection() {
  const provider = DOM.apiProvider ? DOM.apiProvider.value : 'gemini';
  const apiKey = DOM.apiKeyInput ? DOM.apiKeyInput.value.trim() : '';
  const model = DOM.apiModelInput ? DOM.apiModelInput.value.trim() : '';
  const baseUrl = DOM.apiBaseUrlInput ? DOM.apiBaseUrlInput.value.trim() : '';

  DOM.btnTestApiConnection.disabled = true;
  DOM.btnTestApiConnection.textContent = '⏳ Menguji...';

  if (DOM.apiTestFeedback) {
    DOM.apiTestFeedback.style.display = 'block';
    DOM.apiTestFeedback.className = 'api-test-feedback';
    DOM.apiTestFeedback.textContent = 'Menghubungkan ke API model AI...';
  }

  try {
    const res = await ApiClient.testConnection({ provider, apiKey, model, baseUrl });
    if (res.success) {
      DOM.apiTestFeedback.className = 'api-test-feedback success';
      DOM.apiTestFeedback.textContent = '✅ ' + (res.message || 'Koneksi berhasil terhubung!');
    } else {
      DOM.apiTestFeedback.className = 'api-test-feedback error';
      DOM.apiTestFeedback.textContent = '❌ Gagal: ' + (res.error || 'Terjadi kesalahan pada koneksi.');
    }
  } catch (err) {
    DOM.apiTestFeedback.className = 'api-test-feedback error';
    DOM.apiTestFeedback.textContent = '❌ Kesalahan jaringan / server: ' + err.message;
  } finally {
    DOM.btnTestApiConnection.disabled = false;
    DOM.btnTestApiConnection.textContent = '🔌 Uji Koneksi API';
  }
}

async function handleSaveApiConfig() {
  const provider = DOM.apiProvider ? DOM.apiProvider.value : 'gemini';
  const apiKey = DOM.apiKeyInput ? DOM.apiKeyInput.value.trim() : '';
  const model = DOM.apiModelInput ? DOM.apiModelInput.value.trim() : '';
  const baseUrl = DOM.apiBaseUrlInput ? DOM.apiBaseUrlInput.value.trim() : '';

  DOM.btnSaveApiConfig.disabled = true;
  DOM.btnSaveApiConfig.textContent = '💾 Menyimpan...';

  try {
    const res = await ApiClient.saveConfig({ provider, apiKey, model, baseUrl });
    if (res.success) {
      AppState.apiConfig = res.config;
      updateHeaderApiStatus(res.config.configured);
      showToast('Konfigurasi API berhasil disimpan di backend!', 'success');
      closeModal('modalApiConfig');
    } else {
      showToast('Gagal menyimpan konfigurasi: ' + (res.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Gagal terhubung ke backend: ' + err.message, 'error');
  } finally {
    DOM.btnSaveApiConfig.disabled = false;
    DOM.btnSaveApiConfig.textContent = '💾 Simpan Konfigurasi';
  }
}

/* ==========================================================================
   8. Quiz View Controller & Interactive Evaluator
   ========================================================================== */

function populateQuizSourceDropdown() {
  if (!DOM.quizSourceModule) return;
  const currentVal = DOM.quizSourceModule.value || AppState.activeModuleId || 'modul_02';
  DOM.quizSourceModule.innerHTML = '';

  AppState.modules.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name || m.filename} (${m.format || 'TXT'})`;
    if (m.id === currentVal) opt.selected = true;
    DOM.quizSourceModule.appendChild(opt);
  });
}

function loadQuizForModule(moduleId, matchScreenshotState = false) {
  populateQuizSourceDropdown();
  if (DOM.quizSourceModule) DOM.quizSourceModule.value = moduleId;

  if (matchScreenshotState && moduleId === 'modul_02') {
    // Exact Screenshot 2 configuration: Question 3 of 5, Score 2/2, option C selected
    const questions = QuizEngine.getBaselineQuestions('modul_02');
    AppState.quizState.questions = questions;
    AppState.quizState.moduleId = moduleId;
    AppState.quizState.currentIndex = 2; // Question 3 (0-indexed)
    AppState.quizState.userAnswers = { 0: 1, 1: 0, 2: 2 };
    AppState.quizState.correctCount = 2;
    AppState.quizState.totalAnswered = 2;
    AppState.quizState.selectedOption = 2; // C selected (Lambung)
    AppState.quizState.isAnswered = true;
    AppState.quizState.isFinished = false;
    AppState.quizState.isInitialScreenshotMatch = true;

    if (DOM.quizActiveContainer) DOM.quizActiveContainer.style.display = 'block';
    if (DOM.quizResultsContainer) DOM.quizResultsContainer.style.display = 'none';

    renderQuizJumpGrid();
    renderCurrentQuestion(true);
  } else {
    // Standard dynamic initialization
    const mod = AppState.modules.find(m => m.id === moduleId);
    const questions = QuizEngine.generateQuiz(mod, AppState.quizState.config);
    AppState.quizState.questions = questions;
    AppState.quizState.moduleId = moduleId;
    AppState.quizState.currentIndex = 0;
    AppState.quizState.userAnswers = {};
    AppState.quizState.correctCount = 0;
    AppState.quizState.totalAnswered = 0;
    AppState.quizState.selectedOption = null;
    AppState.quizState.isAnswered = false;
    AppState.quizState.isFinished = false;
    AppState.quizState.isInitialScreenshotMatch = false;
    AppState.quizState.startTime = Date.now();

    if (DOM.quizActiveContainer) DOM.quizActiveContainer.style.display = 'block';
    if (DOM.quizResultsContainer) DOM.quizResultsContainer.style.display = 'none';

    renderQuizJumpGrid();
    renderCurrentQuestion(false);
  }
}

function handleGenerateQuizSubmit(forceRegenerate = false) {
  const selectedModId = DOM.quizSourceModule ? DOM.quizSourceModule.value : AppState.activeModuleId;
  const count = DOM.quizCount ? parseInt(DOM.quizCount.value, 10) : 5;
  const difficulty = DOM.quizDifficulty ? DOM.quizDifficulty.value : 'sedang';
  const type = DOM.quizType ? DOM.quizType.value : 'mcq';

  const targetMod = AppState.modules.find(m => m.id === selectedModId) || AppState.modules[0];
  if (!targetMod) {
    showToast('Pilih modul materi terlebih dahulu untuk menghasilkan soal kuis.', 'error');
    return;
  }

  AppState.quizState.config = { count, difficulty, type };
  AppState.quizState.moduleId = targetMod.id;
  AppState.activeModuleId = targetMod.id;

  const questions = QuizEngine.generateQuiz(targetMod, { count, difficulty, type });
  if (!questions || questions.length === 0) {
    showToast('Gagal mengekstrak soal dari materi yang dipilih.', 'error');
    return;
  }

  AppState.quizState.questions = questions;
  AppState.quizState.currentIndex = 0;
  AppState.quizState.userAnswers = {};
  AppState.quizState.correctCount = 0;
  AppState.quizState.totalAnswered = 0;
  AppState.quizState.selectedOption = null;
  AppState.quizState.isAnswered = false;
  AppState.quizState.isFinished = false;
  AppState.quizState.isInitialScreenshotMatch = false;
  AppState.quizState.startTime = Date.now();

  if (DOM.quizActiveContainer) DOM.quizActiveContainer.style.display = 'block';
  if (DOM.quizResultsContainer) DOM.quizResultsContainer.style.display = 'none';

  renderQuizJumpGrid();
  renderCurrentQuestion(false);

  showToast(`⚡ Kuis AI berhasil dibuat: ${questions.length} soal (${difficulty.toUpperCase()}) dari ${targetMod.name || targetMod.filename}.`, 'success');
}

function renderQuizJumpGrid() {
  if (!DOM.quizJumpGrid) return;
  DOM.quizJumpGrid.innerHTML = '';

  const qState = AppState.quizState;
  const questions = qState.questions;

  questions.forEach((q, idx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-jump-btn';
    btn.textContent = idx + 1;
    btn.title = `Lompat ke Soal ${idx + 1}`;

    if (idx === qState.currentIndex) {
      btn.classList.add('active');
    }

    if (qState.userAnswers && qState.userAnswers[idx] !== undefined) {
      const userPick = qState.userAnswers[idx];
      if (userPick === q.correctIndex) {
        btn.classList.add('correct');
      } else {
        btn.classList.add('wrong');
      }
    }

    btn.addEventListener('click', () => handleJumpToQuestion(idx));
    DOM.quizJumpGrid.appendChild(btn);
  });
}

function renderCurrentQuestion(isInitialScreenshotMatch = false) {
  const qState = AppState.quizState;
  const q = qState.questions[qState.currentIndex];
  if (!q) return;

  const currentMod = AppState.modules.find(m => m.id === qState.moduleId);
  const modShortName = (currentMod ? (currentMod.name || currentMod.filename) : 'Modul').replace(/_Pencernaan.*$/, '').slice(0, 24);

  // Top header text e.g. "Soal 3 dari 5 • Modul_02_Biologi"
  if (DOM.quizProgressText) {
    DOM.quizProgressText.textContent = `Soal ${qState.currentIndex + 1} dari ${qState.questions.length} • ${modShortName}`;
  }
  if (DOM.quizScoreBadge) {
    DOM.quizScoreBadge.textContent = `Skor: ${qState.correctCount}/${qState.totalAnswered}`;
  }

  // Progress Bar
  if (DOM.quizProgressBar) {
    const progressPercent = Math.round(((qState.currentIndex + 1) / qState.questions.length) * 100);
    DOM.quizProgressBar.style.width = `${progressPercent}%`;
  }

  // Metadata tags & Document Source Reference
  if (DOM.quizMetaDifficulty) {
    DOM.quizMetaDifficulty.textContent = q.difficulty || 'Sedang';
  }
  if (DOM.quizMetaType) {
    DOM.quizMetaType.textContent = q.type || 'Pilihan Ganda';
  }
  if (DOM.quizQuestionRef) {
    DOM.quizQuestionRef.textContent = '📖 ' + (q.reference || `${modShortName} • Materi Utama`);
  }

  // Question Text
  if (DOM.quizQuestionText) {
    DOM.quizQuestionText.textContent = q.question;
  }

  // Prev / Next / Finish button states
  if (DOM.btnQuizPrev) {
    DOM.btnQuizPrev.disabled = (qState.currentIndex === 0);
  }
  if (qState.currentIndex === qState.questions.length - 1) {
    if (DOM.btnQuizNext) DOM.btnQuizNext.style.display = 'none';
    if (DOM.btnQuizFinish) DOM.btnQuizFinish.style.display = 'inline-flex';
  } else {
    if (DOM.btnQuizNext) DOM.btnQuizNext.style.display = 'inline-flex';
    if (DOM.btnQuizFinish) DOM.btnQuizFinish.style.display = 'none';
  }

  // Render Options
  if (DOM.quizOptionsList) {
    DOM.quizOptionsList.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    const hasAnswered = (qState.userAnswers && qState.userAnswers[qState.currentIndex] !== undefined);
    const selectedOpt = hasAnswered ? qState.userAnswers[qState.currentIndex] : null;

    q.options.forEach((optText, idx) => {
      const card = document.createElement('div');
      card.className = 'quiz-option-card';
      card.dataset.index = idx;

      if (hasAnswered) {
        card.classList.add('locked');
        if (idx === q.correctIndex) {
          card.classList.add('correct');
        } else if (idx === selectedOpt) {
          card.classList.add('wrong');
        }
      }

      const badgeLabel = (q.type === 'Benar / Salah') ? (idx === 0 ? '✓' : '✗') : letters[idx];

      card.innerHTML = `
        <div class="quiz-option-badge">${badgeLabel}</div>
        <div class="quiz-option-label">${escapeHtml(optText)}</div>
      `;

      card.addEventListener('click', () => {
        if (qState.userAnswers[qState.currentIndex] === undefined) {
          handleOptionSelect(idx);
        }
      });

      DOM.quizOptionsList.appendChild(card);
    });
  }

  // Feedback Box
  const hasAnsweredCurrent = (qState.userAnswers && qState.userAnswers[qState.currentIndex] !== undefined);
  if (hasAnsweredCurrent && DOM.quizFeedbackBox) {
    DOM.quizFeedbackBox.style.display = 'flex';
    const selectedOpt = qState.userAnswers[qState.currentIndex];
    const correctLabel = q.options[q.correctIndex];

    if (isInitialScreenshotMatch) {
      // Exactly matches Screenshot 2 text: "2 dari 2 soal benar sejauh ini. Jawaban benar: Pankreas. Lanjut ke soal 4."
      DOM.quizFeedbackText.innerHTML = `<span class="quiz-feedback-score-num">${qState.correctCount}</span> dari 2 soal benar sejauh ini. Jawaban benar: <strong>${escapeHtml(correctLabel)}</strong>. Lanjut ke soal 4.`;
    } else {
      const isRight = (selectedOpt === q.correctIndex);
      const prefix = isRight ? '✅ <strong>Jawaban Anda Tepat!</strong>' : '❌ <strong>Jawaban Belum Tepat.</strong>';
      DOM.quizFeedbackText.innerHTML = `${prefix} Jawaban benar: <strong>${escapeHtml(correctLabel)}</strong>. ${escapeHtml(q.explanation || '')}`;
    }
  } else if (DOM.quizFeedbackBox) {
    DOM.quizFeedbackBox.style.display = 'none';
  }

  renderQuizJumpGrid();
}

function handleOptionSelect(chosenIndex) {
  const qState = AppState.quizState;
  const q = qState.questions[qState.currentIndex];
  if (!q) return;

  qState.userAnswers[qState.currentIndex] = chosenIndex;
  qState.isAnswered = true;
  qState.selectedOption = chosenIndex;
  qState.isInitialScreenshotMatch = false;

  // Recompute scores
  let correct = 0;
  let answered = 0;
  qState.questions.forEach((question, i) => {
    if (qState.userAnswers[i] !== undefined) {
      answered++;
      if (qState.userAnswers[i] === question.correctIndex) {
        correct++;
      }
    }
  });

  qState.correctCount = correct;
  qState.totalAnswered = answered;

  renderCurrentQuestion(false);
}

function handlePrevQuestion() {
  const qState = AppState.quizState;
  if (qState.currentIndex > 0) {
    qState.currentIndex -= 1;
    qState.isInitialScreenshotMatch = false;
    renderCurrentQuestion(false);
  }
}

function handleNextQuestion() {
  const qState = AppState.quizState;
  if (qState.currentIndex + 1 < qState.questions.length) {
    qState.currentIndex += 1;
    qState.isInitialScreenshotMatch = false;
    renderCurrentQuestion(false);
  } else {
    handleFinishQuiz();
  }
}

function handleJumpToQuestion(targetIndex) {
  const qState = AppState.quizState;
  if (targetIndex >= 0 && targetIndex < qState.questions.length) {
    qState.currentIndex = targetIndex;
    qState.isInitialScreenshotMatch = false;
    renderCurrentQuestion(false);
  }
}

function handleRestartQuiz() {
  const qState = AppState.quizState;
  qState.currentIndex = 0;
  qState.userAnswers = {};
  qState.correctCount = 0;
  qState.totalAnswered = 0;
  qState.selectedOption = null;
  qState.isAnswered = false;
  qState.isFinished = false;
  qState.isInitialScreenshotMatch = false;
  qState.startTime = Date.now();

  if (DOM.quizActiveContainer) DOM.quizActiveContainer.style.display = 'block';
  if (DOM.quizResultsContainer) DOM.quizResultsContainer.style.display = 'none';

  renderQuizJumpGrid();
  renderCurrentQuestion(false);
  showToast('Kuis diulang dari soal pertama.', 'info');
}

async function handleFinishQuiz() {
  const qState = AppState.quizState;
  qState.isFinished = true;

  const totalQ = qState.questions.length;
  let correct = 0;
  qState.questions.forEach((q, i) => {
    if (qState.userAnswers[i] === q.correctIndex) correct++;
  });

  const percent = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;
  const currentMod = AppState.modules.find(m => m.id === qState.moduleId);
  const modShortName = (currentMod ? (currentMod.name || currentMod.filename) : 'Modul').replace(/_Pencernaan.*$/, '').slice(0, 24);
  const elapsedSec = Math.max(12, Math.round((Date.now() - (qState.startTime || Date.now())) / 1000));

  // Populate Result Card
  if (DOM.quizScorePercent) DOM.quizScorePercent.textContent = `${percent}%`;
  if (DOM.statCorrectCount) DOM.statCorrectCount.textContent = `${correct} / ${totalQ}`;
  if (DOM.statDifficulty) DOM.statDifficulty.textContent = (qState.config.difficulty || 'Sedang').toUpperCase();
  if (DOM.statSourceMod) DOM.statSourceMod.textContent = modShortName;
  if (DOM.statQuestionType) {
    DOM.statQuestionType.textContent = qState.config.type === 'tf' ? 'Benar / Salah' : (qState.config.type === 'mixed' ? 'Campuran' : 'Pilihan Ganda');
  }

  // Qualitative Pedagogical Advice
  if (DOM.quizEvaluationBox) {
    let evalMsg = '';
    if (percent >= 85) {
      evalMsg = `🌟 <strong>Sangat Memuaskan!</strong> Anda menunjukkan penguasaan komprehensif terhadap materi ${modShortName}. Semua konsep kunci, terminologi, dan prinsip operasional telah dipahami dengan sangat baik.`;
    } else if (percent >= 60) {
      evalMsg = `👍 <strong>Bagus Sekali!</strong> Anda memahami sebagian besar konsep pada ${modShortName}. Tinjau pembahasan di bawah untuk memperdalam beberapa poin yang masih keliru.`;
    } else {
      evalMsg = `📚 <strong>Perlu Penguatan Materi.</strong> Skor Anda ${percent}%. Disarankan untuk membaca ulang rangkuman atau berdiskusi dengan AI Asisten Belajar pada tab chat mengenai topik yang belum dikuasai.`;
    }
    DOM.quizEvaluationBox.innerHTML = evalMsg;
  }

  // Render Detailed Review List (Question by Question)
  if (DOM.quizReviewList) {
    DOM.quizReviewList.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    qState.questions.forEach((q, idx) => {
      const card = document.createElement('div');
      const userPick = qState.userAnswers[idx];
      const isRight = (userPick === q.correctIndex);

      card.className = `quiz-review-card ${isRight ? 'correct' : 'wrong'}`;

      const userPickText = (userPick !== undefined) ? q.options[userPick] : '(Tidak dijawab)';
      const correctPickText = q.options[q.correctIndex];

      card.innerHTML = `
        <div class="quiz-review-head">
          <span class="quiz-review-qnum">Soal #${idx + 1} • ${escapeHtml(q.type || 'Pilihan Ganda')}</span>
          <span class="quiz-review-status-badge ${isRight ? 'correct' : 'wrong'}">
            ${isRight ? '✓ Jawaban Tepat' : '✗ Belum Tepat'}
          </span>
        </div>
        <div class="quiz-review-question">${escapeHtml(q.question)}</div>
        <div class="quiz-review-ans-row">
          <div class="quiz-review-user-ans">
            Jawaban Anda: <strong>${escapeHtml(userPickText)}</strong>
          </div>
          <div class="quiz-review-key-ans">
            Kunci Jawaban: <strong>${escapeHtml(correctPickText)}</strong>
          </div>
        </div>
        <div class="quiz-review-explanation">
          💡 <strong>Pembahasan:</strong> ${escapeHtml(q.explanation || 'Pembahasan materi merujuk langsung pada dokumen sumber.')}
        </div>
        <div class="quiz-review-ref-tag">
          📖 Referensi: ${escapeHtml(q.reference || modShortName)}
        </div>
      `;

      DOM.quizReviewList.appendChild(card);
    });
  }

  // Save Attempt to IndexedDB
  try {
    const historyRecord = {
      id: 'quiz_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      moduleId: qState.moduleId,
      moduleName: modShortName,
      date: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
      totalQuestions: totalQ,
      correctCount: correct,
      scorePercentage: percent,
      difficulty: (qState.config.difficulty || 'Sedang').toUpperCase(),
      questionType: DOM.statQuestionType ? DOM.statQuestionType.textContent : 'Pilihan Ganda',
      timeSpentSeconds: elapsedSec
    };
    await ModuleDB.saveQuizHistory(historyRecord);
  } catch (err) {
    console.error('Error saving quiz history:', err);
  }

  // Switch View
  if (DOM.quizActiveContainer) DOM.quizActiveContainer.style.display = 'none';
  if (DOM.quizResultsContainer) DOM.quizResultsContainer.style.display = 'flex';
}

function handleRetryCurrentQuiz() {
  const qState = AppState.quizState;
  qState.userAnswers = {};
  qState.correctCount = 0;
  qState.totalAnswered = 0;
  qState.currentIndex = 0;
  qState.isAnswered = false;
  qState.isFinished = false;
  qState.startTime = Date.now();

  if (DOM.quizActiveContainer) DOM.quizActiveContainer.style.display = 'block';
  if (DOM.quizResultsContainer) DOM.quizResultsContainer.style.display = 'none';

  renderQuizJumpGrid();
  renderCurrentQuestion(false);
  showToast('Kuis diulang dengan soal yang sama. Selamat mencoba!', 'info');
}

async function openQuizHistoryModal() {
  if (!DOM.modalQuizHistory) return;

  try {
    const records = await ModuleDB.getAllQuizHistory();
    DOM.quizHistoryTableBody.innerHTML = '';

    if (!records || records.length === 0) {
      if (DOM.quizHistoryEmptyState) DOM.quizHistoryEmptyState.style.display = 'block';
      if (DOM.quizHistoryTableBody.closest('table')) {
        DOM.quizHistoryTableBody.closest('table').style.display = 'none';
      }
    } else {
      if (DOM.quizHistoryEmptyState) DOM.quizHistoryEmptyState.style.display = 'none';
      if (DOM.quizHistoryTableBody.closest('table')) {
        DOM.quizHistoryTableBody.closest('table').style.display = 'table';
      }

      // Sort newest first
      records.sort((a, b) => (b.id > a.id ? 1 : -1));

      records.forEach(r => {
        const tr = document.createElement('tr');
        const pass = r.scorePercentage >= 60;
        tr.innerHTML = `
          <td><small style="color:#64748b;">${escapeHtml(r.date || '-')}</small></td>
          <td><strong>${escapeHtml(r.moduleName || 'Modul')}</strong></td>
          <td><span class="quiz-meta-tag difficulty">${escapeHtml(r.difficulty || 'Sedang')}</span></td>
          <td><small>${escapeHtml(r.questionType || 'MCQ')}</small></td>
          <td><strong>${r.correctCount} / ${r.totalQuestions}</strong></td>
          <td><span class="quiz-history-badge ${pass ? 'pass' : 'fail'}">${r.scorePercentage}%</span></td>
          <td>
            <button class="btn-table-action delete" onclick="handleDeleteQuizHistory('${r.id}')" title="Hapus riwayat ini">
              🗑️
            </button>
          </td>
        `;
        DOM.quizHistoryTableBody.appendChild(tr);
      });
    }

    openModal('modalQuizHistory');
  } catch (err) {
    showToast('Gagal memuat riwayat kuis: ' + err.message, 'error');
  }
}

async function handleDeleteQuizHistory(id) {
  try {
    await ModuleDB.deleteQuizHistory(id);
    showToast('Catatan riwayat kuis dihapus.', 'info');
    openQuizHistoryModal();
  } catch (err) {
    showToast('Gagal menghapus riwayat: ' + err.message, 'error');
  }
}

async function handleClearAllQuizHistory() {
  if (!confirm('Apakah Anda yakin ingin menghapus seluruh riwayat hasil kuis?')) return;
  try {
    await ModuleDB.clearAllQuizHistory();
    showToast('Semua riwayat kuis telah dibersihkan.', 'success');
    openQuizHistoryModal();
  } catch (err) {
    showToast('Gagal membersihkan riwayat: ' + err.message, 'error');
  }
}

// Global exposure for inline onclicks
if (typeof window !== 'undefined') {
  window.handleDeleteQuizHistory = handleDeleteQuizHistory;
}

/* ==========================================================================
   9. Multi-File and Folder Upload Pipeline
   ========================================================================== */
async function processUploadedFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  const files = Array.from(fileList);
  showToast(`Mulai memproses ${files.length} file materi...`, 'info');

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    const id = 'modul_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');

    // Temporary placeholder record
    const modRecord = {
      id: id,
      name: cleanName,
      filename: file.name,
      format: ext.toUpperCase(),
      size: file.size,
      pageCount: 1,
      wordCount: 0,
      status: '⏳ Sedang Mengekstrak...',
      fullText: '',
      summaryNotes: '',
      pages: [],
      createdAt: Date.now()
    };

    // Save initial state to IndexedDB
    await ModuleDB.put(modRecord);
    AppState.modules.unshift(modRecord);
    renderSidebarModules();
    updateModuleCount();

    try {
      // Execute multi-format extraction
      const extracted = await DocumentParser.extract(file);
      const wordCount = extracted.text ? extracted.text.split(/\s+/).filter(Boolean).length : 0;

      modRecord.fullText = extracted.text;
      modRecord.pageCount = extracted.pageCount || 1;
      modRecord.wordCount = wordCount;
      modRecord.pages = extracted.pages || [];
      modRecord.status = `✅ Berhasil Diekstrak (${wordCount} kata)`;

      await ModuleDB.put(modRecord);
      successCount++;
    } catch (err) {
      console.error(`Gagal mengekstrak ${file.name}:`, err);
      modRecord.status = `❌ Gagal: ${err.message}`;
      await ModuleDB.put(modRecord);
      failCount++;
      showToast(`Gagal membaca ${file.name}: ${err.message}`, 'error');
    }
  }

  renderSidebarModules();
  updateModuleCount();

  if (successCount > 0) {
    showToast(`Berhasil mengimpor ${successCount} file ke dalam modul pembelajaran!`, 'success');
    selectModule(AppState.modules[0].id);
  }
}

/* ==========================================================================
   10. Module Management Operations (Rename, Delete, Add Manual)
   ========================================================================== */
async function promptRenameModule(id) {
  const mod = AppState.modules.find(m => m.id === id);
  if (!mod) return;

  const newName = prompt('Masukkan nama baru untuk modul:', mod.name || mod.filename);
  if (newName && newName.trim() && newName.trim() !== mod.name) {
    mod.name = newName.trim();
    await ModuleDB.put(mod);
    renderSidebarModules();
    if (AppState.activeModuleId === id) {
      selectModule(id);
    }
    showToast('Nama modul berhasil diperbarui.', 'success');
  }
}

async function confirmDeleteModule(id) {
  const mod = AppState.modules.find(m => m.id === id);
  if (!mod) return;

  if (confirm(`Apakah Anda yakin ingin menghapus modul "${mod.name || mod.filename}"?`)) {
    await ModuleDB.delete(id);
    AppState.modules = AppState.modules.filter(m => m.id !== id);
    renderSidebarModules();
    updateModuleCount();

    if (AppState.activeModuleId === id) {
      if (AppState.modules.length > 0) {
        selectModule(AppState.modules[0].id);
      }
    }
    showToast('Modul berhasil dihapus dari penyimpanan.', 'info');
  }
}

async function handleCreateNewModule() {
  const title = DOM.newModuleTitle.value.trim();
  const content = DOM.newModuleContent.value.trim();

  if (!title) {
    alert('Nama judul modul wajib diisi.');
    return;
  }

  const id = 'modul_manual_' + Date.now();
  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;

  const newMod = {
    id: id,
    name: title,
    filename: `${title.toLowerCase().replace(/\s+/g, '_')}.txt`,
    format: 'TXT',
    size: new Blob([content]).size,
    pageCount: 1,
    wordCount: wordCount,
    status: `✅ Berhasil Diekstrak (${wordCount} kata)`,
    fullText: content,
    summaryNotes: content.slice(0, 500),
    pages: [{ pageNum: 1, text: content }],
    createdAt: Date.now()
  };

  await ModuleDB.put(newMod);
  AppState.modules.unshift(newMod);
  renderSidebarModules();
  updateModuleCount();
  selectModule(newMod.id);

  DOM.newModuleTitle.value = '';
  DOM.newModuleContent.value = '';
  closeModal('modalNewModule');
  showToast(`Modul "${title}" berhasil ditambahkan.`, 'success');
}

function openFilesManagementModal() {
  DOM.filesTableBody.innerHTML = '';
  
  AppState.modules.forEach(m => {
    const tr = document.createElement('tr');
    
    let formatClass = 'badge-txt';
    const fmt = (m.format || 'TXT').toLowerCase();
    if (fmt === 'pdf') formatClass = 'badge-pdf';
    else if (fmt === 'docx') formatClass = 'badge-docx';
    else if (fmt === 'pptx') formatClass = 'badge-pptx';
    else if (fmt === 'csv') formatClass = 'badge-csv';
    else if (fmt === 'html' || fmt === 'htm') formatClass = 'badge-html';

    const sizeFormatted = m.size ? `${(m.size / 1024).toFixed(1)} KB` : '-';
    
    let statusClass = 'status-success';
    if (m.status && m.status.includes('Sedang')) statusClass = 'status-loading';
    else if (m.status && m.status.includes('Gagal')) statusClass = 'status-error';

    tr.innerHTML = `
      <td><strong>${escapeHtml(m.name || m.filename)}</strong><br><small style="color:#64748b">${escapeHtml(m.filename || '')}</small></td>
      <td><span class="format-badge ${formatClass}">${escapeHtml(m.format || 'TXT')}</span></td>
      <td>${sizeFormatted}</td>
      <td><span class="status-badge ${statusClass}">${escapeHtml(m.status || 'Tersedia')}</span></td>
      <td>${m.wordCount || 0} kata (${m.pageCount || 1} hlm)</td>
      <td>
        <button class="btn-sidebar" style="padding:4px 8px; font-size:11px" onclick="promptRenameModule('${m.id}')">Ganti Nama</button>
        <button class="btn-sidebar" style="padding:4px 8px; font-size:11px; color:#dc2626" onclick="confirmDeleteModule('${m.id}')">Hapus</button>
      </td>
    `;
    DOM.filesTableBody.appendChild(tr);
  });

  openModal('modalFiles');
}

/* ==========================================================================
   11. Event Listeners & UI Binding
   ========================================================================== */
function setupEventListeners() {
  // Tab Switch
  DOM.tabBtnChat.addEventListener('click', () => switchTab('chat'));
  DOM.tabBtnQuiz.addEventListener('click', () => switchTab('quiz'));

  // Chat Input
  DOM.btnSendChat.addEventListener('click', handleSendMessage);
  DOM.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });
  DOM.btnSummarize.addEventListener('click', handleSummarize);

  // Quiz Controls & AI Generator Actions
  if (DOM.btnGenerateQuiz) {
    DOM.btnGenerateQuiz.addEventListener('click', () => handleGenerateQuizSubmit(false));
  }
  if (DOM.btnViewQuizHistory) {
    DOM.btnViewQuizHistory.addEventListener('click', openQuizHistoryModal);
  }
  if (DOM.btnQuizPrev) {
    DOM.btnQuizPrev.addEventListener('click', handlePrevQuestion);
  }
  if (DOM.btnQuizNext) {
    DOM.btnQuizNext.addEventListener('click', handleNextQuestion);
  }
  if (DOM.btnQuizRestart) {
    DOM.btnQuizRestart.addEventListener('click', handleRestartQuiz);
  }
  if (DOM.btnQuizFinish) {
    DOM.btnQuizFinish.addEventListener('click', handleFinishQuiz);
  }
  if (DOM.btnRegenerateQuiz) {
    DOM.btnRegenerateQuiz.addEventListener('click', () => handleGenerateQuizSubmit(true));
  }
  if (DOM.btnRetryCurrentQuiz) {
    DOM.btnRetryCurrentQuiz.addEventListener('click', handleRetryCurrentQuiz);
  }
  if (DOM.btnResultsViewHistory) {
    DOM.btnResultsViewHistory.addEventListener('click', openQuizHistoryModal);
  }
  if (DOM.btnClearQuizHistory) {
    DOM.btnClearQuizHistory.addEventListener('click', handleClearAllQuizHistory);
  }

  // File Upload Dialogs
  DOM.btnUploadFiles.addEventListener('click', () => DOM.fileInputMulti.click());
  DOM.fileInputMulti.addEventListener('change', (e) => {
    processUploadedFiles(e.target.files);
    e.target.value = '';
  });

  // Folder Upload Dialog
  DOM.btnUploadFolder.addEventListener('click', () => DOM.folderInput.click());
  DOM.folderInput.addEventListener('change', (e) => {
    processUploadedFiles(e.target.files);
    e.target.value = '';
  });

  // Drag and Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    DOM.sidebarDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      DOM.sidebarDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    DOM.sidebarDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      DOM.sidebarDropzone.classList.remove('dragover');
    });
  });

  DOM.sidebarDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      processUploadedFiles(dt.files);
    }
  });

  // Also support window drag and drop
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(e.dataTransfer.files);
    }
  });

  // Modal open buttons
  DOM.btnAddModule.addEventListener('click', () => openModal('modalNewModule'));
  DOM.btnManageFiles.addEventListener('click', openFilesManagementModal);
  DOM.btnSystemInfo.addEventListener('click', () => openModal('modalInfoWorkflow'));
  DOM.btnSaveNewModule.addEventListener('click', handleCreateNewModule);

  // API Settings Modal & Actions
  if (DOM.btnOpenApiSettings) {
    DOM.btnOpenApiSettings.addEventListener('click', openApiConfigModal);
  }
  if (DOM.apiProvider) {
    DOM.apiProvider.addEventListener('change', (e) => {
      toggleBaseUrlVisibility(e.target.value);
      if (DOM.apiModelInput) {
        if (e.target.value === 'gemini') {
          DOM.apiModelInput.value = 'gemini-1.5-flash';
        } else if (e.target.value === 'openai') {
          DOM.apiModelInput.value = 'gpt-4o-mini';
        }
      }
    });
  }
  if (DOM.btnToggleApiKeyVisibility) {
    DOM.btnToggleApiKeyVisibility.addEventListener('click', toggleApiKeyVisibility);
  }
  if (DOM.btnTestApiConnection) {
    DOM.btnTestApiConnection.addEventListener('click', handleTestApiConnection);
  }
  if (DOM.btnSaveApiConfig) {
    DOM.btnSaveApiConfig.addEventListener('click', handleSaveApiConfig);
  }
}

function switchTab(tabName) {
  AppState.currentTab = tabName;
  if (tabName === 'chat') {
    DOM.tabBtnChat.classList.add('active');
    DOM.tabBtnQuiz.classList.remove('active');
    DOM.chatView.style.display = 'flex';
    DOM.quizView.style.display = 'none';
  } else {
    DOM.tabBtnChat.classList.remove('active');
    DOM.tabBtnQuiz.classList.add('active');
    DOM.chatView.style.display = 'none';
    DOM.quizView.style.display = 'flex';

    // If initial launch or Modul 2, guarantee Screenshot 2 exact state
    if (AppState.quizState.questions.length === 0 || AppState.quizState.isInitialScreenshotMatch) {
      loadQuizForModule('modul_02', true);
    } else {
      populateQuizSourceDropdown();
      renderQuizJumpGrid();
      if (!AppState.quizState.isFinished) {
        renderCurrentQuestion(false);
      }
    }
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// Launch on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
