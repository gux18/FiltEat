let avoidList = JSON.parse(localStorage.getItem('avoidList') || '["우유", "대두", "밀"]');
let selectedBase64 = null;
let selectedMimeType = null;
let analyzeButtonLockTimer = null;
let analyzeButtonOriginalHtml = '';
const ANALYZE_SUBMIT_SNAPSHOT_KEY = 'food-avoidance-main-submit-snapshot';
const MODEL_STORAGE_KEY = 'food-avoidance-selected-model';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

function getSelectedModel() {
  const select = document.getElementById('modelSelect');
  const value = select ? String(select.value || '').trim() : '';
  return value || DEFAULT_MODEL;
}

function persistSelectedModel(modelName) {
  const normalized = String(modelName || '').trim();
  if (!normalized) return;
  localStorage.setItem(MODEL_STORAGE_KEY, normalized);
}

function attachModelSelector(selectorId) {
  const select = document.getElementById(selectorId);
  if (!select) return;

  const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
  if (savedModel) {
    select.value = savedModel;
  }

  select.addEventListener('change', () => {
    persistSelectedModel(select.value);
    syncAnalyzeButtonState();
  });
}

function getComparableAvoidList(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean))].sort();
}

function getCurrentAnalyzePayload() {
  return {
    avoidList: getComparableAvoidList(avoidList),
    selectedBase64: selectedBase64 || null,
    selectedMimeType: selectedMimeType || null,
    model: getSelectedModel()
  };
}

function loadAnalyzeSubmitSnapshot() {
  try {
    const saved = sessionStorage.getItem(ANALYZE_SUBMIT_SNAPSHOT_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn('분석 스냅샷을 불러오지 못했습니다.', error);
    return null;
  }
}

function saveAnalyzeSubmitSnapshot(payload) {
  try {
    sessionStorage.setItem(ANALYZE_SUBMIT_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('분석 스냅샷을 저장하지 못했습니다.', error);
  }
}

function isAnalyzePayloadSameAsSnapshot(payload, snapshot) {
  return JSON.stringify(payload) === JSON.stringify(snapshot);
}

function syncAnalyzeButtonState() {
  const btn = document.getElementById('analyzeBtn');
  if (!btn) return;

  if (btn.dataset.analyzeState === 'loading') {
    return;
  }

  if (!analyzeButtonOriginalHtml) {
    analyzeButtonOriginalHtml = btn.innerHTML;
  }

  const payload = getCurrentAnalyzePayload();
  const snapshot = loadAnalyzeSubmitSnapshot();
  const hasSameSnapshot = !!snapshot && isAnalyzePayloadSameAsSnapshot(payload, snapshot);
  const canSubmit = Boolean(selectedBase64) && avoidList.length > 0;

  btn.disabled = hasSameSnapshot || !canSubmit;
  btn.innerHTML = analyzeButtonOriginalHtml;

  const label = btn.querySelector('span');
  if (label) {
    label.textContent = hasSameSnapshot ? '저장된 내용과 같아 분석할 수 없습니다' : 'AI로 기피물질 검사하기';
  }
}

// 페이지 로드 시 태그 렌더링
attachModelSelector('modelSelect');
renderTags();

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

function renderTags() {
  const container = document.getElementById('avoidTags');
  
  if (!container) {
    return;
  }
  
  container.innerHTML = avoidList.map((item, index) => `
    <span class="inline-flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-200 text-xs px-3 py-1.5 rounded-full font-medium">
      ${escapeHtml(item)}
      <button onclick="removeAvoidItem(${index})" class="hover:text-rose-800 font-bold ml-1">×</button>
    </span>
  `).join('');
  localStorage.setItem('avoidList', JSON.stringify(avoidList));
  syncAnalyzeButtonState();
}
// 기피 재료 검사
async function addAvoidItem() {
  const input = document.getElementById('avoidInput');
  const val = input.value.trim();

  if (!val) return;

  if (avoidList.includes(val)) {
    alert("이미 추가된 항목입니다.");
    return;
  }
  
  const isValid = await validateIngredient(val);
  if (!isValid) {
    alert("30자 이내의 음식, 성분만 입력할 수 있습니다.");
    return;
  }

  avoidList.push(val);
  input.value = "";
  renderTags();
}

async function validateIngredient(text) {
  const t = (text || '').trim();
  if (!t || t.length > 30) return false;


  return true;
}

//

function removeAvoidItem(index) {
  avoidList.splice(index, 1);
  renderTags();
}

function lockAnalyzeButton(btn) {
  if (!btn) return;

  if (!analyzeButtonOriginalHtml) {
    analyzeButtonOriginalHtml = btn.innerHTML;
  }

  btn.dataset.analyzeState = 'loading';
  btn.disabled = true;
  btn.innerHTML = `
    <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span>분석 중...</span>
  `;

  if (analyzeButtonLockTimer) {
    clearTimeout(analyzeButtonLockTimer);
  }

  analyzeButtonLockTimer = setTimeout(() => {
    btn.dataset.analyzeState = 'ready';
    btn.disabled = false;
    btn.innerHTML = analyzeButtonOriginalHtml;
    analyzeButtonLockTimer = null;
    syncAnalyzeButtonState();
  }, 5000);
}

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  // 이미지 파일만 업로드 하도록
  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 업로드할 수 있습니다.");
    event.target.value = "";
    return;
  }
  //
  selectedMimeType = file.type;
  const reader = new FileReader();
  reader.onload = function (e) {
    const fullBase64 = e.target.result;
    selectedBase64 = fullBase64.split(',')[1]; // Pure Base64만 추출

    document.getElementById('imagePreview').src = fullBase64;
    document.getElementById('previewContainer').classList.remove('hidden');
    document.getElementById('resultSection').classList.add('hidden');
    syncAnalyzeButtonState();
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

  const payload = getCurrentAnalyzePayload();
  const snapshot = loadAnalyzeSubmitSnapshot();
  if (snapshot && isAnalyzePayloadSameAsSnapshot(payload, snapshot)) {
    syncAnalyzeButtonState();
    return;
  }

  console.log('2. fetch 요청 직전');

  const btn = document.getElementById('analyzeBtn');
  if (!btn) return;

  lockAnalyzeButton(btn);

  try {
    console.log('3. fetch 요청 시작');
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
        avoidList: avoidList,
        model: getSelectedModel()
      })
    });

    console.log("4. fetch 응답 도착:", response);

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '분석에 실패했습니다.');

    const abnormalAvoids = Array.isArray(data.abnormalAvoids)
      ? data.abnormalAvoids.map(item => String(item).trim()).filter(Boolean)
      : (Array.isArray(data.invalidAvoids)
        ? data.invalidAvoids.map(item => String(item).trim()).filter(Boolean)
        : []);

    if (abnormalAvoids.length > 0) {
      avoidList = avoidList.filter((item) => !abnormalAvoids.includes(String(item).trim()));
      renderTags();
    }

    saveAnalyzeSubmitSnapshot(getCurrentAnalyzePayload());
    syncAnalyzeButtonState();
    displayResults(data);
  } catch (err) {
    alert('오류: ' + err.message);
  }
}

