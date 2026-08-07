let foodList = JSON.parse(localStorage.getItem('foodList') || '[]');
let ingredientList = JSON.parse(localStorage.getItem('ingredientList') || '[]');
let buttonLockTimer = null;
let pendingCorrectedFoodList = [];
let pendingCorrectedIngredientList = [];
const ALTERNATIVE_SUBMIT_SNAPSHOT_KEY = 'food-avoidance-alternative-submit-snapshot';
const MODEL_STORAGE_KEY = 'food-avoidance-selected-model';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

function getSelectedModel() {
  const select = document.getElementById('alternativeModelSelect');
  const value = select ? String(select.value || '').trim() : '';
  return value || DEFAULT_MODEL;
}

function persistSelectedModel(modelName) {
  const normalized = String(modelName || '').trim();
  if (!normalized) return;
  localStorage.setItem(MODEL_STORAGE_KEY, normalized);
}

function attachAlternativeModelSelector() {
  const select = document.getElementById('alternativeModelSelect');
  if (!select) return;

  const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
  if (savedModel) {
    select.value = savedModel;
  }

  select.addEventListener('change', () => {
    persistSelectedModel(select.value);
    setSubmitButtonState(document.getElementById('sendBtn'), false);
  });
}

function getComparableList(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean))].sort();
}

function getCurrentAlternativeSubmitPayload() {
  return {
    foodList: getComparableList(foodList),
    ingredientList: getComparableList(ingredientList),
    model: getSelectedModel()
  };
}

