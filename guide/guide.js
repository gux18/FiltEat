let healthList = JSON.parse(localStorage.getItem('healthList') || '[]');

function escapeHtml(value) {
  return value
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
  const input = document.getElementById('healthInput');
  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addHealthItem();
      }
    });
  }
  // API 버튼과 결과 영역 연결
  const sendBtn = document.getElementById('guideSendBtn');
  const resultBox = document.getElementById('guideApiResult');

  if (sendBtn) {
    sendBtn.addEventListener('click', submitGuideData);
  }

  renderHealthTags();

  // 유틸: 엔터로 항목 추가
  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addHealthItem();
      }
    });
  }
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

let _guideButtonLockTimer = null;
function lockSubmitButton(sendBtn) {
  if (!sendBtn) return;

  sendBtn.disabled = true;
  sendBtn.textContent = '전송 중...';

  if (_guideButtonLockTimer) {
    clearTimeout(_guideButtonLockTimer);
  }

  _guideButtonLockTimer = setTimeout(() => {
    sendBtn.disabled = false;
    sendBtn.textContent = '서버에 전송';
    _guideButtonLockTimer = null;
  }, 5000);
}

async function submitGuideData() {
  const sendBtn = document.getElementById('guideSendBtn');
  const resultBox = document.getElementById('guideApiResult');

  if (!Array.isArray(healthList) || healthList.length === 0) {
    alert('건강 상태를 최소 1개 이상 입력해주세요.');
    return;
  }

  if (sendBtn) lockSubmitButton(sendBtn);
  if (resultBox) resultBox.textContent = '전송 중...';

  try {
    healthList = filterAbnormalTagValues(healthList);
    renderHealthTags();

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

    // 서버가 비정상 항목 리스트를 반환하면 로컬 목록에서 제거
    const abnormalList = Array.isArray(data.abnormalList) ? data.abnormalList.map((i) => String(i).trim()).filter(Boolean) : [];
    if (abnormalList.length > 0) {
      healthList = healthList.filter((item) => !abnormalList.includes(String(item).trim()));
      renderHealthTags();
    }
  } catch (error) {
    if (resultBox) {
      resultBox.textContent = '오류가 발생했습니다. 서버 또는 네트워크를 확인해주세요.';
    }
    console.error(error);
  } finally {
    if (sendBtn && !_guideButtonLockTimer) {
      sendBtn.disabled = false;
      sendBtn.textContent = '서버에 전송';
    }
  }
}
