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

// 이미지 식별용 경량 지문(Fingerprint) 생성
function getImageFingerprint(base64) {
  if (!base64) return null;
  // 문자열 전체를 저장하는 대신 길이와 앞/뒤 30자 조합으로 경량 식별자 생성
  return `${base64.length}_${base64.slice(0, 30)}_${base64.slice(-30)}`;
}

function getCurrentAnalyzePayload() {
  return {
    avoidList: getComparableAvoidList(avoidList),
    imageFingerprint: getImageFingerprint(selectedBase64),
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
  if (!payload || !snapshot) return false;
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
    if (hasSameSnapshot) {
      label.textContent = '이미 분석 완료된 항목입니다';
    } else if (!selectedBase64) {
      label.textContent = '이미지를 선택해주세요';
    } else if (avoidList.length === 0) {
      label.textContent = '기피물질을 최소 1개 이상 추가해주세요';
    } else {
      label.textContent = 'AI로 기피물질 검사하기';
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getIngredientSearchUrl(name) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} 섭취 시 유의사항`)}`;
}

function renderTags() {
  const container = document.getElementById('avoidTags');
  if (!container) return;
  
  container.innerHTML = avoidList.map((item, index) => `
    <span class="inline-flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-200 text-xs px-3 py-1.5 rounded-full font-medium">
      ${escapeHtml(item)}
      <button onclick="removeAvoidItem(${index})" class="hover:text-rose-800 font-bold ml-1">×</button>
    </span>
  `).join('');
  
  localStorage.setItem('avoidList', JSON.stringify(avoidList));
  syncAnalyzeButtonState();
}

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
}

function unlockAnalyzeButton(btn) {
  if (!btn) return;
  btn.dataset.analyzeState = 'ready';
  syncAnalyzeButtonState();
}

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 업로드할 수 있습니다.");
    event.target.value = "";
    return;
  }

  selectedMimeType = file.type;
  const reader = new FileReader();
  reader.onload = function (e) {
    const fullBase64 = e.target.result;
    selectedBase64 = fullBase64.split(',')[1];

    document.getElementById('imagePreview').src = fullBase64;
    document.getElementById('previewContainer').classList.remove('hidden');
    document.getElementById('resultSection').classList.add('hidden');
    
    // 이미지 변경 시 스냅샷 상태 갱신
    syncAnalyzeButtonState();
  };
  reader.readAsDataURL(file);
}