function loadAlternativeSubmitSnapshot() {
  try {
    const saved = sessionStorage.getItem(ALTERNATIVE_SUBMIT_SNAPSHOT_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn('대체식품 스냅샷을 불러오지 못했습니다.', error);
    return null;
  }
}

function saveAlternativeSubmitSnapshot(payload) {
  try {
    sessionStorage.setItem(ALTERNATIVE_SUBMIT_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('대체식품 스냅샷을 저장하지 못했습니다.', error);
  }
}

function isAlternativePayloadSameAsSnapshot(payload, snapshot) {
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

function ensureAlternativeCorrectionPromptContainer() {
  if (document.getElementById('alternativeCorrectionPromptContainer')) {
    return;
  }

  const resultBox = document.getElementById('apiResult');
  if (!resultBox) {
    return;
  }

  const container = document.createElement('div');
  container.id = 'alternativeCorrectionPromptContainer';
  container.className = 'hidden';
  resultBox.insertAdjacentElement('afterend', container);
}

function hideAlternativeCorrectionPrompt() {
  const container = document.getElementById('alternativeCorrectionPromptContainer');
  if (!container) return;

  container.classList.add('hidden');
  container.innerHTML = '';
  pendingCorrectedFoodList = [];
  pendingCorrectedIngredientList = [];
}

function showAlternativeCorrectionPrompt(correctedFoodList, correctedIngredientList) {
  ensureAlternativeCorrectionPromptContainer();

  const container = document.getElementById('alternativeCorrectionPromptContainer');
  if (!container) return;

  pendingCorrectedFoodList = getComparableList(correctedFoodList);
  pendingCorrectedIngredientList = getComparableList(correctedIngredientList);

  const submittedFoodList = getComparableList(foodList);
  const submittedIngredientList = getComparableList(ingredientList);
  const hasFoodDiff = JSON.stringify(submittedFoodList) !== JSON.stringify(pendingCorrectedFoodList);
  const hasIngredientDiff = JSON.stringify(submittedIngredientList) !== JSON.stringify(pendingCorrectedIngredientList);

  if (!hasFoodDiff && !hasIngredientDiff) {
    hideAlternativeCorrectionPrompt();
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = `
    <button
      id="applyAlternativeCorrectionBtn"
      type="button"
      class="alternative-add-button"
      style="margin-top: 0.75rem; padding: 0.4rem 0.8rem; font-size: 0.85rem;"
    >
      입력 보정 적용하기 (보정된 식품 : ${pendingCorrectedFoodList.join(', ')} / 보정된 성분 : ${pendingCorrectedIngredientList.join(', ')})
    </button>
  `;

  const button = document.getElementById('applyAlternativeCorrectionBtn');
  if (!button) return;

  button.addEventListener('click', () => {
    foodList = [...pendingCorrectedFoodList];
    ingredientList = [...pendingCorrectedIngredientList];
    renderFoodTags();
    renderIngredientTags();
    button.textContent = '입력 보정 적용됨';
    button.disabled = true;
    saveAlternativeSubmitSnapshot(getCurrentAlternativeSubmitPayload());

    window.setTimeout(() => {
      hideAlternativeCorrectionPrompt();
    }, 1000);
  });
}

function isAbnormalTagValue(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return true;
  if (trimmed.length > 30) return true;
  return false;
}

function filterAbnormalTagValues(values) {
  return (Array.isArray(values) ? values : []).filter((item) => !isAbnormalTagValue(item));
}

function renderFoodTags() {
  foodList = filterAbnormalTagValues(foodList);

  const container = document.getElementById('foodTags');
  if (!container) return;

  if (foodList.length === 0) {
    container.innerHTML = '<span class="muted">추가한 식품이 여기에 표시됩니다.</span>';
  } else {
    container.innerHTML = foodList.map((item, index) => {
      const safeItem = escapeHtml(item);
      return `
        <span class="tag-chip">
          <span>${safeItem}</span>
          <button type="button" class="tag-remove" onclick="removeFoodItem(${index})" aria-label="${safeItem} 삭제">×</button>
        </span>
      `;
    }).join('');
  }

  localStorage.setItem('foodList', JSON.stringify(foodList));
  setSubmitButtonState(document.getElementById('sendBtn'), false);
}

function renderIngredientTags() {
  ingredientList = filterAbnormalTagValues(ingredientList);

  const container = document.getElementById('ingredientTags');
  if (!container) return;

  if (ingredientList.length === 0) {
    container.innerHTML = '<span class="muted">추가한 성분이 여기에 표시됩니다.</span>';
  } else {
    container.innerHTML = ingredientList.map((item, index) => {
      const safeItem = escapeHtml(item);
      return `
        <span class="tag-chip">
          <span>${safeItem}</span>
          <button type="button" class="tag-remove" onclick="removeIngredientItem(${index})" aria-label="${safeItem} 삭제">×</button>
        </span>
      `;
    }).join('');
  }

  localStorage.setItem('ingredientList', JSON.stringify(ingredientList));
  setSubmitButtonState(document.getElementById('sendBtn'), false);
}

function addFoodItem() {
  const input = document.getElementById('foodInput');
  if (!input) return;

  const value = input.value.trim();
  if (!value) {
    input.focus();
    return;
  }

  if (isAbnormalTagValue(value)) {
    alert("30자 이내의 음식만 입력할 수 있습니다.");
    return;
  }

  if (!foodList.includes(value)) {
    foodList.push(value);
  }

  input.value = '';
  renderFoodTags();
}

function removeFoodItem(index) {
  foodList.splice(index, 1);
  renderFoodTags();
}

function addIngredientItem() {
  const input = document.getElementById('ingredientInput');
  if (!input) return;

  const value = input.value.trim();
  if (!value) {
    input.focus();
    return;
  }

  if (isAbnormalTagValue(value)) {
    alert("30자 이내의 성분만 입력할 수 있습니다.");
    return;
  }

  if (!ingredientList.includes(value)) {
    ingredientList.push(value);
  }

  input.value = '';
  renderIngredientTags();
}

function removeIngredientItem(index) {
  ingredientList.splice(index, 1);
  renderIngredientTags();
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

function setSubmitButtonState(sendBtn, isSubmitting) {
  if (!sendBtn) return;

  const payload = getCurrentAlternativeSubmitPayload();
  const snapshot = loadAlternativeSubmitSnapshot();
  const hasSameSnapshot = !!snapshot && isAlternativePayloadSameAsSnapshot(payload, snapshot);
  const hasItems = payload.foodList.length > 0 || payload.ingredientList.length > 0;

  sendBtn.disabled = isSubmitting || !hasItems || hasSameSnapshot;
  sendBtn.textContent = isSubmitting
    ? '전송 중...'
    : (hasSameSnapshot ? '저장된 내용과 같아 전송할 수 없습니다' : 'AI에게 전송');
}

function lockSubmitButton(sendBtn) {
  if (!sendBtn) return;

  setSubmitButtonState(sendBtn, true);

  if (buttonLockTimer) {
    clearTimeout(buttonLockTimer);
  }

  buttonLockTimer = setTimeout(() => {
    setSubmitButtonState(sendBtn, false);
    buttonLockTimer = null;
  }, 5000);
}

async function submitAlternativeData() {
  const resultBox = document.getElementById('apiResult');
  const sendBtn = document.getElementById('sendBtn');

  hideAlternativeCorrectionPrompt();

  if (foodList.length === 0 && ingredientList.length === 0) {
    alert('식품 또는 성분을 최소 1개 이상 입력해주세요.');
    return;
  }

  const payload = getCurrentAlternativeSubmitPayload();
  const snapshot = loadAlternativeSubmitSnapshot();
  if (snapshot && isAlternativePayloadSameAsSnapshot(payload, snapshot)) {
    setSubmitButtonState(sendBtn, false);
    return;
  }

  if (sendBtn) {
    lockSubmitButton(sendBtn);
  }

  if (resultBox) {
    resultBox.textContent = '전송 중...';
  }

  try {
    foodList = filterAbnormalTagValues(foodList);
    ingredientList = filterAbnormalTagValues(ingredientList);
    renderFoodTags();
    renderIngredientTags();

    const cleanedFoodList = normalizeListValue(foodList);
    const cleanedIngredientList = normalizeListValue(ingredientList);

    const requestBody = {
      foodList: cleanedFoodList,
      ingredientList: cleanedIngredientList,
      foodInputText: cleanedFoodList.join(', '),
      ingredientInputText: cleanedIngredientList.join(', '),
      model: getSelectedModel()
    };

    const response = await fetch('/api/alternative', {
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
      throw new Error(data.error || data.message || '전송에 실패했습니다.');
    }

    if (resultBox) {
      const message = data.message || data.answer || '전송이 완료되었습니다.';
      const responseText = message;
      resultBox.innerHTML = escapeHtml(responseText).replace(/\n/g, '<br>');
    }

    const correctedFoodList = Array.isArray(data.correctedFoodList)
      ? getComparableList(data.correctedFoodList)
      : [];
    const correctedIngredientList = Array.isArray(data.correctedIngredientList)
      ? getComparableList(data.correctedIngredientList)
      : [];
    const submittedFoodList = getComparableList(foodList);
    const submittedIngredientList = getComparableList(ingredientList);
    const hasCorrectionDiff = (correctedFoodList.length > 0 && JSON.stringify(submittedFoodList) !== JSON.stringify(correctedFoodList))
      || (correctedIngredientList.length > 0 && JSON.stringify(submittedIngredientList) !== JSON.stringify(correctedIngredientList));

    if (hasCorrectionDiff) {
      showAlternativeCorrectionPrompt(correctedFoodList, correctedIngredientList);
    } else {
      hideAlternativeCorrectionPrompt();
    }

    const abnormalFoodList = Array.isArray(data.abnormalFoodList)
      ? data.abnormalFoodList.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const abnormalIngredientList = Array.isArray(data.abnormalIngredientList)
      ? data.abnormalIngredientList.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (abnormalFoodList.length > 0 || abnormalIngredientList.length > 0) {
      foodList = foodList.filter((item) => !abnormalFoodList.includes(String(item).trim()));
      ingredientList = ingredientList.filter((item) => !abnormalIngredientList.includes(String(item).trim()));
      renderFoodTags();
      renderIngredientTags();
    }

    saveAlternativeSubmitSnapshot(getCurrentAlternativeSubmitPayload());
    setSubmitButtonState(sendBtn, false);
  } catch (error) {
    if (resultBox) {
      resultBox.textContent = '오류가 발생했습니다. 다른 모델로 시도해주세요. \n' + error.message;
    }
    console.error(error);
  } finally {
    if (sendBtn && !buttonLockTimer) {
      setSubmitButtonState(sendBtn, false);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const foodInput = document.getElementById('foodInput');
  const ingredientInput = document.getElementById('ingredientInput');
  const sendBtn = document.getElementById('sendBtn');

  ensureAlternativeCorrectionPromptContainer();
  attachAlternativeModelSelector();

  if (sendBtn) {
    sendBtn.addEventListener('click', submitAlternativeData);
  }

  if (foodInput) {
    foodInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addFoodItem();
      }
    });
  }

  if (ingredientInput) {
    ingredientInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addIngredientItem();
      }
    });
  }

  renderFoodTags();
  renderIngredientTags();
  setSubmitButtonState(document.getElementById('sendBtn'), false);
});

// ==========================================
// 피해야 할 성분 JSON 다운로드 및 업로드
// ==========================================

// 1. 피해야 할 성분 JSON 다운로드
function downloadIngredientListJson() {
  if (!ingredientList || ingredientList.length === 0) {
    alert('다운로드할 피해야 할 성분이 없습니다.');
    return;
  }

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ingredientList, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `avoid_ingredients_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// 2. 피해야 할 성분 JSON 업로드
function uploadIngredientListJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.type !== "application/json" && !file.name.endsWith('.json')) {
    alert("JSON 파일만 업로드할 수 있습니다.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsedData = JSON.parse(e.target.result);

      if (!Array.isArray(parsedData)) {
        throw new Error('올바른 성분 목록 형식(배열)이 아닙니다.');
      }

      // 문자열 데이터 추출 및 30자 이내 규칙 검증
      const validItems = parsedData
        .map(item => String(item || '').trim())
        .filter(item => item.length > 0 && item.length <= 30);

      if (validItems.length === 0) {
        alert('유효한 성분 데이터가 없습니다.');
        return;
      }

      // 기존 피해야 할 성분 목록과 합치고 중복 제거
      ingredientList = [...new Set([...ingredientList, ...validItems])];

      // UI 갱신
      renderIngredientTags();
      alert(`총 ${validItems.length}개의 피해야 할 성분을 불러왔습니다.`);
    } catch (err) {
      alert('JSON 파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}
