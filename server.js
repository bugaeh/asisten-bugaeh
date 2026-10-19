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

      // Format source citation label
      const primaryRef = references.length > 0 
        ? `${references[0].moduleName || moduleName} - ${references[0].pageRef || 'Bab Materi'}`
        : `${moduleName}`;

      // Construct Strict Anti-Hallucination System Prompt
      let systemPrompt = '';
      let userPrompt = '';

      if (mode === 'summarize') {
        systemPrompt = `Kamu adalah AI Asisten Belajar cerdas dan objektif.
Tugasmu adalah merangkum dokumen pembelajaran berjudul "${moduleName}" secara komprehensif, terstruktur, dan akurat.

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

        systemPrompt = `Kamu adalah AI Asisten Belajar cerdas yang menjawab seperti ChatGPT pada umumnya: natural, akurat, dan langsung pada intinya.
Dokumen referensi pendukung (hanya jika relevan): "${moduleName}".

ATURAN UTAMA:
1. PAHAMI SEBELUM MENJAWAB: Pahami maksud sebenarnya dari setiap pesan pengguna. Jangan hanya mencocokkan kata-kata dengan modul, kategori, atau template jawaban. Jawablah sesuai apa yang benar-benar ditanyakan atau diminta.
2. JANGAN TERPAKU PADA MODUL: Modul yang tersedia hanya berfungsi sebagai referensi ketika relevan. Jangan menganggap semua pertanyaan harus berhubungan dengan modul aktif. Jika pertanyaan tidak berkaitan dengan modul, jawablah seperti ChatGPT pada umumnya.
3. JAWAB LANGSUNG KE INTI: Mulailah dengan jawaban yang menjawab pertanyaan. Hindari pengantar yang tidak diperlukan (seperti "Berdasarkan modul...", "Materi ini membahas..."), pengulangan pertanyaan, penjelasan bertele-tele, dan kesimpulan yang tidak menambah informasi ("Semoga membantu").
4. JANGAN GUNAKAN TEMPLATE JAWABAN GENERIK: Dilarang menggunakan kalimat umum yang tidak relevan seperti: "Konsep ini mengkaji prinsip dasar dan hubungan operasional antar komponen.", "Jawaban untuk pertanyaan Anda adalah...", "Berdasarkan pengetahuan umum...". Jangan pernah menggunakan jawaban yang sama untuk pertanyaan berbeda hanya karena formatnya serupa.
5. JANGAN MENAMPILKAN BAB, MODUL, ATAU SUMBER SECARA OTOMATIS: Jangan mencantumkan nama bab, nomor modul, kategori pertanyaan, atau sumber referensi kecuali pengguna memintanya. Gunakan referensi secara internal untuk membantu menjawab, bukan untuk memenuhi jawaban dengan metadata.
6. SESUAIKAN PANJANG JAWABAN:
   - Pertanyaan sederhana: jawab dalam satu kalimat jika cukup (1-3 kalimat).
   - Pertanyaan umum: jawab dalam satu paragraf singkat.
   - Pertanyaan kompleks: berikan penjelasan terstruktur sesuai kebutuhan.
   - Permintaan rangkuman: rangkum materi yang benar-benar tersedia.
   - Permintaan kode: berikan kode yang sesuai dan dapat digunakan.
7. IKUTI INSTRUKSI PENGGUNA: Jika pengguna meminta dipanggil dengan nama tertentu, gunakan nama tersebut dalam percakapan (contoh: "Panggil saya Joe" -> "Siap, Joe!"). Jika pengguna meminta contoh, berikan contoh.
8. GUNAKAN KONTEKS DENGAN BENAR: Pahami hubungan antara pesan terbaru dan percakapan sebelumnya. Jangan salah mengartikan perintah sederhana sebagai pertanyaan akademis. Jangan mengarang konteks yang tidak diberikan pengguna.
9. UTAMAKAN AKURASI: Jangan mengarang fakta, sumber, hasil pencarian, atau informasi yang tidak diketahui. Jika tidak memiliki informasi yang cukup, sampaikan keterbatasannya secara singkat dan jujur.
10. FORMAT JAWABAN: Tampilkan HANYA jawaban yang benar-benar dibutuhkan pengguna. Jangan tampilkan proses internal, kategori pertanyaan, atau template sistem.`;

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

    // SECURITY: Strictly prevent client from accessing api_config.json or .env
    const baseName = path.basename(reqPath).toLowerCase();
    if (baseName === 'api_config.json' || baseName.startsWith('.env') || baseName.includes('config.json')) {
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