function displayResults(data) {
  const resultSection = document.getElementById('resultSection');
  const alertBox = document.getElementById('alertBox');
  const extractedText = document.getElementById('extractedText');

  resultSection.classList.remove('hidden');

  const warningList = data.warningList || (data.detectedAvoids ? data.detectedAvoids.filter(item => !item.reason || !item.reason.includes('유의')) : []);
  const cautionList = data.cautionList || (data.detectedAvoids ? data.detectedAvoids.filter(item => item.reason && item.reason.includes('유의')) : []);

  let rawText = data.extractedText || '텍스트를 추출하지 못했습니다.';

  if (data.extractedText) {
    // 특수문자 정규식 이스케이프 함수
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 경고(Warning) 항목 -> 빨간색 하이라이트
    warningList.forEach(item => {
      if (item.ingredient) {
        const regex = new RegExp(escapeRegExp(item.ingredient), 'g');
        rawText = rawText.replace(regex, `<mark class="bg-rose-100 text-rose-700 font-semibold px-1 rounded">${item.ingredient}</mark>`);
      }
    });

    // 유의(Caution) 항목 -> 노란/주황색 하이라이트
    cautionList.forEach(item => {
      if (item.ingredient) {
        const regex = new RegExp(escapeRegExp(item.ingredient), 'g');
        rawText = rawText.replace(regex, `<mark class="bg-amber-100 text-amber-800 font-semibold px-1 rounded">${item.ingredient}</mark>`);
      }
    });

    extractedText.innerHTML = rawText;
  } else {
    extractedText.innerText = rawText;
  }

  /* 검출된 항목(주의/유의)이 있을 때와 없을 때를 구별 */
  if (warningList.length > 0 || cautionList.length > 0) {
    /* alertBox 기본 테두리/여백 스타일 정리 및 htmlContent 변수 선언  */
    alertBox.className = "space-y-3";
    let htmlContent = '';

    /*주의(Warning) 항목 출력 부분 */
    if (warningList.length > 0) {
      htmlContent += `
        <div class="p-4 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 space-y-2">
          <div class="font-bold flex items-center gap-2">
            <span>⚠️ WARNING: 주의 기피물질 ${warningList.length}건이 발견되었습니다!</span>
          </div>
          <ul class="list-disc list-inside text-sm space-y-1">
            ${/*data.detectedAvoids 전체가 아닌 warningList만 순회*/
        warningList.map(item => `
              <li><strong>${item.ingredient}</strong> (연관 성분: ${item.matchedAvoid}${item.reason ? ` - 사유: ${item.reason}` : ''})</li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    if (cautionList.length > 0) {
      htmlContent += `
        <div class="p-4 rounded-xl border bg-amber-50 border-amber-200 text-amber-800 space-y-2">
          <div class="font-bold flex items-center gap-2">
            <span>⚡ CAUTION: 유의 항목 ${cautionList.length}건이 발견되었습니다.</span>
          </div>
          <ul class="list-disc list-inside text-sm space-y-1">
            ${cautionList.map(item => `
              <li><strong>${item.ingredient}</strong> (연관 성분: ${item.matchedAvoid}${item.reason ? ` - 사유: ${item.reason}` : ''})</li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    /*완성된 HTML을 alertBox 내부 요소에 할당 */
    alertBox.innerHTML = htmlContent;

  } else {

    alertBox.className = "p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800";
    alertBox.innerHTML = `
      <div class="font-bold flex items-center gap-2">
        <span>✅ SAFE: 등록하신 기피물질이 발견되지 않았습니다.</span>
      </div>
    `;
  }
}
