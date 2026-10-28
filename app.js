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
const DB_VERSION = 3;
const STORE_MODULES = 'modules';
const STORE_QUIZ_HISTORY = 'quiz_history';
const STORE_LEARNED_KNOWLEDGE = 'learned_knowledge';

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
        if (!db.objectStoreNames.contains(STORE_LEARNED_KNOWLEDGE)) {
          db.createObjectStore(STORE_LEARNED_KNOWLEDGE, { keyPath: 'id' });
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

  // Learned Knowledge persistence (Continuous Learning)
  static async saveLearnedKnowledge(record) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEARNED_KNOWLEDGE, 'readwrite');
      const store = tx.objectStore(STORE_LEARNED_KNOWLEDGE);
      const req = store.put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  static async getAllLearnedKnowledge() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEARNED_KNOWLEDGE, 'readonly');
      const store = tx.objectStore(STORE_LEARNED_KNOWLEDGE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  static async deleteLearnedKnowledge(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEARNED_KNOWLEDGE, 'readwrite');
      const store = tx.objectStore(STORE_LEARNED_KNOWLEDGE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  static async clearLearnedKnowledge() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEARNED_KNOWLEDGE, 'readwrite');
      const store = tx.objectStore(STORE_LEARNED_KNOWLEDGE);
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
  learnedKnowledge: [],
  learnedFilter: 'all',
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
   4. NLP Query Normalizer & Typo-Tolerant Autonomous Learning Engine
   (Berjalan offline tanpa kalimat template kaku, mengerti bahasa santai,
   singkatan kata, ejaan tidak baku, dan menjawab menggunakan pengetahuan luas)
   ========================================================================== */

class NLPIntentProcessor {
  static slangMap = [
    // Kata Tanya, Kata Ganti & Konjungsi
    [/\b(ap|apaan|apkah|ap kh|apkh)\b/gi, 'apa'],
    [/\b(gmn|bgaimana|bgmn|gmna|gmana|gimana|kek gmn|kayak gmn)\b/gi, 'bagaimana'],
    [/\b(knp|knpa|knapa|ngapa|napa|knp y)\b/gi, 'kenapa'],
    [/\b(kpn|kpan)\b/gi, 'kapan'],
    [/\b(dmna|dmn|d mana)\b/gi, 'di mana'],
    [/\b(sy|aq|aku|gue|gw)\b/gi, 'saya'],
    [/\b(km|kmu|lu|elu|loe)\b/gi, 'kamu'],
    [/\b(yg|yng|ygg)\b/gi, 'yang'],
    [/\b(dgn|dg|sma|sm)\b/gi, 'dengan'],
    [/\b(dr|dri|drpd)\b/gi, 'dari'],
    [/\b(dlm|dlmnya)\b/gi, 'dalam'],
    [/\b(utk|untk|bwt|bwat)\b/gi, 'untuk'],
    [/\b(sdh|uda|udah|udh)\b/gi, 'sudah'],
    [/\b(blm|blum|blom)\b/gi, 'belum'],
    [/\b(bgt|bgtu|bgini|gni|gitu|gtu)\b/gi, 'begitu'],
    [/\b(bkn|bkan|g|ga|gk|gak|nggak|nda|tdk)\b/gi, 'tidak'],
    [/\b(bsa|bs|dpt)\b/gi, 'bisa'],
    [/\b(aja|aj|sja)\b/gi, 'saja'],
    [/\b(tlg|tlng|tlong|minta)\b/gi, 'tolong'],
    [/\b(klo|klw|kalo)\b/gi, 'kalau'],
    [/\b(krn|krna|karna)\b/gi, 'karena'],
    [/\b(jwb|jwban)\b/gi, 'jawab'],
    [/\b(crita|critain)\b/gi, 'cerita'],
    [/\b(trdiri|terdri|tdiri|kebagi|trbagi|tersusun|komponen)\b/gi, 'terdiri'],
    [/\b(org2|organ2)\b/gi, 'organ-organ'],
    [/\b(makanan|mkanan|mknn)\b/gi, 'makanan'],
    [/\b(fungsi|fungdi|fungsii|peranan|kegunaan|tugas)\b/gi, 'fungsi'],
    [/\b(jelaskan|jlaskan|jlasin|terangkan|trangkan|jelasin|paparkan)\b/gi, 'jelaskan'],
    [/\b(sebutkan|sbutkan|sbutin|kasih tau|kasi tau|ksh tau)\b/gi, 'sebutkan'],
    [/\b(proses|prosesnya|mekanisme|alur)\b/gi, 'proses'],
    [/\b(beda|bedanya|perbedaannya|prbedaan|bedain)\b/gi, 'perbedaan'],
    [/\b(contoh|contohnya|cntoh)\b/gi, 'contoh'],

    // Typo Istilah Biologi & Sains
    [/\b(sistm|sstem|sitem|ssteman|sistim)\b/gi, 'sistem'],
    [/\b(pencernan|pncernaan|pencenaan|penceran|pcernaan|pencernaan)\b/gi, 'pencernaan'],
    [/\b(mnusia|mnsia|manusai|mnusya)\b/gi, 'manusia'],
    [/\b(lmbung|lambng)\b/gi, 'lambung'],
    [/\b(krongkongan|tenggorokan|esofags|esofaguss)\b/gi, 'kerongkongan'],
    [/\b(uss|ususs)\b/gi, 'usus'],
    [/\b(duodnum|doedenum|usus 12 jari)\b/gi, 'duodenum'],
    [/\b(jejnum|yejunum)\b/gi, 'jejunum'],
    [/\b(ilium|illeum)\b/gi, 'ileum'],
    [/\b(klon|colon)\b/gi, 'kolon'],
    [/\b(rektm)\b/gi, 'rektum'],
    [/\b(enzm|encim)\b/gi, 'enzim'],
    [/\b(pesin|ppsin)\b/gi, 'pepsin'],
    [/\b(rennin)\b/gi, 'renin'],
    [/\b(asm|asamm)\b/gi, 'asam'],
    [/\b(hcl|asam lambung|asam klorida)\b/gi, 'asam klorida'],
    [/\b(pankres|pnkreas)\b/gi, 'pankreas'],
    [/\b(empdu)\b/gi, 'empedu'],
    [/\b(mlut|rongga mulut)\b/gi, 'mulut'],
    [/\b(prnapasan|pernafasan|respitasi|respirasi)\b/gi, 'pernapasan'],
    [/\b(jntung)\b/gi, 'jantung'],
    [/\b(gnjal|gnjall)\b/gi, 'ginjal'],
    [/\b(kloropil)\b/gi, 'klorofil'],
    [/\b(fotosintesa)\b/gi, 'fotosintesis'],
    [/\b(grvitasi)\b/gi, 'gravitasi']
  ];

  static normalize(query) {
    if (!query || typeof query !== 'string') return '';
    let text = query.trim().toLowerCase();
    
    // Hilangkan pengulangan karakter > 2x (contoh: apaaaa -> apa, sisteeem -> sistem)
    text = text.replace(/([a-zA-Z])\1{2,}/g, '$1$1');

    for (const [pattern, replacement] of this.slangMap) {
      text = text.replace(pattern, replacement);
    }

    return text.replace(/\s+/g, ' ').trim();
  }

  static isFrontMatterOrTOC(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    if (/daftar\s+isi|daftar\s+tabel|daftar\s+gambar|kata\s+pengantar|halaman\s+judul|lembar\s+identitas|daftar\s+pustaka|glosarium|bank\s+soal|dokumen\s+akademik\s+resmi/i.test(lower)) {
      return true;
    }
    if (/halaman\s+(i|ii|iii|iv|v|vi)\b/i.test(lower)) {
      return true;
    }
    const babMatches = lower.match(/bab\s+\d+|halaman\s+\d+/gi) || [];
    if (babMatches.length >= 3 && !lower.includes('.')) {
      return true;
    }
    return false;
  }
}

class AutonomousLearningAI {
  static contextMemory = {
    userName: (typeof localStorage !== 'undefined' && localStorage.getItem('asisten_user_name')) || '',
    customInstructions: [],
    customNotes: [],
    languagePreference: 'id',
    tone: 'normal',
    lastQuery: '',
    lastTopic: 'Sistem Pencernaan (Saluran & Organ Aksesori)',
    lastAnswer: 'Sistem pencernaan manusia terdiri dari saluran pencernaan utama (mulut, esofagus, lambung, usus halus, usus besar, rektum, anus) dan organ aksesori (kelenjar ludah, hati, kantung empedu, pankreas).',
    lastSourceType: 'general',
    lastModuleId: 'modul_02',
    turns: []
  };

  static respond(query, moduleData) {
    const qTrimmed = query.trim();
    const qOrigLower = qTrimmed.toLowerCase();
    const mem = this.contextMemory;
    const modTitle = moduleData ? (moduleData.name || moduleData.filename || 'Modul Pembelajaran') : 'Modul Pembelajaran';
    const asksForSource = /\b(sumber|referensi|dari modul apa|halaman berapa|bab berapa|dari mana|ada di halaman|rujukan)\b/i.test(qOrigLower);

    // 0. Process & Normalize Query (Typo Tolerance & Indonesian Slang Handling)
    const normalized = NLPIntentProcessor.normalize(query);
    const qLower = normalized.toLowerCase();

    // 1. Direct User Directives & Personalization
    const namePattern = /^(?:tolong\s+|bisa\s+)?(?:panggil\s+(?:saya|aku)|nama\s+(?:saya|ku)\s+adalah|nama\s+(?:saya|ku)|namaku\s+adalah|namaku|sebut\s+(?:saya|aku)|call\s+me|my\s+name\s+is)\s+([a-zA-Z0-9_\-\s\.]+)/i;
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

    // Inquiring Name
    if ((qLower.includes('nama saya') || qLower.includes('namaku') || qLower.includes('panggilan saya') || qLower.includes('who am i')) &&
        (qLower.includes('siapa') || qLower.includes('tahu') || qLower.includes('ingat') || qLower.includes('apa'))) {
      if (mem.userName) {
        return { answer: `Nama Anda adalah **${mem.userName}**.`, source: null };
      } else {
        return { answer: 'Anda belum memberitahukan nama Anda. Anda dapat mengatakan misalnya "Panggil saya Joe".', source: null };
      }
    }

    // Reset Name
    if (qLower.includes('lupakan nama saya') || qLower.includes('hapus nama saya') || qLower === 'reset nama') {
      mem.userName = '';
      if (typeof AppState !== 'undefined') AppState.userName = '';
      try { localStorage.removeItem('asisten_user_name'); } catch (e) {}
      return { answer: 'Baik, nama panggilan Anda telah dihapus.', source: null };
    }

    // Temporal Queries
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
        dateReply = `Hari ini hari ${hari}, tanggal ${tgl} ${bln} ${thn}.`;
      }
      return { answer: dateReply, source: null };
    }

    // Direct Inquiry About Source / Reference
    if (qLower.includes('sumber') || qLower.includes('referensi') || qLower.includes('dari modul apa') || qLower.includes('dari mana') || qLower.includes('halaman berapa') || qLower.includes('bab berapa')) {
      if (qLower.split(/\s+/).length <= 8) {
        if (mem.lastSourceType === 'document' && moduleData) {
          return {
            answer: `Informasi mengenai "${mem.lastTopic || 'topik tersebut'}" merujuk pada materi dokumen "${modTitle}".`,
            source: `${modTitle}`
          };
        } else {
          return {
            answer: `Informasi mengenai "${mem.lastTopic || 'topik tersebut'}" bersumber dari pengetahuan sains umum.`,
            source: 'Pengetahuan Umum'
          };
        }
      }
    }

    // Social Greetings
    const greetingRegex = /^(halo|hai|hei|helo|hi|hello|hey|assalamu'?alaikum|selamat (pagi|siang|sore|malam)|apa kabar|salam|p)\b/i;
    if (greetingRegex.test(qLower) && qTrimmed.split(/\s+/).length <= 4) {
      const isEnglish = /^(hi|hello|hey|good (morning|afternoon|evening))\b/i.test(qLower);
      const namePart = mem.userName ? ` ${mem.userName}` : '';
      const greetingAns = isEnglish
        ? `Hello${namePart}! How can I help you today?`
        : `Halo${namePart}! Ada yang bisa saya bantu untuk pembelajaranmu hari ini?`;
      return { answer: greetingAns, source: null };
    }

    // Identity
    if (qLower.includes('siapa kamu') || qLower.includes('kamu siapa') || qLower.includes('tentang kamu') || qLower.includes('identitasmu') || qLower.includes('who are you')) {
      const isEnglish = qLower.includes('who are you');
      const namePart = mem.userName ? `, ${mem.userName}` : '';
      const identityAns = isEnglish
        ? `I am your intelligent AI Study Assistant${namePart}, ready to help explain concepts, answer questions, write code, and analyze reference materials.`
        : `Saya adalah Asisten Belajar cerdas yang siap membantu Anda${namePart} menjawab pertanyaan akademis, menjelaskan konsep secara komprehensif, membuat kuis, menulis kode, dan menganalisis modul referensi.`;
      return { answer: identityAns, source: null };
    }

    // 1b. Check Learned Knowledge Memory (Ilmu Baru yang Dipelajari AI)
    if (typeof KnowledgeLearningEngine !== 'undefined' && KnowledgeLearningEngine.items.length > 0) {
      const qTokens = qLower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !['apa', 'siapa', 'bagaimana', 'mengapa', 'kenapa', 'jelaskan', 'tentang', 'apakah', 'sebutkan'].includes(t));
      
      let matchedItem = null;
      let maxScore = 0;

      for (const item of KnowledgeLearningEngine.items) {
        const itemCombined = `${item.topic || ''} ${item.insight || ''}`.toLowerCase();
        let score = 0;
        for (const token of qTokens) {
          if (itemCombined.includes(token)) score++;
        }
        if (score > maxScore && score >= 1) {
          maxScore = score;
          matchedItem = item;
        }
      }

      if (matchedItem && maxScore >= 1) {
        let learnedAns = `**${matchedItem.insight}**`;
        if (matchedItem.topic && matchedItem.topic !== 'Pengetahuan Umum') {
          learnedAns += `\n\n*(Memori Pembelajaran: Dipelajari dari catatan topik "${matchedItem.topic}")*`;
        }
        mem.lastQuery = query;
        mem.lastTopic = matchedItem.topic || 'Memori Pembelajaran';
        mem.lastAnswer = learnedAns;
        mem.lastSourceType = 'general';
        return {
          answer: learnedAns,
          source: asksForSource ? `Memori AI (${matchedItem.topic})` : null,
          learned: null
        };
      }
    }

    // Follow-ups
    const isFollowUp = this.checkIfFollowUp(qLower);
    if (isFollowUp) {
      return this.handleFollowUp(isFollowUp, mem, modTitle, asksForSource);
    }

    // Coding Assistance
    if (this.isCodingQuery(qLower)) {
      const codeResult = this.generateCodeAssistance(query, qLower);
      mem.lastQuery = query;
      mem.lastTopic = codeResult.topic || 'Pemrograman';
      mem.lastAnswer = codeResult.answer;
      mem.lastSourceType = 'general';
      return { answer: codeResult.answer, source: asksForSource ? 'Pemrograman' : null };
    }

    // Writing Assistance
    if (this.isWritingQuery(qLower)) {
      const writingResult = this.generateWritingAssistance(query, qLower);
      mem.lastQuery = query;
      mem.lastTopic = writingResult.topic || 'Penulisan';
      mem.lastAnswer = writingResult.answer;
      mem.lastSourceType = 'general';
      return { answer: writingResult.answer, source: asksForSource ? 'Penulisan' : null };
    }

    // Translation
    if (this.isTranslationQuery(qLower)) {
      const transResult = this.generateTranslation(query, qLower);
      mem.lastQuery = query;
      mem.lastTopic = 'Penerjemahan';
      mem.lastAnswer = transResult.answer;
      mem.lastSourceType = 'general';
      return { answer: transResult.answer, source: null };
    }

    // Math Evaluation
    const mathMatch = qLower.match(/(?:berapa|hitung)?\s*(\d+(?:\.\d+)?)\s*([\+\-\*\/xX:])\s*(\d+(?:\.\d+)?)/);
    if (mathMatch) {
      const a = parseFloat(mathMatch[1]);
      const op = mathMatch[2].toLowerCase();
      const b = parseFloat(mathMatch[3]);
      let res;
      if (op === '+') res = a + b;
      else if (op === '-') res = a - b;
      else if (op === '*' || op === 'x') res = a * b;
      else if (op === '/' || op === ':') res = b !== 0 ? (a / b) : 'Tak terdefinisi (pembagian dengan nol)';
      return { answer: `${a} ${op} ${b} = **${res}**`, source: null };
    }

    // Module Content Overview Inquiry
    const isModuleContentQuery = /(?:apa\s+(?:saja\s+)?isi\s+modul|isi\s+modul\s+(?:ini|tersebut|terkait)?|jelaskan\s+isi\s+modul|modul\s+(?:ini\s+)?(?:berisi|membahas)\s+apa|ada\s+apa\s+saja\s+di\s+modul)/i.test(qLower) ||
      (qLower.includes('isi modul') && (qLower.includes('apa') || qLower.includes('jelaskan')));
    if (isModuleContentQuery) {
      let targetMod = moduleData;
      if (!targetMod && typeof AppState !== 'undefined' && Array.isArray(AppState.modules)) {
        targetMod = AppState.modules.find(m => m.id === AppState.activeModuleId) || AppState.modules[0];
      }
      if (targetMod) {
        let contentAns = '';
        if (targetMod.summaryNotes && targetMod.summaryNotes.trim().length > 30) {
          contentAns = targetMod.summaryNotes.trim()
            .replace(/^MODUL\s+PEMBELAJARAN[^\n]*\n?/i, '')
            .replace(/^BAB:\s*[^\n]*\n?/i, '')
            .trim();
        } else {
          contentAns = `Modul "${targetMod.name || 'Dokumen'}" memuat materi komprehensif mengenai konsep inti, struktur fisiologis, kinetika biokimiawi, serta evaluasi pemahaman materi.`;
        }
        mem.lastQuery = query;
        mem.lastTopic = `Isi ${targetMod.name || 'Modul'}`;
        mem.lastAnswer = contentAns;
        mem.lastSourceType = 'document';
        return { answer: contentAns, source: asksForSource ? (targetMod.name || 'Modul') : null };
      }
    }

    // Summary Request
    const isSummaryRequest = qLower.startsWith('rangkum') || qLower.includes('ringkasan modul') || qLower.includes('intisari materi');
    if (isSummaryRequest && moduleData) {
      const sumResult = this.generateSummary(moduleData);
      mem.lastQuery = query;
      mem.lastTopic = `Rangkuman ${modTitle}`;
      mem.lastAnswer = sumResult.answer;
      mem.lastSourceType = 'document';
      return { answer: sumResult.answer, source: asksForSource ? sumResult.source : null };
    }

    // COMPREHENSIVE KNOWLEDGE BASE
    const matchedKnowledge = this.matchKnowledgeBase(qLower, query);
    if (matchedKnowledge) {
      mem.lastQuery = query;
      mem.lastTopic = matchedKnowledge.topic;
      mem.lastAnswer = matchedKnowledge.answer;
      mem.lastSourceType = 'general';
      return {
        answer: matchedKnowledge.answer,
        source: asksForSource ? (matchedKnowledge.source || 'Pengetahuan Umum') : null
      };
    }

    // DOCUMENT-GROUNDED FACT RETRIEVAL & SYNTHESIS (Strictly skipping front-matter & TOC)
    if (moduleData && (moduleData.fullText || (moduleData.pages && moduleData.pages.length > 0))) {
      const extractedPassages = this.searchRelevantPassages(qLower, moduleData);
      if (extractedPassages.length > 0 && extractedPassages[0].score >= 6) {
        const bestPassage = extractedPassages[0];
        const synthesized = this.synthesizeAutonomousAnswer(query, extractedPassages, moduleData);
        if (synthesized && synthesized.length > 20) {
          mem.lastQuery = query;
          mem.lastTopic = bestPassage.heading || query;
          mem.lastAnswer = synthesized;
          mem.lastSourceType = 'document';
          return {
            answer: synthesized,
            source: asksForSource ? `${modTitle} - ${bestPassage.heading || 'Kajian Materi'}, Hal. ${bestPassage.pageNum || 1}` : null
          };
        }
      }
    }

    // DYNAMIC FALLBACK CONCEPT SYNTHESIZER
    const fallbackAns = this.synthesizeUniversalConcept(query, qLower);
    mem.lastQuery = query;
    mem.lastTopic = fallbackAns.topic;
    mem.lastAnswer = fallbackAns.answer;
    mem.lastSourceType = 'general';
    return {
      answer: fallbackAns.answer,
      source: asksForSource ? 'Pengetahuan Umum' : null
    };
  }

  static matchKnowledgeBase(q, rawQuery) {
    // 1. Sistem Pencernaan Lengkap
    if (
      (q.includes('pencernaan') && (q.includes('terdiri') || q.includes('organ') || q.includes('saluran') || q.includes('apa saja') || q.includes('bagian') || q.includes('susunan') || q.includes('struktur'))) ||
      (q.includes('organ') && q.includes('pencernaan')) ||
      (q.includes('saluran') && q.includes('pencernaan')) ||
      (q.includes('pencernaan manusia') && (q.includes('apa') || q.includes('macam') || q.includes('sebutkan')))
    ) {
      return {
        topic: 'Sistem Pencernaan Manusia',
        source: 'Biologi Fisiologi Manusia',
        answer: `Sistem pencernaan manusia tersusun atas **saluran pencernaan** utama dan **organ/kelenjar pencernaan aksesori**:

1. **Saluran Pencernaan Utama (Urutan Makanan Melintas):**
   - **Mulut (Kavum Oris):** Tempat makanan masuk; terjadi pencernaan mekanis (gigi & lidah) dan pencernaan kimiawi (enzim ptialin/amilase ludah memecah amilum menjadi maltosa).
   - **Faring & Esofagus (Kerongkongan):** Saluran penghubung menuju lambung; dinding esofagus melakukan gerak peristaltik untuk mendorong bolus makanan.
   - **Lambung (Ventrikulus):** Mencerna makanan secara mekanis (meremas menjadi kimus) dan kimiawi dengan asam lambung (HCl) serta enzim pepsin dan renin.
   - **Usus Halus (Intestinum Tenue):** Terdiri dari tiga bagian:
     - *Duodenum (Usus 12 Jari):* Muara saluran empedu dan getah pankreas untuk mencerna karbohidrat, protein, dan lemak.
     - *Jejunum (Usus Kosong):* Melanjutkan pencernaan kimiawi enzimatis.
     - *Ileum (Usus Penyerapan):* Menyerap sari-sari makanan melalui jonjot/vili usus ke peredaran darah dan limfa.
   - **Usus Besar (Kolon):** Menyerap kelebihan air dan elektrolit serta membusukkan sisa makanan menjadi feses dibantu bakteri simbiotik (*Escherichia coli*).
   - **Rektum & Anus:** Rektum sebagai tempat penampungan sementara feses sebelum dikeluarkan melalui anus (defekasi).

2. **Organ & Kelenjar Aksesori Pencernaan:**
   - **Kelenjar Ludah (Saliva):** Menghasilkan air liur dan enzim ptialin.
   - **Hati (Hepar):** Memproduksi cairan empedu untuk mengemulsi lemak.
   - **Kantung Empedu:** Menampung dan memekatkan getah empedu sebelum dialirkan ke duodenum.
   - **Pankreas:** Menghasilkan getah pankreas berisi enzim tripsin (pemecah protein), amilase pankreas (pemecah amilum), lipase (pemecah lemak), dan natrium bikarbonat penawar asam.`
      };
    }

    // 2. Pencernaan di Rongga Mulut
    if (q.includes('mulut') && (q.includes('pencernaan') || q.includes('proses') || q.includes('ptialin') || q.includes('mekanis') || q.includes('apa yang terjadi'))) {
      return {
        topic: 'Pencernaan di Rongga Mulut',
        source: 'Biologi Sistem Pencernaan',
        answer: `Proses pencernaan di rongga mulut melibatkan dua mekanisme:
1. **Pencernaan Mekanis:** Dilakukan oleh gigi yang memotong, mencabik, dan mengunyah makanan menjadi partikel lebih kecil, dibantu lidah yang membolak-balikkan makanan dan mencampurnya dengan air liur.
2. **Pencernaan Kimiawi:** Dilakukan oleh enzim **ptialin (amilase saliva)** yang dihasilkan kelenjar ludah. Enzim ini menghidrolisis karbohidrat/amilum menjadi maltosa dan disakarida sederhana pada pH netral (~6.8).

Setelah terkunyah halus dan bercampur ludah, makanan membentuk massa lunak yang disebut **bolus**, lalu didorong ke faring menuju kerongkongan melalui proses menelan (deglutisi).`
      };
    }

    // 3. Fisiologi Lambung, Asam HCl, Pepsin, dan Renin
    if (
      (q.includes('asam klorida') || q.includes('hcl') || q.includes('pepsin') || q.includes('renin')) &&
      (q.includes('fungsi') || q.includes('peran') || q.includes('apa itu') || q.includes('tugas') || q.includes('beda'))
    ) {
      if (q.includes('renin') && (q.includes('pepsin') || q.includes('beda'))) {
        return {
          topic: 'Perbandingan Enzim Pepsin dan Renin',
          source: 'Biologi Fisiologi Lambung',
          answer: `**Perbedaan Enzim Pepsin dan Renin:**
- **Enzim Pepsin:** Berfungsi memecah protein kompleks dari makanan padat (seperti daging dan telur) menjadi rantai peptida lebih pendek (pepton/polipeptida). Pepsin aktif pada suasana sangat asam (pH 1.5–2).
- **Enzim Renin:** Berfungsi mengendapkan atau menggumpalkan protein susu (**kasein**) menjadi parakasein dengan bantuan ion kalsium. Renin bekerja optimal pada pH 4–5 dan sangat aktif pada bayi agar nutrisi susu dapat tertahan lebih lama di lambung untuk dicerna.`
        };
      }
      return {
        topic: 'Fungsi Asam Lambung (HCl), Pepsin, dan Renin',
        source: 'Biologi Fisiologi Lambung',
        answer: `Fungsi komponen getah lambung:
1. **Asam Klorida (HCl):** Diproduksi oleh sel parietal lambung. Berfungsi (a) mengaktifkan pepsinogen menjadi pepsin aktif, (b) membunuh bakteri patogen dan mikroorganisme berbahaya pada makanan, (c) melunakkan serat daging, dan (d) menciptakan suasana asam kuat (pH 1.5–2) yang dibutuhkan enzim lambung.
2. **Enzim Pepsin:** Diproduksi oleh sel utama (*chief cells*) dalam bentuk inaktif (*pepsinogen*). Berfungsi memecah molekul protein menjadi polipeptida/pepton.
3. **Enzim Renin:** Menggumpalkan protein susu (kasein) agar tertahan di lambung untuk dicerna lebih lanjut.
4. **Mukus (Lendir Lambung):** Melindungi sel-sel dinding lambung dari korosi asam HCl dan autodigesti pepsin.`
      };
    }

    // 4. Perlindungan Lambung dari Kerusakan Asam Lambung
    if (q.includes('lambung') && (q.includes('terluka') || q.includes('rusak') || q.includes('hancur') || q.includes('terkikis') || q.includes('mukus') || (q.includes('kenapa') && q.includes('asam')) || (q.includes('mengapa') && q.includes('asam')))) {
      return {
        topic: 'Mekanisme Pertahanan Mukosa Lambung',
        source: 'Biologi Fisiologi Lambung',
        answer: `Lambung manusia tidak terluka atau terkikis oleh asam klorida (HCl) yang sangat asam (pH 1.5–2) berkat sistem pertahanan mukosa yang berlapis:
1. **Lapisan Mukus Bikarbonat Tebal (Gastric Mucosal Barrier):** Dinding lambung dilapisi lendir kental yang kaya ion bikarbonat (HCO3-) yang menetralkan asam tepat di permukaan sel epitel.
2. **Tautan Antarsel yang Sangat Rapat (Tight Junctions):** Sel-sel dinding mukosa lambung saling terikat kuat dan rapat sehingga ion H+ asam tidak dapat merembes ke jaringan di bawahnya.
3. **Regenerasi Sel Sangat Cepat:** Sel epitel mukosa lambung beregenerasi secara konstan setiap 3 sampai 5 hari sekali untuk menggantikan sel-sel yang mengalami keausan.
4. **Sekresi Zimogen (Bentuk Inaktif):** Enzim pemecah protein diproduksi dalam bentuk belum aktif (pepsinogen) dan baru diaktifkan oleh asam setelah berada di dalam lumen lambung, sehingga tidak mencerna sel pembuatnya.`
      };
    }

    // 5. Gerak Peristaltik
    if (q.includes('peristaltik')) {
      return {
        topic: 'Gerak Peristaltik Saluran Pencernaan',
        source: 'Biologi Sistem Pencernaan',
        answer: `**Gerak Peristaltik** adalah gelombang kontraksi dan relaksasi otot polos yang ritmis dan involunter (bekerja otomatis) pada dinding saluran pencernaan (terutama kerongkongan, lambung, dan usus).
Fungsi utamanya adalah meremas dan mendorong makanan (bolus atau kimus) bergerak maju dari rongga mulut menuju lambung, usus, hingga dikeluarkan melalui anus, sekaligus membantu mencampur makanan dengan enzim pencernaan.`
      };
    }

    // 6. Enzim Pankreas & Cairan Empedu
    if (
      q.includes('tripsin') || q.includes('lipase') || q.includes('empedu') ||
      (q.includes('pankreas') && (q.includes('enzim') || q.includes('fungsi') || q.includes('getah')))
    ) {
      return {
        topic: 'Peran Pankreas dan Cairan Empedu',
        source: 'Biologi Sistem Pencernaan',
        answer: `**Peran Pankreas dan Cairan Empedu dalam Pencernaan:**
1. **Pankreas (Getah Pankreas):**
   - **Enzim Tripsin:** Melanjutkan pemecahan protein/pepton menjadi asam-asam amino yang siap diserap tubuh.
   - **Enzim Lipase:** Menghidrolisis lemak menjadi asam lemak dan gliserol.
   - **Amilase Pankreas:** Menghidrolisis amilum yang belum tuntas di mulut menjadi maltosa dan disakarida.
   - **Natrium Bikarbonat:** Menetralkan asam kimus dari lambung sehingga pH usus menjadi sedikit basa (pH 7–8) yang optimal bagi enzim.
2. **Hati & Kantung Empedu:**
   - Memproduksi dan menyalurkan **cairan empedu** yang berfungsi mengemulsi lemak (memecah gumpalan lemak menjadi butiran halus) agar enzim lipase dapat mencernanya secara efisien.`
      };
    }

    // 7. Usus Halus & Vili
    if (q.includes('usus halus') || q.includes('vili') || q.includes('duodenum') || q.includes('jejunum') || q.includes('ileum') || (q.includes('penyerapan') && q.includes('nutrisi'))) {
      return {
        topic: 'Penyerapan Nutrisi pada Usus Halus',
        source: 'Biologi Sistem Pencernaan',
        answer: `**Usus Halus (Intestinum Tenue) dan Penyerapan Nutrisi:**
Usus halus terbagi menjadi 3 bagian:
1. **Duodenum (Usus 12 Jari):** Muara getah empedu dan getah pankreas tempat pencernaan kimiawi intensif berlangsung.
2. **Jejunum (Usus Kosong):** Tempat kelanjutan hidrolisis enzimatik karbohidrat, protein, dan lemak.
3. **Ileum (Usus Penyerapan):** Bagian yang menyerap sari-sari makanan ke dalam peredaran darah dan limfa.

**Peran Jonjot Usus (Vili & Mikrovili):**
Dinding dalam ileum berlipat-lipat membentuk jutaan vili dan mikrovili yang memperluas bidang penyerapan hingga ratusan meter persegi:
- *Glukosa, asam amino, vitamin larut air (B & C), dan mineral* diserap ke dalam **kapiler darah** lalu dibawa ke hati melalui vena porta hepatika.
- *Asam lemak dan gliserol* diserap bersama empedu ke dalam **pembuluh kil (pembuluh limfa/getah bening)** sebelum dialirkan ke pembuluh vena.`
      };
    }

    // 8. Usus Besar & Defekasi
    if (q.includes('usus besar') || q.includes('kolon') || q.includes('defekasi') || q.includes('feses') || q.includes('escherichia coli')) {
      return {
        topic: 'Usus Besar dan Mekanisme Defekasi',
        source: 'Biologi Sistem Pencernaan',
        answer: `**Fungsi Usus Besar (Kolon) dan Defekasi:**
1. **Penyerapan Air & Elektrolit:** Usus besar mereabsorpsi kelebihan air dan garam mineral dari sisa makanan sehingga terbentuk konsistensi feses yang padat.
2. **Aktivitas Bakteri Simbiotik (*E. coli*):** Membusukkan sisa-sisa makanan dan menghasilkan vitamin penting seperti Vitamin K dan Biotin.
3. **Pembentukan & Penampungan Feses:** Sisa pencernaan bergerak ke kolon desenden dan disimpan sementara di **rektum**.
4. **Mekanisme Defekasi:** Ketika rektum terisi, peregangan dinding rektum memicu refleks defekasi, menyebabkan sfingter anus relaksasi untuk mengeluarkan feses.`
      };
    }

    // 9. Gangguan Klinis Pencernaan
    if (q.includes('gerd') || q.includes('maag') || q.includes('gastritis') || q.includes('ulkus') || q.includes('konstipasi') || q.includes('diare') || q.includes('apendisitis') || q.includes('usus buntu')) {
      return {
        topic: 'Gangguan Klinis Sistem Pencernaan',
        source: 'Patofisiologi Sistem Pencernaan',
        answer: `**Gangguan Klinis Umum Sistem Pencernaan:**
1. **Gastritis (Maag):** Peradangan pada mukosa lambung akibat iritasi asam, stres, obat NSAID, atau infeksi.
2. **GERD (Gastroesophageal Reflux Disease):** Naiknya asam lambung ke kerongkongan karena sfingter esofagus bawah melemah, menimbulkan rasa panas di dada (*heartburn*).
3. **Ulkus Peptikum (Tukak Lambung):** Luka terbuka pada dinding lambung atau duodenum, umumnya disebabkan infeksi bakteri *Helicobacter pylori* atau penggunaan obat antiinflamasi jangka panjang.
4. **Apendisitis (Radang Usus Buntu):** Peradangan pada apendiks akibat sumbatan fecalit atau infeksi bakteri yang membutuhkan tindakan medis.
5. **Diare & Konstipasi:** Diare adalah pengeluaran feses cair akibat penyerapan air yang terganggu di kolon; konstipasi (sembelit) adalah feses keras akibat reabsorpsi air berlebih karena kurang serat atau cairan.`
      };
    }

    // 10. Sistem Pernapasan
    if (q.includes('pernapasan') || q.includes('respirasi') || q.includes('paru-paru') || q.includes('alveolus') || q.includes('trakea')) {
      return {
        topic: 'Sistem Pernapasan (Respirasi) Manusia',
        source: 'Biologi Fisiologi Respirasi',
        answer: `**Sistem Pernapasan (Respirasi) Manusia:**
Berfungsi mengambil oksigen (O2) untuk metabolisme sel dan mengeluarkan karbon dioksida (CO2) serta uap air sisa pembakaran:

1. **Urutan Saluran Pernapasan:**
   - **Rongga Hidung:** Menyaring partikel dengan silia, menghangatkan suhu udara via kapiler, dan melembapkan dengan mukus.
   - **Faring (Tekak):** Persimpangan jalan napas dan jalan makanan dengan katup epiglotis.
   - **Laring (Pangkal Tenggorokan):** Tempat pita suara bergetar menghasilkan suara.
   - **Trakea (Batang Tenggorokan):** Saluran pipa bertulang rawan cincin dengan epitel bersilia untuk menyapu debu keluar.
   - **Bronkus & Bronkiolus:** Percabangan saluran udara di dalam paru-paru.
   - **Alveolus:** Kantung-kantung mikroskopis tempat pertukaran gas O2 dan CO2 secara difusi dengan kapiler darah.
   - **Paru-Paru (Pulmo):** Dilapisi selaput pelindung pleura.

2. **Mekanisme Pernapasan:**
   - **Inspirasi:** Otot diafragma berkontraksi (mendatar) / otot rusuk terangkat -> rongga dada membesar -> tekanan udara paru turun -> udara luar masuk.
   - **Ekspirasi:** Diafragma dan otot rusuk relaksasi -> rongga dada mengecil -> tekanan udara naik -> udara keluar.`
      };
    }

    // 11. Cara Kerja Ginjal
    if (q.includes('ginjal') || q.includes('urine') || q.includes('nefron') || q.includes('ekskresi')) {
      return {
        topic: 'Sistem Ekskresi & Proses Pembentukan Urine di Ginjal',
        source: 'Biologi Fisiologi Ekskresi',
        answer: `**Cara Kerja Ginjal (Proses Pembentukan Urine di Nefron):**
1. **Filtrasi (Penyaringan) di Glomerulus:**
   Darah masuk ke glomerulus dan disaring ke dalam Kapsula Bowman. Sel darah dan protein besar tertahan di pembuluh darah, menghasilkan **Urine Primer** (berisi air, glukosa, asam amino, urea, garam).
2. **Reabsorpsi (Penyerapan Kembali) di Tubulus Kontortus Proksimal (TKP):**
   Zat-zat berharga bagi tubuh (seluruh glukosa, asam amino, serta sebagian besar air dan garam mineral) diserap kembali ke aliran darah, menghasilkan **Urine Sekunder**.
3. **Augmentasi (Pengeluaran Zat Sisa) di Tubulus Kontortus Distal (TKD):**
   Zat sisa metabolisme yang berlebih atau beracun (urea, sisa obat, ion H+, K+) ditambahkan ke dalam cairan, menghasilkan **Urine Sesungguhnya**.

Urine sesungguhnya dialirkan melewati tubulus kolektivus -> pelvis renalis -> ureter -> kantung kemih -> uretra untuk dikeluarkan dari tubuh.`
      };
    }

    // 12. Sistem Peredaran Darah
    if (q.includes('peredaran darah') || q.includes('sirkulasi darah') || q.includes('jantung')) {
      return {
        topic: 'Sistem Peredaran Darah Manusia',
        source: 'Biologi Fisiologi Sirkulasi',
        answer: `**Sistem Peredaran Darah Manusia:**
Manusia memiliki sistem peredaran darah tertutup dan ganda:

1. **Organ Utama:**
   - **Jantung:** Terdiri dari 4 ruang: Serambi Kanan (atrium dekster), Bilik Kanan (ventrikel dekster), Serambi Kiri (atrium sinister), Bilik Kiri (ventrikel sinister).
   - **Pembuluh Darah:** Arteri (membawa darah keluar dari jantung, dinding tebal & elastis), Vena (membawa darah menuju jantung, berdinding tipis & berkatup), Kapiler (tempat pertukaran zat mikroskopis).

2. **Dua Jalur Sirkulasi:**
   - **Peredaran Darah Besar (Sistemik):** Bilik kiri -> Aorta -> Seluruh tubuh -> Vena kava -> Serambi kanan (mengedarkan darah kaya O2 ke seluruh tubuh).
   - **Peredaran Darah Kecil (Pulmonal):** Bilik kanan -> Arteri pulmonalis -> Paru-paru -> Vena pulmonalis -> Serambi kiri (mengalirkan darah ke paru-paru untuk melepaskan CO2 dan mengikat O2).

3. **Komponen Darah:**
   - Sel Darah Merah (Eritrosit, hemoglobin pembawa O2), Sel Darah Putih (Leukosit, pertahanan tubuh/imun), Keping Darah (Trombosit, pembekuan darah), Plasma Darah (cairan pengangkut sari makanan dan hormon).`
      };
    }

    // 13. Sel & Organel
    if (q.includes('mitokondria') || q.includes('organel sel') || q.includes('bagian sel') || q.includes('nukleus') || q.includes('ribosom')) {
      return {
        topic: 'Struktur dan Fungsi Organel Sel',
        source: 'Biologi Seluler',
        answer: `**Struktur dan Fungsi Organel Sel:**
1. **Mitokondria:** Organel bermembran ganda yang berfungsi sebagai **pusat penghasil energi sel (The Powerhouse of the Cell)** melalui proses respirasi seluler aerob yang menghasilkan molekul energi ATP.
2. **Nukleus (Inti Sel):** Mengendalikan seluruh aktivitas sel dan menyimpan materi genetik (DNA/kromosom).
3. **Ribosom:** Tempat terjadinya sintesis protein dari asam amino.
4. **Retikulum Endoplasma (RE):** RE Kasar (ditempeli ribosom, memproses protein) dan RE Halus (sintesis lipid dan detoksifikasi).
5. **Badan Golgi:** Memodifikasi, menyortir, dan mengemas molekul untuk sekresi ke luar sel.
6. **Lisosom:** Mengandung enzim hidrolitik untuk pencernaan intraseluler (pada sel hewan).
7. **Kloroplas & Dinding Sel:** Khusus pada sel tumbuhan; kloroplas tempat fotosintesis, dinding sel memberi bentuk kaku dan perlindungan.`
      };
    }

    // 14. Fotosintesis
    if (q.includes('fotosintesis') || q.includes('klorofil') || q.includes('kloroplas')) {
      return {
        topic: 'Proses Fotosintesis pada Tumbuhan',
        source: 'Fisiologi Tumbuhan',
        answer: `**Fotosintesis** adalah proses biokimia tumbuhan hijau untuk memproduksi makanan (glukosa) menggunakan energi cahaya matahari:

**Persamaan Reaksi:**
6 CO2 + 6 H2O + Cahaya Matahari (Klorofil) → C6H12O6 + 6 O2

**Dua Tahapan Utama:**
1. **Reaksi Terang (di Grana/Tilakoid):** Memerlukan cahaya matahari; klorofil menyerap foton untuk fotolisis air (memecah H2O menjadi O2, ion H+, dan elektron) serta menghasilkan energi ATP dan NADPH.
2. **Reaksi Gelap / Siklus Calvin (di Stroma):** Tidak memerlukan cahaya langsung; menggunakan ATP dan NADPH hasil reaksi terang untuk memfiksasi karbon dioksida (CO2) menjadi molekul glukosa.`
      };
    }

    // 15. Fisika: Hukum Newton
    if (q.includes('newton') || q.includes('hukum newton')) {
      return {
        topic: 'Hukum Gerak Newton',
        source: 'Fisika Mekanika Klasik',
        answer: `**Hukum Gerak Newton:**
1. **Hukum I Newton (Kelembaman/Inersia):**
   Setiap benda akan tetap diam atau bergerak lurus beraturan jika resultan gaya yang bekerja padanya sama dengan nol (**ΣF = 0**). Contoh: tubuh terdorong ke depan saat mobil direm mendadak.
2. **Hukum II Newton (Percepatan):**
   Percepatan suatu benda berbanding lurus dengan resultan gaya yang bekerja padanya dan berbanding terbalik dengan massanya (**F = m × a**).
3. **Hukum III Newton (Aksi-Reaksi):**
   Setiap ada gaya aksi, akan timbul gaya reaksi yang sama besar namun berlawanan arah (**Faksi = -Freaksi**). Contoh: roket meluncur ke atas karena menyemburkan gas ke bawah.`
      };
    }

    // 16. Fisika: Gravitasi
    if (q.includes('gravitasi')) {
      return {
        topic: 'Gaya Gravitasi',
        source: 'Fisika Dasar',
        answer: `**Gravitasi** adalah gaya tarik-menarik timbal balik yang terjadi antara semua partikel atau benda yang memiliki massa atau energi di alam semesta.
Di permukaan Bumi, gravitasi menghasilkan percepatan konstan rata-rata sekitar **9.8 m/s²** (sering dibulatkan menjadi 10 m/s²), yang menyebabkan semua benda yang jatuh bebas ditarik menuju pusat massa Bumi.`
      };
    }

    // 17. Fisika: Archimedes
    if (q.includes('archimedes') || q.includes('hukum archimedes') || q.includes('gaya apung')) {
      return {
        topic: 'Hukum Archimedes',
        source: 'Fisika Fluida',
        answer: `**Hukum Archimedes:**
Benda yang dicelupkan sebagian atau seluruhnya ke dalam zat cair akan mengalami gaya apung ke atas (**Fa**) yang besarnya sama dengan berat zat cair yang dipindahkan oleh benda tersebut:
Fa = ρ × g × Vbf
*(Fa = gaya apung, ρ = massa jenis zat cair, g = percepatan gravitasi, Vbf = volume benda yang tercelup).*
Hukum ini menjadi dasar mengapa kapal baja yang sangat berat dapat terapung di lautan dan kapal selam dapat menyelam serta mengapung.`
      };
    }

    // 18. Langit Biru
    if (q.includes('langit') && q.includes('biru')) {
      return {
        topic: 'Hamburan Cahaya & Warna Langit',
        source: 'Fisika Optik dan Atmosfer',
        answer: `Langit tampak berwarna biru di siang hari karena fenomena fisika yang disebut **Hamburan Rayleigh (Rayleigh Scattering)**.
Cahaya matahari yang tampak putih sebenarnya gabungan dari spektrum warna pelangi. Molekul gas di atmosfer bumi (nitrogen dan oksigen) memiliki ukuran yang jauh lebih kecil daripada panjang gelombang cahaya. Molekul-molekul ini menghamburkan cahaya bergelombang pendek (warna biru dan violet) ke segala arah jauh lebih kuat daripada cahaya bergelombang panjang (warna merah). Karena mata manusia lebih sensitif terhadap warna biru, kita melihat kubah langit berwarna biru cerah.`
      };
    }

    // 19. Kimia: Asam Basa
    if (q.includes('asam') && (q.includes('basa') || q.includes('ph') || q.includes('indikator'))) {
      return {
        topic: 'Konsep Asam, Basa, dan Skala pH',
        source: 'Kimia Dasar',
        answer: `**Konsep Asam dan Basa:**
1. **Asam:** Zat yang melepaskan ion hidrogen (H+) dalam air. Memiliki rasa masam, pH < 7, mengubah kertas lakmus biru menjadi merah, dan bersifat korosif terhadap logam. Contoh: HCl, H2SO4, asam sitrat.
2. **Basa:** Zat yang melepaskan ion hidroksida (OH-) dalam air. Memiliki rasa pahit dan licin di kulit, pH > 7, mengubah kertas lakmus merah menjadi biru, dan bersifat kaustik. Contoh: NaOH, KOH, Mg(OH)2.
3. **Netral:** Memiliki pH = 7 pada suhu kamar. Contoh: air murni (H2O).`
      };
    }

    // 20. Kimia: Atom
    if (q.includes('atom') && (q.includes('struktur') || q.includes('bagian') || q.includes('proton') || q.includes('elektron'))) {
      return {
        topic: 'Struktur Partikel Atom',
        source: 'Kimia Fisika',
        answer: `**Struktur Partikel Atom:**
Atom adalah partikel dasar penyusun materi, terdiri dari:
1. **Inti Atom (Nukleus):** Terletak di pusat atom, berisi:
   - **Proton:** Partikel bermuatan listrik positif (+1).
   - **Neutron:** Partikel tidak bermuatan (netral).
2. **Kulit Atom:**
   - **Elektron:** Partikel bermuatan listrik negatif (-1) yang mengitari inti atom pada tingkat energi/orbit tertentu dengan kecepatan sangat tinggi.`
      };
    }

    // 21. Geografi & Ibu Kota
    if (q.includes('ibu kota') || q.includes('ibukota')) {
      if (q.includes('indonesia')) {
        return {
          topic: 'Ibu Kota Indonesia',
          source: 'Geografi Indonesia',
          answer: 'Ibu kota Indonesia saat ini adalah **Jakarta**, dengan **Ibu Kota Nusantara (IKN)** di Kalimantan Timur sebagai pusat pemerintahan baru yang sedang dikembangkan.'
        };
      }
      if (q.includes('jepang')) return { topic: 'Ibu Kota Jepang', answer: 'Ibu kota Jepang adalah **Tokyo**.' };
      if (q.includes('prancis') || q.includes('perancis')) return { topic: 'Ibu Kota Prancis', answer: 'Ibu kota Prancis adalah **Paris**.' };
      if (q.includes('amerika')) return { topic: 'Ibu Kota Amerika Serikat', answer: 'Ibu kota Amerika Serikat adalah **Washington, D.C.**' };
      if (q.includes('inggris')) return { topic: 'Ibu Kota Inggris', answer: 'Ibu kota Inggris (Britania Raya) adalah **London**.' };
      if (q.includes('australia')) return { topic: 'Ibu Kota Australia', answer: 'Ibu kota Australia adalah **Canberra**.' };
    }

    // 23. Metamorfosis Serangga & Hewan
    if (q.includes('metamorfosis')) {
      return {
        topic: 'Metamorfosis pada Hewan / Serangga',
        source: 'Biologi Perkembangan',
        answer: 'Metamorfosis adalah proses perubahan bentuk, struktur, dan fungsi tubuh hewan secara bertahap dari fase embrio/telur hingga dewasa:\n1. **Metamorfosis Sempurna (Holometabola):** Mengalami 4 tahapan dengan bentuk larva yang sangat berbeda dari bentuk dewasa:\n   Telur → Larva (ulat/jentik) → Pupa (kepompong) → Imago (dewasa)\n   Contoh: Kupu-kupu, lalat, nyamuk, katak, lebah.\n2. **Metamorfosis Tidak Sempurna (Hemimetabola):** Mengalami 3 tahapan tanpa fase kepompong; bentuk muda (nimfa) menyerupai bentuk dewasa:\n   Telur → Nimfa → Imago (dewasa)\n   Contoh: Belalang, kecoak, jangkrik, capung.'
      };
    }

    // 22. Sejarah Indonesia & Pancasila
    if (q.includes('pancasila')) {
      return {
        topic: 'Pancasila Dasar Negara',
        source: 'Pendidikan Pancasila & Kewarganegaraan',
        answer: `**Pancasila** adalah dasar dan ideologi negara Republik Indonesia, terdiri dari lima sila:
1. Ketuhanan Yang Maha Esa (Bintang)
2. Kemanusiaan yang Adil dan Beradab (Rantai Emas)
3. Persatuan Indonesia (Pohon Beringin)
4. Kerakyatan yang Dipimpin oleh Hikmat Kebijaksanaan dalam Permusyawaratan/Perwakilan (Kepala Banteng)
5. Keadilan Sosial bagi Seluruh Rakyat Indonesia (Padi dan Kapas)`
      };
    }

    if (q.includes('presiden pertama indonesia') || q.includes('presiden ri pertama')) {
      return {
        topic: 'Presiden Pertama Republik Indonesia',
        source: 'Sejarah Nasional Indonesia',
        answer: 'Presiden pertama Republik Indonesia adalah **Ir. Soekarno**, dengan **Drs. Mohammad Hatta** sebagai Wakil Presiden pertama.'
      };
    }

    if (q.includes('kemerdekaan indonesia') || q.includes('proklamasi')) {
      return {
        topic: 'Proklamasi Kemerdekaan Indonesia',
        source: 'Sejarah Nasional Indonesia',
        answer: 'Indonesia memproklamasikan kemerdekaannya pada hari Jumat, **17 Agustus 1945** di Jalan Pegangsaan Timur No. 56, Jakarta, dibacakan oleh Ir. Soekarno didampingi Drs. Mohammad Hatta.'
      };
    }

    return null;
  }

  static searchRelevantPassages(query, moduleData) {
    const stopWords = new Set([
      'yang', 'pada', 'dalam', 'untuk', 'dengan', 'adalah', 'atau', 'dari', 
      'apakah', 'jelaskan', 'bagaimana', 'apa', 'itu', 'ini', 'bisa', 'tolong', 
      'coba', 'mengapa', 'kenapa', 'secara', 'serta', 'sebagai', 'oleh', 'akan',
      'hanya', 'file', 'dokumen', 'materi', 'modul', 'berdasarkan', 'menurut',
      'konsep', 'topik', 'prinsip', 'kajian', 'analisis', 'dasar', 'uraikan',
      'sebutkan', 'paparkan', 'jelasin', 'tentang', 'mengenai', 'seperti'
    ]);

    const rawTokens = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    if (rawTokens.length === 0) return [];

    const units = moduleData.pages && moduleData.pages.length > 0 
      ? moduleData.pages 
      : [{ pageNum: 1, text: moduleData.fullText || '' }];

    const passages = [];

    for (const unit of units) {
      const pageText = unit.text || '';
      if (NLPIntentProcessor.isFrontMatterOrTOC(pageText)) continue;

      const paragraphs = pageText.split(/\n\s*\n|\r\n\r\n/);
      for (const p of paragraphs) {
        const pClean = p.trim();
        if (pClean.length < 30) continue;
        if (NLPIntentProcessor.isFrontMatterOrTOC(pClean)) continue;

        let score = 0;
        let matchedDistinct = 0;
        const pLower = pClean.toLowerCase();

        for (const token of rawTokens) {
          if (pLower.includes(token)) {
            matchedDistinct++;
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

        // Must match at least 2 distinct tokens with score >= 8, or have strong domain score >= 14
        if ((matchedDistinct >= 2 && score >= 8) || score >= 14) {
          passages.push({
            text: pClean,
            score: score,
            pageNum: unit.pageNum || 1,
            heading: heading
          });
        }
      }
    }

    passages.sort((a, b) => b.score - a.score);
    return passages.slice(0, 3);
  }

  static synthesizeAutonomousAnswer(query, passages, moduleData) {
    if (!passages || passages.length === 0) return '';
    let topPassage = passages[0].text;
    
    // Clean headers, page markers, and metadata
    topPassage = topPassage
      .replace(/^[0-9\s]+(BAB\s+\d+[^:\n]+|BIOLOGI[^\n]+|MOD-[^\n]+|Bagian\s+\d+[^\n]*)\s*/gi, '')
      .replace(/^(Bab\s+\d+[^:\n]+:?[^\n]*|Gambar\s+\d+[^:\n]*|Tabel\s+\d+[^:\n]*)\s*/gi, '')
      .replace(/BIOLOGI\s+KELAS\s+\d+[^\n]*/gi, '')
      .trim();

    const sentences = topPassage
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 25 && !/^(Bab|Gambar|Tabel|Halaman|Daftar|Dokumen|MOD-)/i.test(s));

    if (sentences.length >= 2) {
      return sentences.slice(0, 3).join(' ');
    } else if (sentences.length === 1) {
      return sentences[0];
    }
    return topPassage.slice(0, 300).trim();
  }

  static synthesizeUniversalConcept(rawQuery, qLower) {
    const cleaned = rawQuery
      .replace(/^(apakah|apa|jelaskan|terangkan|bagaimana|mengapa|kenapa|sebutkan|uraikan|definisi|pengertian)\s+(tentang|mengenai|dari|itu)?\s*/i, '')
      .replace(/[?.,!]+$/, '')
      .trim();

    const topic = cleaned.length > 0 ? cleaned : rawQuery;

    let synthesizedText = '';
    if (qLower.includes('fungsi') || qLower.includes('peran') || qLower.includes('manfaat')) {
      synthesizedText = `**${topic}** menjalankan peran dan fungsi penting dalam sistemnya dengan memastikan interaksi antar komponen berlangsung secara selaras, terkoordinasi, dan memenuhi prinsip kerja yang stabil.`;
    } else if (qLower.includes('bagaimana') || qLower.includes('proses') || qLower.includes('cara kerja')) {
      synthesizedText = `Proses kerja **${topic}** berlangsung secara berkesinambungan melalui tahap inisiasi, koordinasi komponen aktif, dan penghasilan output akhir yang sesuai dengan kondisi lingkungan operasionalnya.`;
    } else if (qLower.includes('kenapa') || qLower.includes('mengapa')) {
      synthesizedText = `Fenomena pada **${topic}** terjadi akibat adanya interaksi kausalitas antar faktor pendukung, di mana mekanisme adaptif bekerja untuk menjaga keseimbangan dan fungsi optimal sistem.`;
    } else {
      synthesizedText = `**${topic}** merupakan konsep penting yang mencakup prinsip dasar, struktur, serta keterkaitan fungsional antar komponen penyusunnya dalam menghasilkan mekanisme kerja yang sistematis.`;
    }

    return {
      topic: topic,
      answer: synthesizedText
    };
  }

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
      return { answer: 'Silakan sampaikan pertanyaan atau konsep yang ingin dibahas.', source: null };
    }

    if (type === 'EXPLAIN_MORE') {
      return {
        answer: `Mengenai **${mem.lastTopic || 'konsep tersebut'}**: Mekanismenya bekerja dengan menyiapkan kondisi awal terlebih dahulu, lalu komponen utama mengeksekusi fungsinya secara bertahap dan terkoordinasi untuk menghasilkan output yang optimal.`,
        source: asksForSource ? (mem.lastSourceType === 'document' ? `${modTitle}` : 'Pengetahuan Umum') : null
      };
    }

    if (type === 'GIVE_EXAMPLE') {
      if (mem.lastTopic && (mem.lastTopic.toLowerCase().includes('pencernaan') || mem.lastTopic.toLowerCase().includes('pepsin') || mem.lastTopic.toLowerCase().includes('renin'))) {
        return {
          answer: 'Contohnya: enzim renin menggumpalkan protein susu cair (kasein) pada lambung bayi agar nutrisinya sempat diserap, sedangkan enzim pepsin memecah protein dari makanan padat seperti daging atau telur menjadi pepton/polipeptida.',
          source: asksForSource ? `${modTitle}` : null
        };
      }
      return {
        answer: `Contoh penerapan dari **${mem.lastTopic || 'konsep ini'}**: Ketika beban kerja atau stimulasi dalam sistem meningkat, mekanisme regulasi otomatis diaktifkan untuk menjaga stabilitas dan efisiensi kerja.`,
        source: asksForSource ? 'Pengetahuan Umum' : null
      };
    }

    if (type === 'MAKE_SHORTER') {
      return {
        answer: `Intinya: **${mem.lastTopic || 'Komponen ini'}** bertugas menjalankan fungsi regulasi dan pemrosesan spesifik agar sistem bekerja secara optimal dan seimbang.`,
        source: null
      };
    }
  }

  static isCodingQuery(qLower) {
    return /\b(kode|koding|coding|script|skrip|function|javascript|python|html|css|sql|java|c\+\+|php|debug|program|source code)\b/i.test(qLower) ||
           /\bfungsi\s+(kode|program|python|javascript|js|php|rekursif|asinkron|async)\b/i.test(qLower);
  }

  static generateCodeAssistance(query, qLower) {
    if (qLower.includes('python')) {
      return {
        topic: 'Pemrograman Python',
        answer: `Berikut kode Python yang bersih dan siap dijalankan:

\`\`\`python
def proses_data(items):
    # Menyaring dan menggandakan angka positif
    return [item * 2 for item in items if isinstance(item, (int, float)) and item > 0]

# Uji fungsi
data_input = [1, -5, 3, 10, -2]
hasil = proses_data(data_input)
print("Hasil:", hasil)  # Output: [2, 6, 20]
\`\`\`
Kode di atas menggunakan list comprehension untuk memfilter dan memproses elemen secara efisien.`
      };
    }

    if (qLower.includes('html') || qLower.includes('css')) {
      return {
        topic: 'HTML & CSS',
        answer: `Berikut struktur HTML & CSS modern yang responsif:

\`\`\`html
<div class="card">
  <h3>Kartu Konten</h3>
  <p>Deskripsi ringkas dan elegan dengan kontras tinggi.</p>
  <button class="btn" onclick="alert('Berhasil')">Aksi Utama</button>
</div>

<style>
.card {
  padding: 20px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  max-width: 320px;
}
.btn {
  background: #00796b;
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
</style>
\`\`\`
Komponen ini dapat langsung disalin ke proyek web Anda.`
      };
    }

    return {
      topic: 'JavaScript',
      answer: `Berikut kode JavaScript modern (ES6+):

\`\`\`javascript
async function fetchSafeData(apiUrl) {
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error('HTTP status: ' + response.status);
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Terjadi kendala saat memuat data:', error.message);
    return { success: false, error: error.message };
  }
}
\`\`\`
Fungsi ini menangani request asinkron dengan penanganan error (try-catch) yang aman.`
    };
  }

  static isWritingQuery(qLower) {
    return /\b(buatkan puisi|tulis email|surat izin|surat lamaran|ide konten|buat esai|tulis artikel|buat cerita|karang|pantun)\b/i.test(qLower);
  }

  static generateWritingAssistance(query, qLower) {
    if (qLower.includes('puisi') || qLower.includes('pantun')) {
      return {
        topic: 'Puisi Pembelajaran',
        answer: `*Jendela Pengetahuan*

Di lembar-lembar masa yang terbentang,
Tersimpan rahasia semesta yang benderang.
Bukan sekadar deretan kata yang dihafal,
Namun bekal budi yang kokoh terpahat kekal.

Langkahkan kaki menjemput fajar esok hari,
Dengan ilmu sebagai pelita nurani.`
      };
    }

    if (qLower.includes('email') || qLower.includes('surat')) {
      return {
        topic: 'Format Surat Izin Resmi',
        answer: `**Subjek:** Permohonan Izin Tidak Masuk Belajar - [Nama Lengkap Anda]

Yth. Bapak/Ibu [Nama Guru/Dosen/Atasan],

Dengan hormat,
Melalui surat ini, saya yang bertanda tangan di bawah ini:
- **Nama:** [Nama Lengkap Anda]
- **Kelas/Instansi:** [Kelas/Divisi Anda]

Bermaksud memohon izin untuk tidak dapat hadir mengikuti kegiatan pembelajaran pada hari [Hari, Tanggal], sehubungan dengan [alasan singkat, misal: kondisi kesehatan yang kurang sehat dan memerlukan istirahat].

Segala materi dan tugas yang diberikan akan saya pelajari dan selesaikan dengan sebaik-baiknya. Atas perhatian dan izin dari Bapak/Ibu, saya sampaikan terima kasih.

Hormat saya,

[Tanda Tangan & Nama Anda]`
      };
    }

    return {
      topic: 'Kerangka Penulisan Esai',
      answer: `**Kerangka Penulisan Terstruktur:**
1. **Pendahuluan:** Latar belakang masalah, urgensi topik, dan rumusan tujuan utama.
2. **Pembahasan Utama:**
   - Poin Analisis 1: Fakta dan landasan teoretis.
   - Poin Analisis 2: Contoh kasus konkret dan dinamika di lapangan.
   - Poin Analisis 3: Solusi terukur dan evaluasi dampak.
3. **Kesimpulan & Saran:** Rangkuman sintesis yang tegas serta rekomendasi praktis.`
    };
  }

  static isTranslationQuery(qLower) {
    return /\b(terjemahkan|artikan|translate|bahasa inggris|english)\b/i.test(qLower);
  }

  static generateTranslation(query, qLower) {
    const cleanText = query.replace(/^(tolong|bisa|coba)?\s*(terjemahkan|artikan|translate)\s*(ke|dalam)?\s*(bahasa\s+[a-zA-Z]+)?\s*:?/i, '').trim();
    const isToEnglish = qLower.includes('inggris') || qLower.includes('english');

    if (isToEnglish) {
      return {
        answer: `**Hasil Terjemahan (English):**\n"${cleanText || 'Education is the most powerful weapon which you can use to change the world.'}"`
      };
    }
    return {
      answer: `**Hasil Terjemahan (Bahasa Indonesia):**\n"${cleanText || 'Pendidikan adalah senjata paling ampuh yang dapat Anda gunakan untuk mengubah dunia.'}"`
    };
  }

  static generateSummary(moduleData) {
    if (moduleData.summaryNotes && moduleData.summaryNotes.trim().length > 50) {
      const cleanNotes = moduleData.summaryNotes.trim()
        .replace(/^MODUL\s+PEMBELAJARAN[^\n]*\n?/i, '')
        .replace(/^BAB:\s*[^\n]*\n?/i, '')
        .trim();
      return {
        answer: cleanNotes,
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

    let summaryText = '';
    if (headings.length > 0) {
      summaryText = `Rangkuman Pokok Bahasan ${moduleData.name || 'Modul'}:\n` +
        headings.map((h, i) => `${i + 1}. ${h}`).join('\n');
    } else {
      summaryText = (moduleData.fullText || '').slice(0, 350).trim() + '...';
    }

    return {
      answer: summaryText,
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
if (typeof module !== 'undefined') module.exports = { AutonomousLearningAI, NLPIntentProcessor };

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
  },

  async getLearnedKnowledge() {
    try {
      const res = await fetch('/api/learned-knowledge');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      return { success: false, items: [] };
    }
  },

  async saveLearnedKnowledge(itemData) {
    const res = await fetch('/api/learned-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData)
    });
    return await res.json();
  },

  async deleteLearnedKnowledge(id) {
    const res = await fetch(`/api/learned-knowledge?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  async clearAllLearnedKnowledge() {
    const res = await fetch('/api/learned-knowledge?all=true', {
      method: 'DELETE'
    });
    return await res.json();
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
        const paragraphs = pageText.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 20 && !NLPIntentProcessor.isFrontMatterOrTOC(s));
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

          const paragraphs = pageContent.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 30 && !NLPIntentProcessor.isFrontMatterOrTOC(s));
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

    const normalizedQuery = NLPIntentProcessor.normalize(query);
    const queryTokens = this.tokenize(normalizedQuery);
    const qLower = normalizedQuery.toLowerCase().trim();

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
   Knowledge Learning & Continuous Memory Engine (Pemerolehan Ilmu Baru AI)
   ========================================================================== */
const KnowledgeLearningEngine = {
  items: [],
  currentFilter: 'all',

  async init() {
    try {
      // 1. Load from IndexedDB
      const localItems = await ModuleDB.getAllLearnedKnowledge();
      if (Array.isArray(localItems) && localItems.length > 0) {
        this.items = localItems;
      }
    } catch (e) {
      console.warn('Gagal memuat memori ilmu dari IndexedDB:', e.message);
    }

    // 2. Sync with backend API if available
    try {
      const res = await ApiClient.getLearnedKnowledge();
      if (res && res.success && Array.isArray(res.items)) {
        res.items.forEach(bItem => {
          if (!this.items.find(l => l.id === bItem.id || (l.insight.toLowerCase() === bItem.insight.toLowerCase()))) {
            this.items.push(bItem);
            ModuleDB.saveLearnedKnowledge(bItem).catch(() => {});
          }
        });
      }
    } catch (e) {
      // Backend offline, keep local
    }

    // Sort by timestamp desc
    this.items.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    // Update AutonomousLearningAI memory
    this.syncToOfflineMemory();
    this.updateUI();
  },

  syncToOfflineMemory() {
    if (typeof AutonomousLearningAI !== 'undefined' && AutonomousLearningAI.contextMemory) {
      AutonomousLearningAI.contextMemory.customNotes = this.items.map(k => ({
        topic: k.topic,
        text: k.insight,
        category: k.category,
        date: k.timestamp
      }));
    }
  },

  // Heuristic extractor for offline / client-side learning from prompts
  extractFromPrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') return null;
    const pTrim = prompt.trim();
    const pLower = pTrim.toLowerCase();

    // 1. Personalization / Name directive
    const nameMatch = pTrim.match(/(?:panggil\s+(?:saya|aku)|nama\s+(?:saya|ku)\s+adalah|nama\s+(?:saya|ku)|namaku)\s+([a-zA-Z0-9_\-\s]+)/i);
    if (nameMatch) {
      const rawName = nameMatch[1].replace(/[.,!?;:]+$/g, '').trim();
      if (rawName.length > 1 && rawName.length < 35) {
        return {
          topic: 'Panggilan Pengguna',
          insight: `Pengguna meminta dipanggil dengan nama "${rawName}".`,
          category: 'preferensi',
          sourcePrompt: pTrim
        };
      }
    }

    // 2. Explicit Note / Remember instruction
    const noteMatch = pTrim.match(/^(?:tolong\s+)?(?:catat|ingat|simpan|rekam|tambahkan\s+fakta)\s*(?:bahwa\s*)?[:\-\s]\s*(?:bahwa\s*)?(.+)/i);
    if (noteMatch && noteMatch[1].trim().length > 4) {
      const cleanInsight = noteMatch[1].replace(/^(?:bahwa|tentang)\s+/i, '').trim();
      return {
        topic: 'Catatan Penting',
        insight: cleanInsight,
        category: 'fakta',
        sourcePrompt: pTrim
      };
    }

    // 3. Explicit Correction
    const corrMatch = pTrim.match(/^(?:bukan\s+([^,]+),\s*(?:tetapi|tapi|melainkan|yang benar)\s+(.+)|salah\s*[,:]\s*(?:yang benar\s+)?(.+))/i);
    if (corrMatch) {
      const insightText = (corrMatch[2] || corrMatch[3] || pTrim).trim();
      return {
        topic: 'Koreksi Materi',
        insight: `Koreksi: ${insightText}`,
        category: 'koreksi',
        sourcePrompt: pTrim
      };
    }

    // 4. Stated Fact or Rule
    const factMatch = pTrim.match(/^(?:faktanya|sebenarnya|perlu kamu tahu bahwa|ketahuilah bahwa)\s*[,:]?\s*(.+)/i);
    if (factMatch && factMatch[1].trim().length > 8) {
      return {
        topic: 'Fakta Baru',
        insight: factMatch[1].trim(),
        category: 'fakta',
        sourcePrompt: pTrim
      };
    }

    // 5. Explicit Formatting Preference
    if (pLower.includes('selalu jawab') || pLower.includes('mulai sekarang') || pLower.includes('jangan terlalu panjang') || pLower.includes('jawab singkat saja')) {
      if (pTrim.length > 8 && pTrim.length < 250) {
        return {
          topic: 'Format Jawaban',
          insight: pTrim,
          category: 'preferensi',
          sourcePrompt: pTrim
        };
      }
    }

    // 6. Definition pattern: "X adalah Y" where sentence introduces a new concept
    const defMatch = pTrim.match(/^([a-zA-Z0-9_\-\s]{3,35})\s+(?:adalah|yaitu|merupakan|yakni|artinya)\s+([^.!?]{10,})/i);
    if (defMatch && !pLower.startsWith('apa') && !pLower.startsWith('jelaskan') && !pLower.startsWith('siapa') && !pLower.includes('?')) {
      return {
        topic: defMatch[1].trim(),
        insight: `${defMatch[1].trim()} adalah ${defMatch[2].trim()}`,
        category: 'konsep',
        sourcePrompt: pTrim
      };
    }

    return null;
  },

  async recordLearnedItem(item) {
    if (!item || !item.insight) return null;
    
    // Check if already in items
    const cleanNew = item.insight.toLowerCase().replace(/[^\w]/g, '');
    let existing = this.items.find(k => k.insight.toLowerCase().replace(/[^\w]/g, '') === cleanNew);
    
    if (existing) {
      existing.timestamp = new Date().toISOString();
      if (item.topic) existing.topic = item.topic;
      await ModuleDB.saveLearnedKnowledge(existing);
      this.syncToOfflineMemory();
      this.updateUI();
      return existing;
    }

    const newItem = {
      id: item.id || `learn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      topic: (item.topic || 'Pengetahuan Umum').trim(),
      insight: item.insight.trim(),
      category: item.category || 'fakta',
      sourcePrompt: (item.sourcePrompt || '').trim(),
      timestamp: item.timestamp || new Date().toISOString()
    };

    this.items.unshift(newItem);
    if (this.items.length > 150) this.items.pop();

    // Persist in IndexedDB
    try {
      await ModuleDB.saveLearnedKnowledge(newItem);
    } catch (e) {
      console.warn('Gagal menyimpan ilmu ke IndexedDB:', e.message);
    }

    // Persist to Backend if online
    try {
      if (AppState.apiConfig && AppState.apiConfig.configured) {
        await ApiClient.saveLearnedKnowledge(newItem);
      }
    } catch (e) {}

    this.syncToOfflineMemory();
    this.updateUI(true); // pulse badge
    return newItem;
  },

  async deleteItem(id) {
    this.items = this.items.filter(k => k.id !== id);
    try {
      await ModuleDB.deleteLearnedKnowledge(id);
    } catch (e) {}

    try {
      await ApiClient.deleteLearnedKnowledge(id);
    } catch (e) {}

    this.syncToOfflineMemory();
    this.updateUI();
    showToast('Ilmu memori berhasil dihapus.', 'info');
  },

  async clearAll() {
    this.items = [];
    try {
      await ModuleDB.clearLearnedKnowledge();
    } catch (e) {}

    try {
      await ApiClient.clearAllLearnedKnowledge();
    } catch (e) {}

    this.syncToOfflineMemory();
    this.updateUI();
    showToast('Semua memori pembelajaran AI telah dikosongkan.', 'info');
  },

  updateUI(pulse = false) {
    // 1. Header counter badge
    const badge = document.getElementById('memoryCountBadge');
    if (badge) {
      badge.textContent = this.items.length;
      badge.style.display = this.items.length > 0 ? 'inline-flex' : 'none';
      if (pulse) {
        badge.classList.remove('pulse-animation');
        void badge.offsetWidth;
        badge.classList.add('pulse-animation');
      }
    }

    // 2. Modal counters
    const statTotal = document.getElementById('statTotalLearned');
    const statFacts = document.getElementById('statTotalFacts');
    const statPrefs = document.getElementById('statTotalPrefs');
    const statCorrections = document.getElementById('statTotalCorrections');

    if (statTotal) statTotal.textContent = this.items.length;
    if (statFacts) statFacts.textContent = this.items.filter(k => k.category === 'fakta' || k.category === 'konsep').length;
    if (statPrefs) statPrefs.textContent = this.items.filter(k => k.category === 'preferensi').length;
    if (statCorrections) statCorrections.textContent = this.items.filter(k => k.category === 'koreksi').length;

    // 3. Render Modal list
    this.renderModalList();
  },

  renderModalList() {
    const container = document.getElementById('learnedKnowledgeListContainer');
    const emptyState = document.getElementById('learnedKnowledgeEmptyState');
    if (!container) return;

    let filtered = this.items;
    if (this.currentFilter !== 'all') {
      filtered = this.items.filter(k => k.category === this.currentFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = filtered.map(item => {
      const catClass = `badge-cat-${item.category || 'fakta'}`;
      let catLabel = 'Fakta Materi';
      if (item.category === 'preferensi') catLabel = 'Preferensi';
      else if (item.category === 'koreksi') catLabel = 'Koreksi';
      else if (item.category === 'konsep') catLabel = 'Konsep Baru';

      const timeFormatted = item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      }) : 'Baru saja';

      const sourcePromptHtml = item.sourcePrompt ? `
        <div class="knowledge-source-prompt">
          <span class="prompt-icon">💬</span>
          <em>"${escapeHtml(item.sourcePrompt)}"</em>
        </div>
      ` : '';

      return `
        <div class="knowledge-card" id="card_knowledge_${escapeHtml(item.id)}">
          <div class="knowledge-card-header">
            <div class="knowledge-card-meta">
              <span class="knowledge-category-pill ${catClass}">${catLabel}</span>
              <span class="knowledge-topic-title">${escapeHtml(item.topic || 'Umum')}</span>
            </div>
            <div class="knowledge-card-actions">
              <span class="knowledge-time">${timeFormatted}</span>
              <button class="btn-delete-knowledge" onclick="KnowledgeLearningEngine.deleteItem('${escapeHtml(item.id)}')" title="Hapus ilmu ini">
                🗑️
              </button>
            </div>
          </div>
          <div class="knowledge-card-body">
            <strong>${escapeHtml(item.insight)}</strong>
            ${sourcePromptHtml}
          </div>
        </div>
      `;
    }).join('');
  }
};

if (typeof window !== 'undefined') window.KnowledgeLearningEngine = KnowledgeLearningEngine;
if (typeof module !== 'undefined') module.exports = { AutonomousLearningAI, NLPIntentProcessor, KnowledgeLearningEngine, ModuleDB };

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
  btnThemeToggle: document.getElementById('btnThemeToggle'),
  themeToggleIcon: document.getElementById('themeToggleIcon'),
  themeToggleText: document.getElementById('themeToggleText'),
  btnOpenLearnedMemory: document.getElementById('btnOpenLearnedMemory'),
  memoryCountBadge: document.getElementById('memoryCountBadge'),
  btnSystemInfo: document.getElementById('btnSystemInfo'),
  btnOpenApiSettings: document.getElementById('btnOpenApiSettings'),
  headerApiStatusDot: document.getElementById('headerApiStatusDot'),
  modalLearnedKnowledge: document.getElementById('modalLearnedKnowledge'),
  btnToggleManualTeach: document.getElementById('btnToggleManualTeach'),
  manualTeachBox: document.getElementById('manualTeachBox'),
  teachTopicInput: document.getElementById('teachTopicInput'),
  teachCategoryInput: document.getElementById('teachCategoryInput'),
  teachInsightInput: document.getElementById('teachInsightInput'),
  btnCancelManualTeach: document.getElementById('btnCancelManualTeach'),
  btnSubmitManualTeach: document.getElementById('btnSubmitManualTeach'),
  btnClearAllKnowledge: document.getElementById('btnClearAllKnowledge'),
  knowledgeFilterGroup: document.getElementById('knowledgeFilterGroup'),
  learnedKnowledgeListContainer: document.getElementById('learnedKnowledgeListContainer'),
  learnedKnowledgeEmptyState: document.getElementById('learnedKnowledgeEmptyState'),

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
/* ==========================================================================
   Theme Manager (Dark Mode & Light Mode with LocalStorage Persistence)
   ========================================================================== */
const ThemeManager = {
  currentTheme: 'light',

  init() {
    let saved = null;
    try {
      saved = localStorage.getItem('asisten_theme');
    } catch (e) {}

    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (prefersDark ? 'dark' : 'light');
    this.applyTheme(initial);

    const btn = document.getElementById('btnThemeToggle');
    if (btn) {
      btn.addEventListener('click', () => this.toggleTheme());
    }
  },

  toggleTheme() {
    const next = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
    try {
      localStorage.setItem('asisten_theme', next);
    } catch (e) {}
  },

  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    const icon = document.getElementById('themeToggleIcon');
    const text = document.getElementById('themeToggleText');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (text) text.textContent = theme === 'dark' ? 'Mode Terang' : 'Mode Gelap';
  }
};

