let healthList = JSON.parse(localStorage.getItem('healthList') || '[]');
let isGuideSubmitting = false;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addHealthItem();
      }
    });
  }

  renderHealthTags();
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

  sendBtn.disabled = isSubmitting;

  const label = sendBtn.querySelector('span:last-child');
  if (label) {
    label.textContent = isSubmitting ? '전송 중...' : '전송하기';
  }
}

function getErrorMessage(error, data) {
  const candidate = data?.error || data?.message || error?.message;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }

  return '오류가 발생했습니다. 서버 또는 네트워크를 확인해주세요.';
}

async function submitGuideData() {
  const sendBtn = document.getElementById('guideSendBtn');
  const resultBox = document.getElementById('guideApiResult');

  if (isGuideSubmitting) {
    return;
  }

  if (!Array.isArray(healthList) || healthList.length === 0) {
    alert('건강 상태를 최소 1개 이상 입력해주세요.');
    return;
  }

  isGuideSubmitting = true;

  setGuideSubmitButtonState(sendBtn, true);
  if (resultBox) {
    resultBox.textContent = '전송 중...';
  }

  try {
    // Client-side 필터링으로 기존 태그를 지우지 않고 전송용 복사본 생성
    const cleanedList = normalizeListValue(healthList);

    const requestBody = {
      guideList: cleanedList,
      guideInputText: cleanedList.join(', ')
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
      throw new Error(data.error || data.message || '전송에 실패했습니다.');
    }

    if (resultBox) {
      const message = data.message || data.answer || JSON.stringify(data);
      resultBox.innerHTML = escapeHtml(String(message)).replace(/\n/g, '<br>');
    }

    // 2. 서버 검증 응답 이후에만 비정상 항목 삭제
    const abnormalList = Array.isArray(data.abnormalList)
      ? data.abnormalList.map((i) => String(i).trim()).filter(Boolean)
      : [];

    if (abnormalList.length > 0) {
      healthList = healthList.filter((item) => !abnormalList.includes(String(item).trim()));
      renderHealthTags();
    }
  } catch (error) {
    if (resultBox) {
      resultBox.textContent = getErrorMessage(error, null);
    }
    console.error(error);
  } finally {
    isGuideSubmitting = false;
    setGuideSubmitButtonState(sendBtn, false);
  }
}