async function analyzeImage() {
  if (!selectedBase64) return;
  if (avoidList.length === 0) {
    alert('최소 하나 이상의 기피물질을 등록해주세요.');
    return;
  }

  const payload = getCurrentAnalyzePayload();
  const snapshot = loadAnalyzeSubmitSnapshot();
  
  if (snapshot && isAnalyzePayloadSameAsSnapshot(payload, snapshot)) {
    alert('이미 동일한 조건으로 분석된 이미지입니다.');
    syncAnalyzeButtonState();
    return;
  }

  const btn = document.getElementById('analyzeBtn');
  if (!btn) return;

  lockAnalyzeButton(btn);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: selectedBase64,
        mimeType: selectedMimeType,
        avoidList: avoidList,
        model: getSelectedModel()
      })
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    if (!response.ok) throw new Error('오류가 발생했습니다. 다른 모델로 시도해보세요.');

    const abnormalAvoids = Array.isArray(data.abnormalAvoids)
      ? data.abnormalAvoids.map(item => String(item).trim()).filter(Boolean)
      : (Array.isArray(data.invalidAvoids)
        ? data.invalidAvoids.map(item => String(item).trim()).filter(Boolean)
        : []);

    if (abnormalAvoids.length > 0) {
      avoidList = avoidList.filter((item) => !abnormalAvoids.includes(String(item).trim()));
      renderTags();
    }

    // 성공한 요청의 스냅샷 저장
    saveAnalyzeSubmitSnapshot(getCurrentAnalyzePayload());
    displayResults(data);
  } catch (err) {
    alert('오류: ' + err.message);
  } finally {
    unlockAnalyzeButton(btn);
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
    // 1. HTML Escape 처리로 XSS 방지
    let safeText = escapeHtml(rawText);

    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 2. 경고 항목 하이라이트
    warningList.forEach(item => {
      if (item.ingredient) {
        const escapedIng = escapeHtml(item.ingredient);
        const regex = new RegExp(escapeRegExp(escapedIng), 'g');
        safeText = safeText.replace(regex, `<mark class="bg-rose-100 text-rose-700 font-semibold px-1 rounded">${escapedIng}</mark>`);
      }
    });

    // 3. 유의 항목 하이라이트
    cautionList.forEach(item => {
      if (item.ingredient) {
        const escapedIng = escapeHtml(item.ingredient);
        const regex = new RegExp(escapeRegExp(escapedIng), 'g');
        safeText = safeText.replace(regex, `<mark class="bg-amber-100 text-amber-800 font-semibold px-1 rounded">${escapedIng}</mark>`);
      }
    });

    extractedText.innerHTML = safeText;
  } else {
    extractedText.textContent = rawText;
  }

  if (warningList.length > 0 || cautionList.length > 0) {
    alertBox.className = "space-y-3";
    let htmlContent = '';

    if (warningList.length > 0) {
      htmlContent += `
        <div class="p-4 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 space-y-2">
          <div class="font-bold flex items-center gap-2">
            <span>⚠️ WARNING: 주의 기피물질 ${warningList.length}건이 발견되었습니다!</span>
          </div>
          <ul class="list-disc list-inside text-sm space-y-1">
            ${warningList.map(item => {
              const ingredient = escapeHtml(item.ingredient || '');
              const matchedAvoid = escapeHtml(item.matchedAvoid || '');
              const reason = item.reason ? ` - 사유: ${escapeHtml(item.reason)}` : '';
              const searchUrl = getIngredientSearchUrl(item.ingredient || '');

              return `
                <li>
                  <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="underline font-semibold">
                    ${ingredient}
                  </a>
                  (연관 성분: ${matchedAvoid}${reason})
                </li>
              `;
            }).join('')}
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
            ${cautionList.map(item => {
              const ingredient = escapeHtml(item.ingredient || '');
              const matchedAvoid = escapeHtml(item.matchedAvoid || '');
              const reason = item.reason ? ` - 사유: ${escapeHtml(item.reason)}` : '';
              const searchUrl = getIngredientSearchUrl(item.ingredient || '');

              return `
                <li>
                  <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="underline font-semibold">
                    ${ingredient}
                  </a>
                  (연관 성분: ${matchedAvoid}${reason})
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      `;
    }

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

// 초기화
attachModelSelector('modelSelect');
renderTags();

// ==========================================
// 기피 물질 목록 JSON 다운로드 및 업로드
// ==========================================

// 1. 기피 물질 JSON 다운로드
function downloadAvoidListJson() {
  if (!avoidList || avoidList.length === 0) {
    alert('다운로드할 기피물질이 없습니다.');
    return;
  }

  // JSON 데이터 생성 (가독성을 위한 들여쓰기 적용)
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(avoidList, null, 2));
  
  // 가상의 앵커(a) 태그 생성 후 클릭 이벤트 트리거
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `avoid_list_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// 2. 기피 물질 JSON 업로드
function uploadAvoidListJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  // JSON 파일 여부 검증
  if (file.type !== "application/json" && !file.name.endsWith('.json')) {
    alert("JSON 파일만 업로드할 수 있습니다.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsedData = JSON.parse(e.target.result);

      // 배열 형식 검증
      if (!Array.isArray(parsedData)) {
        throw new Error('올바른 기피물질 목록 형식(배열)이 아닙니다.');
      }

      // 문자열 데이터만 추출 및 정제 (30자 이하 조건 적용)
      const validItems = parsedData
        .map(item => String(item || '').trim())
        .filter(item => item.length > 0 && item.length <= 30);

      if (validItems.length === 0) {
        alert('유효한 기피물질 데이터가 없습니다.');
        return;
      }

      // 기존 목록과 중복 제거 후 합치기 (덮어쓰기를 원하시면 avoidList = [...new Set(validItems)] 로 변경)
      avoidList = [...new Set([...avoidList, ...validItems])];

      // UI 및 상태 갱신
      renderTags();
      alert(`총 ${validItems.length}개의 기피물질을 불러왔습니다.`);
    } catch (err) {
      alert('JSON 파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    } finally {
      event.target.value = ""; // 동일 파일 다시 업로드 가능하도록 초기화
    }
  };

  reader.readAsText(file);
}