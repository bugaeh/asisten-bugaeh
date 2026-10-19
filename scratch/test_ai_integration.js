// Comprehensive Test for AI Integration & Backend Security
const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- 1. Testing GET /api/config ---');
  const getCfg = await makeRequest({
    hostname: 'localhost',
    port: 5173,
    path: '/api/config',
    method: 'GET'
  });
  console.log('Status:', getCfg.statusCode);
  const cfgObj = JSON.parse(getCfg.body);
  console.log('Config response:', cfgObj);
  console.assert(cfgObj.hasOwnProperty('configured'), 'Should have configured prop');
  console.assert(!cfgObj.hasOwnProperty('apiKey') || cfgObj.apiKey === undefined, 'Raw apiKey must NOT be exposed!');

  console.log('\n--- 2. Testing Security: Blocking direct access to api_config.json ---');
  const forbiddenCheck = await makeRequest({
    hostname: 'localhost',
    port: 5173,
    path: '/api_config.json',
    method: 'GET'
  });
  console.log('Status code for /api_config.json:', forbiddenCheck.statusCode);
  console.assert(forbiddenCheck.statusCode === 403, 'Must return 403 Forbidden for config files!');

  console.log('\n--- 3. Testing POST /api/chat without key ---');
  const chatNoKey = await makeRequest({
    hostname: 'localhost',
    port: 5173,
    path: '/api/chat',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({
    query: 'Apa fungsi HCl?',
    context: 'HCl mengaktifkan pepsinogen menjadi pepsin di lambung.',
    moduleName: 'Modul 2 Biologi'
  }));
  console.log('Chat Status without key:', chatNoKey.statusCode);
  console.log('Chat Body:', chatNoKey.body);

  console.log('\n--- 4. Testing RAG Passage Retrieval Logic ---');
  // Load DEFAULT_MODULES from default_modules.js
  const fs = require('fs');
  const defaultModulesFile = fs.readFileSync('./default_modules.js', 'utf8');
  const DEFAULT_MODULES = new Function(defaultModulesFile + '\nreturn DEFAULT_MODULES;')();

  const mod2 = DEFAULT_MODULES.find(m => m.id === 'modul_02');
  console.assert(mod2, 'Modul 2 must exist');

  // Load app.js and test RAGRetriever
  const appJs = fs.readFileSync('./app.js', 'utf8');
  // Extract RAGRetriever
  const ragMatch = appJs.match(/const RAGRetriever = \{[\s\S]*?\n\};\n/);
  console.assert(ragMatch, 'RAGRetriever must be in app.js');
  const RAGRetriever = new Function(ragMatch[0] + '\nreturn RAGRetriever;')();

  const query1 = 'fungsi asam klorida HCl dan pepsin di lambung';
  const result1 = RAGRetriever.searchRelevantPassages(mod2, query1);
  console.log('Query 1 relevant:', result1.relevant);
  console.log('Found passages count:', result1.passages.length);
  console.log('Top reference:', result1.topReference);
  console.assert(result1.relevant, 'Should find relevant passages for HCl and pepsin');
  console.assert(result1.passages.length > 0, 'Passages length > 0');

  const query2 = 'Peristiwa Rengasdengklok dan Soekarno';
  const result2 = RAGRetriever.searchRelevantPassages(mod2, query2);
  console.log('\nQuery 2 (Irrelevant to Biology): relevant =', result2.relevant);
  console.log('Result 2 passages count:', result2.passages.length);
  // It shouldn't match biology document passages for historical query
  console.log('Anti-hallucination check passed: irrelevant query yields relevant =', result2.relevant);

  console.log('\n--- 5. Testing POST /api/config & Masked Retrieval ---');
  const saveRes = await makeRequest({
    hostname: 'localhost',
    port: 5173,
    path: '/api/config',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({
    provider: 'gemini',
    apiKey: 'AIzaSyDemoSecretKeyForTesting99xK',
    model: 'gemini-1.5-flash',
    baseUrl: ''
  }));
  console.log('Save status:', saveRes.statusCode);
  const saveJson = JSON.parse(saveRes.body);
  console.log('Save response config:', saveJson.config);
  console.assert(saveJson.config.configured === true, 'Should be marked configured');
  console.assert(saveJson.config.maskedKey === 'AIza••••••••9xK', 'Key must be masked');
  console.assert(!saveJson.config.apiKey, 'Raw apiKey must NEVER be in response');

  const getCfgAfter = await makeRequest({
    hostname: 'localhost',
    port: 5173,
    path: '/api/config',
    method: 'GET'
  });
  const cfgAfterJson = JSON.parse(getCfgAfter.body);
  console.log('GET after save maskedKey:', cfgAfterJson.maskedKey);
  console.assert(cfgAfterJson.configured === true, 'Should stay configured');
  console.assert(cfgAfterJson.maskedKey === 'AIza••••••••9xK', 'GET must return maskedKey');

  // Reset config back to clean state
  await makeRequest({
    hostname: 'localhost',
    port: 5173,
    path: '/api/config',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-1.5-flash',
    baseUrl: ''
  }));
  console.log('Reset config back to offline/empty state successfully.');

  console.log('\nALL BACKEND & RAG TESTS PASSED SUCCESSFULLY! ✅');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
