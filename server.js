/**
 * Asisten Belajar - Secure Backend Server & AI API Gateway
 * Pure Node.js (Zero npm dependencies required)
 * 
 * Features:
 * 1. Static asset server (HTML, CSS, JS, PDF)
 * 2. Secure API configuration storage (Keys NEVER exposed to client)
 * 3. AI Model Gateway (Google Gemini & OpenAI-compatible APIs)
 * 4. Strict document-grounded RAG answering (Anti-hallucination)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 5173;
const CONFIG_FILE = path.join(__dirname, 'api_config.json');
const KNOWLEDGE_FILE = path.join(__dirname, 'learned_knowledge.json');

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Load or initialize config securely on backend
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading api_config.json:', err.message);
  }
  return {
    provider: 'gemini', // 'gemini', 'openai', 'custom'
    apiKey: '',
    model: 'gemini-1.5-flash',
    baseUrl: ''
  };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving api_config.json:', err.message);
    return false;
  }
}

// Mask API key for safe frontend display (e.g. AIzaSy...9xK)
function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

// --------------------------------------------------------------------------
// Learned Knowledge Storage & Continuous Learning Engine
// --------------------------------------------------------------------------
function loadLearnedKnowledge() {
  try {
    if (fs.existsSync(KNOWLEDGE_FILE)) {
      const raw = fs.readFileSync(KNOWLEDGE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading learned_knowledge.json:', err.message);
  }
  return [];
}

function saveLearnedKnowledge(items) {
  try {
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(items, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving learned_knowledge.json:', err.message);
    return false;
  }
}

function addLearnedKnowledgeItem(item) {
  if (!item || !item.insight || !item.insight.trim()) return null;
  const items = loadLearnedKnowledge();
  
  const newItem = {
    id: item.id || `learn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    topic: (item.topic || 'Pengetahuan Umum').trim(),
    insight: item.insight.trim(),
    category: item.category || 'fakta', // 'fakta', 'preferensi', 'koreksi', 'konsep'
    sourcePrompt: (item.sourcePrompt || '').trim(),
    timestamp: item.timestamp || new Date().toISOString()
  };

  // Deduplicate if identical or near-identical insight exists
  const cleanNew = newItem.insight.toLowerCase().replace(/[^\w]/g, '');
  const existingIdx = items.findIndex(k => {
    const cleanOld = k.insight.toLowerCase().replace(/[^\w]/g, '');
    return cleanOld === cleanNew || (cleanOld.length > 25 && cleanNew.includes(cleanOld));
  });

  if (existingIdx !== -1) {
    items[existingIdx] = { ...items[existingIdx], ...newItem, id: items[existingIdx].id };
    saveLearnedKnowledge(items);
    return items[existingIdx];
  } else {
    items.unshift(newItem);
    if (items.length > 150) items.pop();
    saveLearnedKnowledge(items);
    return newItem;
  }
}

// Rule-based heuristic knowledge extractor from user prompts
function extractHeuristicKnowledge(prompt) {
  if (!prompt || typeof prompt !== 'string') return null;
  const pTrim = prompt.trim();
  const pLower = pTrim.toLowerCase();

  // 1. Personalization / Name directive
  const nameMatch = pTrim.match(/(?:panggil\s+(?:saya|aku)|nama\s+(?:saya|ku)\s+adalah|nama\s+(?:saya|ku)|namaku)\s+([a-zA-Z0-9_\-\s\.]+)/i);
  if (nameMatch) {
    const rawName = nameMatch[1].replace(/[.,!?;:]+$/g, '').trim();
    if (rawName.length > 1 && rawName.length < 35) {
      return {
        topic: 'Identitas & Panggilan Pengguna',
        insight: `Pengguna meminta dipanggil dengan nama "${rawName}". Selalu sapa atau panggil pengguna dengan nama ini.`,
        category: 'preferensi'
      };
    }
  }

  // 2. Explicit Note / Fact registration
  const noteMatch = pTrim.match(/^(?:tolong\s+)?(?:catat|ingat|simpan|rekam|tambahkan\s+fakta)\s*(?:bahwa\s*)?[:\-\s]\s*(?:bahwa\s*)?(.+)/i);
  if (noteMatch && noteMatch[1].trim().length > 4) {
    const cleanInsight = noteMatch[1].replace(/^(?:bahwa|tentang)\s+/i, '').trim();
    return {
      topic: 'Catatan Pengguna',
      insight: cleanInsight,
      category: 'fakta'
    };
  }

  // 3. Explicit Correction
  const corrMatch = pTrim.match(/^(?:bukan\s+([^,]+),\s*(?:tetapi|tapi|melainkan|yang benar)\s+(.+)|salah\s*[,:]\s*(?:yang benar\s+)?(.+))/i);
  if (corrMatch) {
    const insightText = (corrMatch[2] || corrMatch[3] || pTrim).trim();
    return {
      topic: 'Koreksi Materi',
      insight: `Koreksi materi: ${insightText}`,
      category: 'koreksi'
    };
  }

  // 4. Stated Fact or Rule
  const factMatch = pTrim.match(/^(?:faktanya|sebenarnya|perlu kamu tahu bahwa|ketahuilah bahwa)\s*[,:]?\s*(.+)/i);
  if (factMatch && factMatch[1].trim().length > 8) {
    return {
      topic: 'Informasi Baru',
      insight: factMatch[1].trim(),
      category: 'fakta'
    };
  }

  // 5. Explicit Formatting Preference
  if (pLower.includes('selalu jawab') || pLower.includes('mulai sekarang') || pLower.includes('jangan terlalu panjang') || pLower.includes('jawab singkat saja')) {
    if (pTrim.length > 8 && pTrim.length < 250) {
      return {
        topic: 'Preferensi Format Jawaban',
        insight: pTrim,
        category: 'preferensi'
      };
    }
  }

  return null;
}


// HTTP request helper
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Request entity too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Call Google Gemini API
function callGemini(apiKey, model, systemPrompt, userPrompt, history = []) {
  return new Promise((resolve, reject) => {
    const modelName = model || 'gemini-1.5-flash';
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // Prepare contents
    const contents = [];
    
    // Add brief history
    if (Array.isArray(history) && history.length > 0) {
      history.slice(-4).forEach(h => {
        if (h.role && h.text) {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          });
        }
      });
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }]
    });

    const payload = {
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.2, // Low temperature for high factual accuracy
        maxOutputTokens: 1200
      }
    };

    const parsedUrl = new URL(targetUrl);
    const postData = JSON.stringify(payload);

    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const resp = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const answer = resp.candidates?.[0]?.content?.parts?.[0]?.text;
            if (answer) {
              resolve(answer);
            } else {
              reject(new Error('Respon Gemini tidak memuat teks kandidat.'));
            }
          } else {
            const errMsg = resp.error?.message || `HTTP error ${res.statusCode}`;
            reject(new Error(`Gemini API Error: ${errMsg}`));
          }
        } catch (e) {
          reject(new Error(`Gagal mem-parsing respon Gemini: ${e.message}`));
        }
      });
    });

    req.on('error', err => reject(new Error(`Koneksi ke Gemini gagal: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Permintaan ke Gemini melebihi batas waktu (timeout).'));
    });

    req.write(postData);
    req.end();
  });
}

// Call OpenAI or OpenAI-Compatible API (e.g. Groq, Ollama, OpenRouter)
function callOpenAICompatible(apiKey, baseUrl, model, systemPrompt, userPrompt, history = []) {
  return new Promise((resolve, reject) => {
    const rawBaseUrl = baseUrl || 'https://api.openai.com/v1';
    const targetUrl = rawBaseUrl.replace(/\/+$/, '') + '/chat/completions';
    const modelName = model || 'gpt-4o-mini';

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (Array.isArray(history) && history.length > 0) {
      history.slice(-4).forEach(h => {
        if (h.role && h.text) {
          messages.push({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.text
          });
        }
      });
    }

    messages.push({ role: 'user', content: userPrompt });

    const payload = {
      model: modelName,
      messages: messages,
      temperature: 0.2,
      max_tokens: 1200
    };

    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const postData = JSON.stringify(payload);

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const req = client.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: headers,
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const resp = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const answer = resp.choices?.[0]?.message?.content;
            if (answer) {
              resolve(answer);
            } else {
              reject(new Error('Respon OpenAI tidak memuat konten pesan.'));
            }
          } else {
            const errMsg = resp.error?.message || `HTTP error ${res.statusCode}`;
            reject(new Error(`API Error: ${errMsg}`));
          }
        } catch (e) {
          reject(new Error(`Gagal mem-parsing respon API: ${e.message}`));
        }
      });
    });

    req.on('error', err => reject(new Error(`Koneksi API gagal: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Permintaan API melebihi batas waktu (timeout).'));
    });

    req.write(postData);
    req.end();
  });
}

// Master Request Handler
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // --------------------------------------------------------------------------
  // API Endpoints
  // --------------------------------------------------------------------------

  // 1. GET /api/config (Safe check, never exposes secret key)
  if (req.method === 'GET' && pathname === '/api/config') {
    const cfg = loadConfig();
    return sendJSON(res, 200, {
      configured: Boolean(cfg.apiKey && cfg.apiKey.trim().length > 0),
      provider: cfg.provider || 'gemini',
      model: cfg.model || 'gemini-1.5-flash',
      baseUrl: cfg.baseUrl || '',
      maskedKey: maskApiKey(cfg.apiKey)
    });
  }

  // 2. POST /api/config (Save configuration securely on backend)
  if (req.method === 'POST' && pathname === '/api/config') {
    try {
      const data = await parseJSONBody(req);
      const current = loadConfig();

      // Only update apiKey if provided (allows updating model without retyping key)
      const newApiKey = (data.apiKey && data.apiKey.trim() && !data.apiKey.includes('••••'))
        ? data.apiKey.trim()
        : current.apiKey;

      const newConfig = {
        provider: data.provider || current.provider || 'gemini',
        apiKey: newApiKey,
        model: (data.model && data.model.trim()) ? data.model.trim() : (data.provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini'),
        baseUrl: data.baseUrl ? data.baseUrl.trim() : ''
      };

      saveConfig(newConfig);
      const confPayload = {
        configured: Boolean(newConfig.apiKey),
        provider: newConfig.provider,
        model: newConfig.model,
        baseUrl: newConfig.baseUrl,
        maskedKey: maskApiKey(newConfig.apiKey)
      };
      return sendJSON(res, 200, {
        success: true,
        message: 'Konfigurasi API berhasil disimpan secara aman di backend.',
        config: confPayload,
        configured: confPayload.configured,
        provider: confPayload.provider,
        model: confPayload.model,
        baseUrl: confPayload.baseUrl,
        maskedKey: confPayload.maskedKey
      });
    } catch (err) {
      return sendJSON(res, 400, { success: false, error: err.message });
    }
  }

  // 2b. GET /api/learned-knowledge (Fetch all learned knowledge items)
  if (req.method === 'GET' && pathname === '/api/learned-knowledge') {
    const items = loadLearnedKnowledge();
    return sendJSON(res, 200, {
      success: true,
      count: items.length,
      items: items
    });
  }

  // 2c. POST /api/learned-knowledge (Manually teach or add learned item)
  if (req.method === 'POST' && pathname === '/api/learned-knowledge') {
    try {
      const data = await parseJSONBody(req);
      if (!data.insight || !data.insight.trim()) {
        return sendJSON(res, 400, { success: false, error: 'Konten ilmu / insight tidak boleh kosong.' });
      }
      const newItem = addLearnedKnowledgeItem({
        topic: data.topic || 'Pengetahuan Pembelajaran',
        insight: data.insight.trim(),
        category: data.category || 'fakta',
        sourcePrompt: data.sourcePrompt || 'Input Pengguna'
      });
      const all = loadLearnedKnowledge();
      return sendJSON(res, 200, {
        success: true,
        message: 'Ilmu baru berhasil dicatat dan dipelajari oleh AI.',
        item: newItem,
        count: all.length
      });
    } catch (err) {
      return sendJSON(res, 400, { success: false, error: err.message });
    }
  }

  // 2d. DELETE /api/learned-knowledge (Delete single item or clear all)
  if (req.method === 'DELETE' && pathname === '/api/learned-knowledge') {
    try {
      const queryId = parsedUrl.query.id;
      const clearAll = parsedUrl.query.all === 'true';

      if (clearAll) {
        saveLearnedKnowledge([]);
        return sendJSON(res, 200, { success: true, message: 'Semua memori ilmu AI berhasil dikosongkan.', count: 0 });
      }

      if (!queryId) {
        return sendJSON(res, 400, { success: false, error: 'Parameter ID atau all=true diperlukan.' });
      }

      const items = loadLearnedKnowledge();
      const filtered = items.filter(k => k.id !== queryId);
      saveLearnedKnowledge(filtered);
      return sendJSON(res, 200, { success: true, message: 'Item ilmu berhasil dihapus.', count: filtered.length });
    } catch (err) {
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  // 3. POST /api/test-connection (Test configuration)
  if (req.method === 'POST' && pathname === '/api/test-connection') {
    try {
      let bodyData = {};
      try {
        bodyData = await parseJSONBody(req);
      } catch (e) {}

      const savedCfg = loadConfig();
      const apiKey = (bodyData.apiKey && bodyData.apiKey.trim()) || savedCfg.apiKey;
      const provider = bodyData.provider || savedCfg.provider || 'gemini';
      const model = bodyData.model || savedCfg.model || (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
      const baseUrl = bodyData.baseUrl !== undefined ? bodyData.baseUrl : savedCfg.baseUrl;

      if (!apiKey || !apiKey.trim()) {
        return sendJSON(res, 400, {
          success: false,
          error: 'API Key belum diisi. Masukkan API Key terlebih dahulu untuk menguji koneksi.'
        });
      }

      let testResult = '';
      if (provider === 'gemini') {
        testResult = await callGemini(
          apiKey,
          model,
          'Balas dengan singkat: "Koneksi berhasil."',
          'Tes koneksi.'
        );
      } else {
        testResult = await callOpenAICompatible(
          apiKey,
          baseUrl,
          model,
          'Balas dengan singkat: "Koneksi berhasil."',
          'Tes koneksi.'
        );
      }

      return sendJSON(res, 200, {
        success: true,
        message: `Koneksi ke ${provider.toUpperCase()} (${model}) berhasil!`,
        reply: testResult.trim()
      });
    } catch (err) {
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  // 4. POST /api/chat (RAG Document-grounded chat and summarization)
  if (req.method === 'POST' && pathname === '/api/chat') {
    try {
      const data = await parseJSONBody(req);
      const query = (data.query || '').trim();
      const context = (data.context || '').trim();
      const moduleName = data.moduleName || 'Dokumen Materi';
      const history = data.history || [];
      const mode = data.mode || 'chat'; // 'chat' or 'summarize'
      const references = Array.isArray(data.references) ? data.references : [];

      const cfg = loadConfig();
      if (!cfg.apiKey || !cfg.apiKey.trim()) {
        return sendJSON(res, 400, {
          success: false,
          error: 'API Key belum dikonfigurasi di backend. Silakan buka "Pengaturan API" untuk memasukkan API Key Anda.'
        });
      }

      // Retrieve relevant learned knowledge to inject into prompt
      const allKnowledge = loadLearnedKnowledge();
      let relevantKnowledge = [];
      if (allKnowledge.length > 0) {
        const qWords = query.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
        relevantKnowledge = allKnowledge.filter(k => {
          const kText = (k.topic + ' ' + k.insight).toLowerCase();
          return qWords.some(w => kText.includes(w)) || k.category === 'preferensi';
        });
        if (relevantKnowledge.length < 6) {
          const remaining = allKnowledge.filter(k => !relevantKnowledge.includes(k)).slice(0, 6 - relevantKnowledge.length);
          relevantKnowledge = relevantKnowledge.concat(remaining);
        }
      }

      let knowledgeContextSection = '';
      if (relevantKnowledge.length > 0) {
        const listStr = relevantKnowledge
          .map(k => `- [${(k.category || 'FAKTA').toUpperCase()}] (${k.topic}): ${k.insight}`)
          .join('\n');
        knowledgeContextSection = `\n\n[MEMORI ILMU & PREFERENSI YANG TELAH DIPELAJARI DARI PENGGUNA]:\n${listStr}\n(PENTING: Terapkan ilmu, preferensi, dan koreksi di atas ke dalam jawabanmu secara cerdas, tepat, dan relevan.)`;
      }

      // Format source citation label
      const primaryRef = references.length > 0 
        ? `${references[0].moduleName || moduleName} - ${references[0].pageRef || 'Bab Materi'}`
        : `${moduleName}`;

      // Construct Strict Anti-Hallucination System Prompt
      let systemPrompt = '';
      let userPrompt = '';

      if (mode === 'summarize') {
        systemPrompt = `Kamu adalah AI Asisten Belajar cerdas dan objektif.
Tugasmu adalah merangkum dokumen pembelajaran berjudul "${moduleName}" secara komprehensif, terstruktur, dan akurat.${knowledgeContextSection}

KETENTUAN RANGKUMAN:
1. Rangkum HANYA informasi yang terdapat dalam materi yang diberikan.
2. JANGAN menambahkan spekulasi atau fakta dari luar materi.
3. Susun rangkuman dengan poin-poin terstruktur:
   - Pendahuluan / Inti Bahasan
   - Konsep-konsep Kunci & Definisi
   - Mekanisme / Proses Utama
   - Kesimpulan Ringkas
4. Di akhir rangkuman, sertakan: "Sumber: ${moduleName}"`;

        userPrompt = `Berikut adalah materi pembelajaran dari dokumen "${moduleName}":\n\n${context}\n\nTolong buatkan rangkuman materi di atas secara mendalam dan terstruktur.`;

      } else {
        const asksForSource = /\b(sumber|referensi|dari modul apa|halaman berapa|bab berapa|dari mana|ada di halaman|rujukan)\b/i.test(query);

        systemPrompt = `Kamu adalah AI Asisten Belajar cerdas yang menjawab seperti ChatGPT pada umumnya: natural, sangat jelas, padat, dan langsung pada intinya.
Dokumen referensi pendukung (hanya jika relevan): "${moduleName}".${knowledgeContextSection}

ATURAN UTAMA:
1. PAHAMI MAKSUD & TOLERANSI TYPO/BAHASA INFORMAL: Pahami maksud sebenarnya dari pesan pengguna meskipun terdapat salah eja (typo), singkatan kata (seperti "ap", "gmn", "knp", "sistm", "trdiri", "dr", "dlm", "utk", dll.), atau bahasa santai. Jangan pernah gagal menjawab hanya karena ejaan tidak baku.
2. JANGAN TERPAKU PADA MODUL / JANGAN COCOKKAN KATA PERSIS: Modul yang tersedia hanya berfungsi sebagai referensi pendukung ketika relevan. Jangan pernah membatasi diri hanya pada kata-kata di modul, dan JANGAN PERNAH menolak menjawab atau membalas error hanya karena kalimat pertanyaan tidak tertulis persis di modul. Gunakan pengetahuan luasmu untuk memberikan jawaban yang lengkap, akurat, dan edukatif.
3. JAWAB DENGAN LEBIH JELAS & PADAT:
   - Mulailah LANGSUNG dengan jawaban yang menjawab pertanyaan. Hindari pengantar yang tidak diperlukan (seperti "Tentu saja...", "Berdasarkan materi...", dll.), pengulangan pertanyaan, penjelasan bertele-tele, dan kesimpulan klise ("Semoga membantu!").
   - Susun jawaban dalam kalimat efektif, poin-poin terstruktur, dan cetak tebal (bold) konsep atau kata kunci utama agar sangat jelas dan padat dipahami.
4. JANGAN MENAMPILKAN DAFTAR ISI ATAU METADATA MENTAH: Jangan pernah menyalin mentah-mentah teks daftar isi, kata pengantar, glosarium, atau struktur halaman ke dalam jawaban. Susunlah jawaban dalam kalimat dan poin-poin penjelasan yang benar-benar menerangkan konsep yang ditanyakan.
5. JANGAN GUNAKAN TEMPLATE JAWABAN GENERIK: Dilarang menggunakan kalimat template hampa yang tidak menjawab esensi materi.
6. JANGAN MENAMPILKAN BAB, MODUL, ATAU SUMBER SECARA OTOMATIS: Jangan mencantumkan nama bab, nomor modul, atau sumber referensi kecuali pengguna memintanya. Gunakan referensi secara internal untuk membantu akurasi jawaban.
7. SESUAIKAN FORMAT JAWABAN:
   - Pertanyaan sederhana: jawab dalam 1-3 kalimat yang padat dan jelas.
   - Pertanyaan struktur/komponen/proses: berikan uraian poin-poin yang runtut, tegas, dan rapi.
   - Permintaan rangkuman: rangkum materi secara sistematis.
   - Permintaan kode: berikan kode yang siap dijalankan beserta penjelasan singkat.
8. IKUTI INSTRUKSI & PREFERENSI PENGGUNA: Terapkan nama panggilan dan preferensi yang telah dipelajari sebelumnya (contoh: "Panggil saya Joe" -> "Siap, Joe!").
9. INTEGRASIKAN ILMU YANG TELAH DIPELAJARI: Jika pertanyaan berkaitan dengan ilmu, fakta baru, atau preferensi yang ada di [MEMORI ILMU & PREFERENSI], manfaatkan untuk memperkaya dan menajamkan jawabanmu.
10. PEMEROLEHAN ILMU BARU DARI PROMPT (CONTINUOUS LEARNING):
    Amati apakah dalam pesan pengguna saat ini terdapat:
    a) Fakta/data/definisi/informasi baru
    b) Preferensi atau aturan instruksi khusus pengguna
    c) Koreksi terhadap pernyataan sebelumnya
    d) Konsep atau hubungan baru yang diutarakan pengguna
    Jika YA (ada ilmu/fakta/preferensi baru yang berharga untuk diingat di sesi berikutnya), sertakan di bagian PALING AKHIR jawabanmu format satu baris berikut:
    <!--LEARNED_KNOWLEDGE:{"topic":"Nama Topik Singkat","insight":"Intisari ilmu/fakta/preferensi baru yang dipelajari secara jelas dan padat","category":"fakta|preferensi|koreksi|konsep"}-->
    (Jika TIDAK ada ilmu/informasi/preferensi baru yang diberikan pengguna, JANGAN sertakan tag <!--LEARNED_KNOWLEDGE--> ini).`;

        userPrompt = `[KONTEKS MATERI DOKUMEN - ${moduleName}]:\n${context || '(Tidak ada bagian materi relevan yang ditemukan)'}\n\n[PERTANYAAN PENGGUNA]:\n${query}`;
      }

      // Call AI Model
      let aiResponse = '';
      if (cfg.provider === 'gemini') {
        aiResponse = await callGemini(cfg.apiKey, cfg.model, systemPrompt, userPrompt, history);
      } else {
        aiResponse = await callOpenAICompatible(cfg.apiKey, cfg.baseUrl, cfg.model, systemPrompt, userPrompt, history);
      }

            // Check if source tag is present in AI response and if user specifically asked for source
      let cleanAnswer = aiResponse.trim();
      let sourceTag = null;
      let learnedItem = null;

      // Extract LEARNED_KNOWLEDGE tag if present in model response
      const learnedMatch = cleanAnswer.match(/<!--LEARNED_KNOWLEDGE:\s*({[\s\S]*?})\s*-->/);
      if (learnedMatch) {
        try {
          const parsedData = JSON.parse(learnedMatch[1]);
          if (parsedData.insight) {
            learnedItem = addLearnedKnowledgeItem({
              topic: parsedData.topic || 'Pengetahuan Pembelajaran',
              insight: parsedData.insight,
              category: parsedData.category || 'fakta',
              sourcePrompt: query
            });
          }
        } catch (e) {
          console.warn('Gagal mem-parsing LEARNED_KNOWLEDGE tag:', e.message);
        }
        cleanAnswer = cleanAnswer.replace(/<!--LEARNED_KNOWLEDGE:[\s\S]*?-->/g, '').trim();
      }

      // Fallback heuristic extraction if model didn't emit tag but prompt has explicit facts/rules/name
      if (!learnedItem) {
        const heuristic = extractHeuristicKnowledge(query);
        if (heuristic) {
          learnedItem = addLearnedKnowledgeItem({
            ...heuristic,
            sourcePrompt: query
          });
        }
      }

      const asksForSource = /\b(sumber|referensi|dari modul apa|halaman berapa|bab berapa|dari mana|ada di halaman|rujukan)\b/i.test(query);

      // Extract source if model produced one
      const sourceMatch = cleanAnswer.match(/Sumber:\s*([^\n\r]+)$/i);
      if (sourceMatch) {
        if (asksForSource) {
          sourceTag = sourceMatch[1].trim();
        }
        cleanAnswer = cleanAnswer.replace(/Sumber:\s*[^\n\r]+$/i, '').trim();
      } else if (asksForSource && references.length > 0) {
        sourceTag = primaryRef;
      }

      return sendJSON(res, 200, {
        success: true,
        answer: cleanAnswer,
        source: sourceTag,
        learned: learnedItem,
        model: `${cfg.provider.toUpperCase()} (${cfg.model})`,
        references: references
      });

    } catch (err) {
      console.error('Error during /api/chat execution:', err.message);
      return sendJSON(res, 500, {
        success: false,
        error: err.message
      });
    }
  }

  // --------------------------------------------------------------------------
  // Static File Serving (HTML, CSS, JS, Assets)
  // --------------------------------------------------------------------------
  if (req.method === 'GET') {
    let reqPath = pathname === '/' ? '/index.html' : pathname;
    reqPath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');

    // SECURITY: Strictly prevent client from accessing api_config.json, learned_knowledge.json, or .env
    const baseName = path.basename(reqPath).toLowerCase();
    if (baseName === 'api_config.json' || baseName === 'learned_knowledge.json' || baseName.startsWith('.env') || baseName.includes('config.json')) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('403 Forbidden: Konfigurasi backend tidak boleh diakses oleh klien.');
    }

    const filePath = path.join(__dirname, reqPath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    });
    return;
  }

  // Unhandled routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Route Not Found');
});

server.listen(PORT, () => {
  console.log(`Asisten Belajar Secure Server running at http://localhost:${PORT}`);
});
