let healthList = JSON.parse(localStorage.getItem('healthList') || '[]');
let isGuideSubmitting = false;
let pendingCorrectedGuideList = [];
const GUIDE_SUBMIT_SNAPSHOT_KEY = 'food-avoidance-guide-submit-snapshot';
const MODEL_STORAGE_KEY = 'food-avoidance-selected-model';
const DEFAULT_MODEL = 'gemini-3-flash-preview';

function getSelectedModel() {
  const select = document.getElementById('guideModelSelect');
  const value = select ? String(select.value || '').trim() : '';
  return value || DEFAULT_MODEL;
}

function persistSelectedModel(modelName) {
  const normalized = String(modelName || '').trim();
  if (!normalized) return;
  localStorage.setItem(MODEL_STORAGE_KEY, normalized);
}

function attachGuideModelSelector() {
  const select = document.getElementById('guideModelSelect');
  if (!select) return;

  const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
  if (savedModel) {
    select.value = savedModel;
  }

  select.addEventListener('change', () => {
    persistSelectedModel(select.value);
    setGuideSubmitButtonState(document.getElementById('guideSendBtn'), false);
  });
}

function getComparableHealthList(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean))].sort();
}

function getCurrentGuideSubmitPayload() {
  return {
    healthList: getComparableHealthList(healthList),
    model: getSelectedModel()
  };
}

function loadGuideSubmitSnapshot() {
  try {
    const saved = sessionStorage.getItem(GUIDE_SUBMIT_SNAPSHOT_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn('가이드 스냅샷을 불러오지 못했습니다.', error);
    return null;
  }
}

function saveGuideSubmitSnapshot(payload) {
  try {
    sessionStorage.setItem(GUIDE_SUBMIT_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('가이드 스냅샷을 저장하지 못했습니다.', error);
  }
}

function isGuidePayloadSameAsSnapshot(payload, snapshot) {
  return JSON.stringify(payload) === JSON.stringify(snapshot);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureGuideCorrectionPromptContainer() {
  if (document.getElementById('guideCorrectionPromptContainer')) {
    return;
  }

  const resultBox = document.getElementById('guideApiResult');
  if (!resultBox) {
    return;
  }

  const container = document.createElement('div');
  container.id = 'guideCorrectionPromptContainer';
  container.className = 'hidden';
  resultBox.insertAdjacentElement('afterend', container);
}

function hideGuideCorrectionPrompt() {
  const container = document.getElementById('guideCorrectionPromptContainer');
  if (!container) return;

  container.classList.add('hidden');
  container.innerHTML = '';
  pendingCorrectedGuideList = [];
}

function showGuideCorrectionPrompt(correctedGuideList) {
  ensureGuideCorrectionPromptContainer();

  const container = document.getElementById('guideCorrectionPromptContainer');
  if (!container) return;

  pendingCorrectedGuideList = getComparableHealthList(correctedGuideList);
  if (pendingCorrectedGuideList.length === 0) {
    hideGuideCorrectionPrompt();
    return;
  }

  const submittedGuideList = getComparableHealthList(healthList);
  const hasDiff = JSON.stringify(submittedGuideList) !== JSON.stringify(pendingCorrectedGuideList);
  if (!hasDiff) {
    hideGuideCorrectionPrompt();
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = `
    <button
      id="applyGuideCorrectionBtn"
      type="button"
      class="guide-add-button"
      style="margin-top: 0.75rem; padding: 0.5rem 0.85rem; font-size: 0.85rem;"
    >
      입력 보정 적용하기 (보정된 건강 상태 : ${pendingCorrectedGuideList.join(', ')})
    </button>
  `;

  const button = document.getElementById('applyGuideCorrectionBtn');
  if (!button) return;

  button.addEventListener('click', () => {
    healthList = [...pendingCorrectedGuideList];
    renderHealthTags();
    button.textContent = '입력 보정 적용됨';
    button.disabled = true;
    saveGuideSubmitSnapshot(getCurrentGuideSubmitPayload());

    window.setTimeout(() => {
      hideGuideCorrectionPrompt();
    }, 1000);
  });
}

function getSearchUrl(item) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${item} 조심해야 될 성분`)}`;
}

function renderHealthTags() {
  const container = document.getElementById('healthTags');
  if (!container) return;

  if (healthList.length === 0) {
    container.innerHTML = '<span class="muted">입력한 건강 상태가 여기에 표시됩니다.</span>';
  } else {
    container.innerHTML = healthList.map((item, index) => {
      const safeItem = escapeHtml(item);
      const searchUrl = getSearchUrl(item);

      return `
        <span class="tag-chip">
          <a class="tag-link" href="${searchUrl}" target="_blank" rel="noopener noreferrer" aria-label="${safeItem} 관련 검색">
            ${safeItem}
          </a>
          <button type="button" class="tag-remove" onclick="removeHealthItem(${index})" aria-label="${safeItem} 삭제">×</button>
        </span>
      `;
    }).join('');
  }

  localStorage.setItem('healthList', JSON.stringify(healthList));
  setGuideSubmitButtonState(document.getElementById('guideSendBtn'), false);
}

function addHealthItem() {
  const input = document.getElementById('healthInput');
  if (!input) return;

  const value = input.value.trim();
  if (!value) {
    input.focus();
    return;
  }

  if (!healthList.includes(value)) {
    healthList.push(value);
  }

  input.value = '';
  renderHealthTags();
}

function removeHealthItem(index) {
  healthList.splice(index, 1);
  renderHealthTags();
}

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('health-form');
  const input = document.getElementById('healthInput');
  const addButton = document.getElementById('healthAddButton');
  const sendBtn = document.getElementById('guideSendBtn');

  ensureGuideCorrectionPromptContainer();

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      addHealthItem();
    });
  }

  if (addButton) {
    addButton.addEventListener('click', addHealthItem);
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', submitGuideData);
  }

  attachGuideModelSelector();

  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addHealthItem();
      }
    });
  }

  renderHealthTags();
  setGuideSubmitButtonState(document.getElementById('guideSendBtn'), false);
});

