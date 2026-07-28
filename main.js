let avoidList = JSON.parse(localStorage.getItem('avoidList') || '["우유", "대두", "밀"]');
let selectedBase64 = null;
let selectedMimeType = null;

// 페이지 로드 시 태그 렌더링
renderTags();

function renderTags() {
  const container = document.getElementById('avoidTags');
  container.innerHTML = avoidList.map((item, index) => `
    <span class="inline-flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-200 text-xs px-3 py-1.5 rounded-full font-medium">
      ${item}
      <button onclick="removeAvoidItem(${index})" class="hover:text-rose-800 font-bold ml-1">×</button>
    </span>
  `).join('');
  localStorage.setItem('avoidList', JSON.stringify(avoidList));
}

function addAvoidItem() {
  const input = document.getElementById('avoidInput');
  const val = input.value.trim();
  if (val && !avoidList.includes(val)) {
    avoidList.push(val);
    input.value = '';
    renderTags();
  }
}

function removeAvoidItem(index) {
  avoidList.splice(index, 1);
  renderTags();
}

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  selectedMimeType = file.type;
  const reader = new FileReader();
  reader.onload = function(e) {
    const fullBase64 = e.target.result;
    selectedBase64 = fullBase64.split(',')[1]; // Pure Base64만 추출
    
    document.getElementById('imagePreview').src = fullBase64;
    document.getElementById('previewContainer').classList.remove('hidden');
    document.getElementById('resultSection').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

async function analyzeImage() {
  console.log('1. 분석 버튼 클릭됨');
  console.log('현재 base64 데이터 상태:', selectedBase64 ? '존재함' : '없음(null)');

  if (!selectedBase64) return;
  if (avoidList.length === 0) {
    alert('최소 하나 이상의 기피물질을 등록해주세요.');
    return;
  }

  console.log('2. fetch 요청 직전');

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.innerHTML = `
    <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span>분석 중...</span>
  `;

  try {
    //15초 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal, // 타임아웃 신호 연결
      body: JSON.stringify({
        imageBase64: selectedBase64,
        mimeType: selectedMimeType,
        avoidList: avoidList
      })
    });

    console.log("4. fetch 응답 도착:", response);

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '분석에 실패했습니다.');

    displayResults(data);
  } catch (err) {
    alert('오류: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>AI로 기피물질 검사하기</span>`;
  }
}

function displayResults(data) {
  const resultSection = document.getElementById('resultSection');
  const alertBox = document.getElementById('alertBox');
  const extractedText = document.getElementById('extractedText');

  resultSection.classList.remove('hidden');
  extractedText.innerText = data.extractedText || '텍스트를 추출하지 못했습니다.';

  if (data.detectedAvoids && data.detectedAvoids.length > 0) {
    alertBox.className = "p-4 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 space-y-2";
    alertBox.innerHTML = `
      <div class="font-bold flex items-center gap-2">
        <span>⚠️ WARNING: 기피물질 ${data.detectedAvoids.length}건이 발견되었습니다!</span>
      </div>
      <ul class="list-disc list-inside text-sm space-y-1">
        ${data.detectedAvoids.map(item => `
          <li><strong>${item.ingredient}</strong> (사유: ${item.matchedAvoid} 매칭 ${item.reason ? `- ${item.reason}` : ''})</li>
        `).join('')}
      </ul>
    `;
  } else {
    alertBox.className = "p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800";
    alertBox.innerHTML = `
      <div class="font-bold flex items-center gap-2">
        <span>✅ SAFE: 등록하신 기피물질이 발견되지 않았습니다.</span>
      </div>
    `;
  }
}