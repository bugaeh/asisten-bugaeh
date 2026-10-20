const fs = require('fs');
const pdfjs = require('../lib/pdf.min.js');

async function test() {
  const data = new Uint8Array(fs.readFileSync('Koleksi_Modul_P13/Koleksi_Modul_P13/X_Ekonomi_KD-3.1_Final.pdf'));
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push({ pageNum: i, text: tc.items.map(it => it.str).join(' ') });
  }

  // Define new Intelligent Cleaner and Content Extractor
  function cleanDocumentNoise(text) {
    if (!text) return '';
    let cleaned = text;
    // Strip running header / footer stamps
    cleaned = cleaned.replace(/Modul\s+[^\n\r]+?KD\s+[\d.]+[^\n\r]+?@\d{4}[^\n\r]+?DIKMEN\s+[a-z0-9ivxlc]+/gi, ' ');
    cleaned = cleaned.replace(/@\d{4}[,\s]+Direktorat\s+SMA[^\n\r]+?DIKMEN\s+[a-z0-9ivxlc]+/gi, ' ');
    cleaned = cleaned.replace(/Direktorat\s+Jenderal\s+PAUD[,\s]+DIKDAS\s+dan\s+DIKMEN/gi, ' ');
    cleaned = cleaned.replace(/Kementerian\s+Pendidikan\s+dan\s+Kebudayaan[^\n\r]*/gi, ' ');
    cleaned = cleaned.replace(/Hak\s+Cipta\s+pada\s+Kementerian[^\n\r]*/gi, ' ');
    cleaned = cleaned.replace(/BIOLOGI\s+KELAS\s+\d+\s+•\s+MOD-[^\n\r]+/gi, ' ');
    cleaned = cleaned.replace(/Dokumen\s+Akademik\s+Resmi[^\n\r]+/gi, ' ');
    // Fix PDF hyphenated spaces: "usaha - usaha" -> "usaha-usaha"
    cleaned = cleaned.replace(/(\w+)\s*-\s*(\w+)/g, '$1-$2');
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  function isFrontMatterOrTOC(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    // Front matter / cover keywords
    if (/daftar\s+isi|daftar\s+tabel|daftar\s+gambar|kata\s+pengantar|halaman\s+judul|lembar\s+identitas|daftar\s+pustaka|glosarium|bank\s+soal/i.test(lower)) {
      return true;
    }
    // Cover metadata: PENYUSUN, Penulis, NIP, Identitas Modul, Peta Konsep
    if (/p\s*enyusun\s*:\s*[a-z]|penulis\s*:\s*[a-z]|nama\s+sekolah|identitas\s+modul|peta\s+konsep/i.test(lower)) {
      return true;
    }
    // Cover credit page (e.g. Page 2 with PENYUSUN and SMA Negeri)
    if (/penyusun|p\s*enyusun/i.test(lower) && /sma\s+negeri|universitas|direktorat/i.test(lower)) {
      return true;
    }
    // Roman numeral pages
    if (/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/i.test(lower.slice(0, 80)) && (lower.includes('konsep') || lower.includes('modul')) && !lower.includes('adalah')) {
      return true;
    }
    return false;
  }

  function smartSearchPassages(query, modulePages) {
    const rawTokens = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['yang', 'pada', 'dalam', 'untuk', 'dengan', 'adalah', 'atau', 'dari', 'apa', 'itu', 'apakah'].includes(w));

    const isDefinitionQuery = /(apa\s+itu|pengertian|definisi|makna|apa\s+yang\s+dimaksud|arti)/i.test(query);

    const scored = [];

    for (const page of modulePages) {
      const cleanText = cleanDocumentNoise(page.text);
      if (cleanText.length < 50) continue;
      if (isFrontMatterOrTOC(cleanText)) continue;

      let score = 0;
      const pLower = cleanText.toLowerCase();

      for (const token of rawTokens) {
        if (pLower.includes(token)) {
          // Count frequency
          const matches = pLower.match(new RegExp(`\\b${token}\\b`, 'gi')) || [];
          score += 4 + (matches.length * 2);
        }
      }

      // Exact query sequence match bonus
      const qClean = rawTokens.join(' ');
      if (pLower.includes(qClean)) {
        score += 20;
      }

      // Definitional bonus if user asks "apa itu X"
      if (isDefinitionQuery) {
        if (/(adalah|merupakan|yaitu|yakni|diartikan|didefinisikan|mempelajari|berasal dari)/i.test(pLower)) {
          score += 15;
        }
        if (pLower.includes('pengertian ' + qClean) || pLower.includes(qClean + ' adalah') || pLower.includes(qClean + ' merupakan')) {
          score += 30;
        }
      }

      if (score >= 10) {
        scored.push({
          pageNum: page.pageNum,
          text: cleanText,
          score: score
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  function synthesizeAnswer(query, topPassage) {
    const text = topPassage.text;
    const isDefinition = /(apa\s+itu|pengertian|definisi|makna|apa\s+yang\s+dimaksud)/i.test(query);

    // Split into sentences
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 20);

    if (isDefinition) {
      // Find sentences that contain the subject AND definitional verb (adalah / merupakan / mempelajari / berasal dari)
      const defSentences = sentences.filter(s => 
        /(adalah|merupakan|yaitu|yakni|mempelajari|diartikan|didefinisikan|berasal dari)/i.test(s) &&
        /(ekonomi|ilmu ekonomi)/i.test(s)
      );

      if (defSentences.length > 0) {
        return defSentences.slice(0, 3).join('\n\n');
      }
    }

    return sentences.slice(0, 3).join(' ');
  }

  console.log('Testing Smart Search on Ekonomi PDF:');
  const results = smartSearchPassages('apa itu ilmu ekonomi', pages);
  console.log(`Found ${results.length} relevant passages.`);
  for (let i = 0; i < Math.min(3, results.length); i++) {
    console.log(`\n[Rank ${i + 1}] Page ${results[i].pageNum} (Score ${results[i].score}):\n${results[i].text.slice(0, 200)}...`);
  }

  if (results.length > 0) {
    console.log('\n=== SYNTHESIZED ANSWER ===');
    const ans = synthesizeAnswer('apa itu ilmu ekonomi', results[0]);
    console.log(ans);
  }
}

test().catch(console.error);