// --- API 통신 관련 유틸 및 전송 함수 ---
function isAbnormalTagValue(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return true;
  if (trimmed.length > 30) return true;
  const hasValidCharacters = /[가-힣a-zA-Z]/.test(trimmed);
  return !hasValidCharacters;
}

function filterAbnormalTagValues(values) {
  return (Array.isArray(values) ? values : []).filter((item) => !isAbnormalTagValue(item));
}

function normalizeListValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function setGuideSubmitButtonState(sendBtn, isSubmitting) {
  if (!sendBtn) return;

  const payload = getCurrentGuideSubmitPayload();
  const snapshot = loadGuideSubmitSnapshot();
  const hasSameSnapshot = !!snapshot && isGuidePayloadSameAsSnapshot(payload, snapshot);
  const hasItems = payload.healthList.length > 0;

  sendBtn.disabled = isSubmitting || !hasItems || hasSameSnapshot;

  const label = sendBtn.querySelector('span:last-child');
  if (label) {
    label.textContent = isSubmitting
      ? '전송 중...'
      : (hasSameSnapshot ? '저장된 내용과 같아 전송할 수 없습니다' : '전송하기');
  }
}

function lockGuideSubmitButton(sendBtn) {
  if (!sendBtn) return;

  setGuideSubmitButtonState(sendBtn, true);
}

function getErrorMessage(error, data) {
  const candidate = data?.error || data?.message || error?.message;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }

  return '오류가 발생했습니다. 서버 또는 네트워크를 확인해주세요.';
}

let serverAvoidIngredients = []; // 서버에서 전송받은 기피 성분 목록 변수

// 서버에서 전달받은 기피 성분 목록 JSON 다운로드 함수
function downloadServerAvoidIngredientsJson() {
  if (!serverAvoidIngredients || serverAvoidIngredients.length === 0) {
    alert('다운로드할 추천 기피 성분이 없습니다.');
    return;
  }

  // 이전 페이지들과 동일하게 배열 구조 JSON으로 포맷팅
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(serverAvoidIngredients, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `recommended_avoid_ingredients_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

async function submitGuideData() {
  const sendBtn = document.getElementById('guideSendBtn');
  const resultBox = document.getElementById('guideApiResult');
  const downloadContainer = document.getElementById('downloadContainer');

  if (isGuideSubmitting) {
    return;
  }

  hideGuideCorrectionPrompt();

  if (!Array.isArray(healthList) || healthList.length === 0) {
    alert('건강 상태를 최소 1개 이상 입력해주세요.');
    return;
  }

  const payload = getCurrentGuideSubmitPayload();
  const snapshot = loadGuideSubmitSnapshot();
  if (snapshot && isGuidePayloadSameAsSnapshot(payload, snapshot)) {
    setGuideSubmitButtonState(sendBtn, false);
    return;
  }

  isGuideSubmitting = true;
  lockGuideSubmitButton(sendBtn);

  if (resultBox) {
    resultBox.textContent = '전송 중...';
  }
  if (downloadContainer) {
    downloadContainer.style.display = 'none';
  }

  try {
    const cleanedList = normalizeListValue(healthList);

    const requestBody = {
      guideList: cleanedList,
      guideInputText: cleanedList.join(', '),
      model: getSelectedModel()
    };

    const response = await fetch('/api/avoid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    let data = null;
    try {
      data = await response.json();
    } catch (parseError) {
      data = { message: await response.text() };
    }

    if (!response.ok) {
      throw new Error('오류가 발생했습니다. 다른 모델로 시도해보세요.');
    }

    // 서버 변수 수신 및 다운로드 버튼 노출
    if (Array.isArray(data.avoidIngredients) && data.avoidIngredients.length > 0) {
      serverAvoidIngredients = data.avoidIngredients;
      if (downloadContainer) {
        downloadContainer.style.display = 'block';
      }
    } else {
      serverAvoidIngredients = [];
    }

    if (resultBox) {
      const message = data.message || data.answer || JSON.stringify(data);
      resultBox.innerHTML = escapeHtml(String(message)).replace(/\n/g, '<br>');
    }

    const correctedGuideList = Array.isArray(data.correctedGuideList)
      ? getComparableHealthList(data.correctedGuideList)
      : [];
    const submittedGuideList = getComparableHealthList(healthList);
    const hasCorrectionDiff = correctedGuideList.length > 0
      && JSON.stringify(submittedGuideList) !== JSON.stringify(correctedGuideList);

    if (hasCorrectionDiff) {
      showGuideCorrectionPrompt(correctedGuideList);
    } else {
      hideGuideCorrectionPrompt();
    }

    const abnormalList = Array.isArray(data.abnormalList)
      ? data.abnormalList.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (abnormalList.length > 0) {
      healthList = healthList.filter((item) => !abnormalList.includes(String(item).trim()));
      renderHealthTags();
    }

    saveGuideSubmitSnapshot(getCurrentGuideSubmitPayload());
  } catch (error) {
    if (resultBox) {
      resultBox.textContent = '';
    }

    alert('죄송합니다. 잠시 후 다시 시도해 주세요.');
    console.error(error);
  } finally {
    isGuideSubmitting = false;
    setGuideSubmitButtonState(sendBtn, false);
  }
}

