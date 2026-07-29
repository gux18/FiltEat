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

  renderHealthTags();
});