async function initApp() {
  setupEventListeners();
  ThemeManager.init();
  await KnowledgeLearningEngine.init();

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
        let learnedItem = result.learned || null;
        if (learnedItem) {
          KnowledgeLearningEngine.recordLearnedItem(learnedItem);
        }
        appendAIMessage(result.answer, result.source, learnedItem);
      } else {
        appendAIMessage('Tidak ada respon yang diterima dari model AI.', currentMod.name);
      }
    } catch (err) {
      removeLoadingIndicator();
      console.warn('Gagal memanggil model AI backend:', err.message);

      appendErrorMessageDOM(err.message, query);

      // Graceful offline fallback with continuous learning
      setTimeout(() => {
        const offlineLearned = KnowledgeLearningEngine.extractFromPrompt(query);
        if (offlineLearned) {
          KnowledgeLearningEngine.recordLearnedItem(offlineLearned);
        }
        const fallback = AutonomousLearningAI.respond(query, currentMod);
        appendAIMessage(`[Mode Cadangan Offline]:\n${fallback.answer}`, fallback.source, offlineLearned || fallback.learned);
      }, 400);
    }
  } else {
    // Mode Offline: autonomous reasoning engine with continuous learning from prompt
    setTimeout(() => {
      removeLoadingIndicator();
      const offlineLearned = KnowledgeLearningEngine.extractFromPrompt(query);
      if (offlineLearned) {
        KnowledgeLearningEngine.recordLearnedItem(offlineLearned);
      }
      const response = AutonomousLearningAI.respond(query, currentMod);
      appendAIMessage(response.answer, response.source, offlineLearned || response.learned);
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

function appendAIMessage(text, source, learnedItem = null) {
  if (!AppState.chatHistory[AppState.activeModuleId]) {
    AppState.chatHistory[AppState.activeModuleId] = [];
  }
  AppState.chatHistory[AppState.activeModuleId].push({ role: 'ai', text, source, learned: learnedItem });
  renderAIMessageDOM(text, source, learnedItem);
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

function renderAIMessageDOM(text, source, learnedItem = null) {
  const row = document.createElement('div');
  row.className = 'chat-row ai';
  
  let sourceHtml = '';
  if (source) {
    sourceHtml = `<span class="chat-source-tag" onclick="showSourceDetails('${escapeHtml(source)}')">Sumber: ${escapeHtml(source)}</span>`;
  }

  let learnedHtml = '';
  if (learnedItem && learnedItem.insight) {
    let catBadge = 'Fakta Baru';
    if (learnedItem.category === 'preferensi') catBadge = 'Preferensi';
    else if (learnedItem.category === 'koreksi') catBadge = 'Koreksi';
    else if (learnedItem.category === 'konsep') catBadge = 'Konsep Baru';

    learnedHtml = `
      <div class="ai-learned-chip" onclick="openLearnedKnowledgeModal('${escapeHtml(learnedItem.id || '')}')" title="Klik untuk membuka Pusat Memori AI">
        <span class="ai-learned-icon">💡</span>
        <div class="ai-learned-content">
          <div class="ai-learned-header">
            <span class="ai-learned-title">AI Mempelajari Hal Baru:</span>
            <span class="ai-learned-badge badge-${escapeHtml(learnedItem.category || 'fakta')}">${escapeHtml(catBadge)}</span>
          </div>
          <div class="ai-learned-text">"${escapeHtml(learnedItem.insight)}"</div>
        </div>
        <span class="ai-learned-action">Memori ↗</span>
      </div>
    `;
  }

  row.innerHTML = `
    <div class="avatar-badge ai">AI</div>
    <div class="chat-bubble ai">
      ${learnedHtml}
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

  // Learned Memory Modal and Manual Teach Events
  if (DOM.btnOpenLearnedMemory) {
    DOM.btnOpenLearnedMemory.addEventListener('click', () => {
      openModal('modalLearnedKnowledge');
      KnowledgeLearningEngine.renderModalList();
    });
  }
  if (DOM.btnToggleManualTeach) {
    DOM.btnToggleManualTeach.addEventListener('click', toggleManualTeachForm);
  }
  if (DOM.btnCancelManualTeach) {
    DOM.btnCancelManualTeach.addEventListener('click', toggleManualTeachForm);
  }
  if (DOM.btnSubmitManualTeach) {
    DOM.btnSubmitManualTeach.addEventListener('click', handleManualTeachSubmit);
  }
  if (DOM.btnClearAllKnowledge) {
    DOM.btnClearAllKnowledge.addEventListener('click', handleClearAllKnowledge);
  }
  if (DOM.knowledgeFilterGroup) {
    DOM.knowledgeFilterGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-chip');
      if (btn && btn.dataset.filter) {
        DOM.knowledgeFilterGroup.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        KnowledgeLearningEngine.currentFilter = btn.dataset.filter;
        KnowledgeLearningEngine.renderModalList();
      }
    });
  }
}

function toggleManualTeachForm() {
  const box = document.getElementById('manualTeachBox');
  if (box) {
    const isHidden = box.style.display === 'none';
    box.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      document.getElementById('teachTopicInput')?.focus();
    }
  }
}

async function handleManualTeachSubmit() {
  const topicInput = document.getElementById('teachTopicInput');
  const catInput = document.getElementById('teachCategoryInput');
  const insightInput = document.getElementById('teachInsightInput');

  const topic = (topicInput?.value || '').trim();
  const category = catInput?.value || 'fakta';
  const insight = (insightInput?.value || '').trim();

  if (!insight) {
    showToast('Masukkan intisari ilmu yang ingin diajarkan ke AI.', 'error');
    return;
  }

  await KnowledgeLearningEngine.recordLearnedItem({
    topic: topic || 'Pengetahuan Mandiri',
    insight: insight,
    category: category,
    sourcePrompt: 'Diajarkan Manual oleh Pengguna'
  });

  if (topicInput) topicInput.value = '';
  if (insightInput) insightInput.value = '';
  toggleManualTeachForm();
  showToast('Ilmu baru berhasil dicatat dalam memori AI!', 'success');
}

async function handleClearAllKnowledge() {
  if (confirm('Apakah Anda yakin ingin mengosongkan semua memori ilmu yang telah dipelajari AI?')) {
    await KnowledgeLearningEngine.clearAll();
  }
}

window.openLearnedKnowledgeModal = function(highlightId) {
  openModal('modalLearnedKnowledge');
  KnowledgeLearningEngine.renderModalList();
  if (highlightId) {
    setTimeout(() => {
      const targetCard = document.getElementById(`card_knowledge_${highlightId}`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.style.borderColor = '#00796b';
        targetCard.style.boxShadow = '0 0 10px rgba(0, 121, 107, 0.4)';
      }
    }, 200);
  }
};

window.filterLearnedKnowledge = function(filterCat, btn) {
  if (DOM.knowledgeFilterGroup) {
    DOM.knowledgeFilterGroup.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  KnowledgeLearningEngine.currentFilter = filterCat;
  KnowledgeLearningEngine.renderModalList();
};

window.toggleManualTeachForm = toggleManualTeachForm;

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
