  // 안정성이 검증된 Firebase v10 SDK ESM 사용
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
    import { 
      getFirestore, 
      collection, 
      addDoc, 
      onSnapshot, 
      query, 
      orderBy, 
      serverTimestamp 
    } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

    const firebaseConfig = {
      apiKey: "AIzaSyBdicsQX8aQmeF8zRc-xh-1f6Baf3vv9Sc",
      authDomain: "foodavoidance.firebaseapp.com",
      projectId: "foodavoidance",
      storageBucket: "foodavoidance.firebasestorage.app",
      messagingSenderId: "503905836537",
      appId: "1:503905836537:web:3bf376542f1767fd643128",
      measurementId: "G-LXMMWZ1YFP"
    };

    // Firebase 초기화
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // DOM 파싱 완료 후 초기화
    document.addEventListener('DOMContentLoaded', () => {
      const panel = document.getElementById('inputPanel');
      const memoInput = document.getElementById('memoInput');
      const memoList = document.getElementById('memoList');
      const toggleBtn = document.getElementById('toggleBtn');
      const submitBtn = document.getElementById('submitBtn');
      const cancelBtn = document.getElementById('cancelBtn');

      function setFormOpen(isOpen) {
        panel.classList.toggle('active', isOpen);
        toggleBtn.classList.toggle('open', isOpen);
      
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
        toggleBtn.setAttribute('aria-label', isOpen ? '게시글 작성창 닫기' : '게시글 작성창 열기');
      
        if (isOpen) {
          memoInput.focus();
        }
      }
      
      function toggleForm() {
        const isOpen = panel.classList.contains('active');
        setFormOpen(!isOpen);
      }
      
      toggleBtn.addEventListener('click', toggleForm);
      
      cancelBtn.addEventListener('click', () => {
        setFormOpen(false);
      });

      // 메모 등록
      submitBtn.addEventListener('click', async () => {
        const value = memoInput.value.trim();
        if (!value) {
          alert('내용을 입력해주세요.');
          return;
        }

        submitBtn.disabled = true;

        try {
          await addDoc(collection(db, "memos"), {
            content: value,
            createdAt: serverTimestamp()
          });

          memoInput.value = '';
          setFormOpen(false);
        } catch (error) {
          console.error("Firestore 저장 오류:", error);
          alert("글 저장 권한이 없거나 오류가 발생했습니다. (Console 확인)");
        } finally {
          submitBtn.disabled = false;
        }
      });

      // 실시간 데이터 수신 (안정적인 query 처리)
      const memosRef = collection(db, "memos");
      const q = query(memosRef, orderBy("createdAt", "desc"));

      onSnapshot(q, (snapshot) => {
        memoList.innerHTML = '';
        if (snapshot.empty) {
          memoList.innerHTML = `
            <div class="board-status-message">
              아직 작성된 게시글이 없습니다.<br>
              첫 번째 게시글을 작성해 보세요.
            </div>
          `;
          return;
        }
      
        snapshot.forEach((doc) => {
          const data = doc.data();
          const memoDiv = document.createElement('div');
          memoDiv.className = 'memo-item';
          
          // Timestamp 변환 예외 처리
          let dateStr = '방금 전';
          if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            dateStr = data.createdAt.toDate().toLocaleString('ko-KR');
          }

          memoDiv.innerHTML = `
            <div>${escapeHtml(data.content || '')}</div>
            <div class="memo-date">${dateStr}</div>
          `;
          memoList.appendChild(memoDiv);
        });
      }, (error) => {
        console.error("Firestore 수신 실패:", error);
        // 복합 인덱스 이슈 발생 시 fallback 처리
        if (error.code === 'failed-precondition') {
          console.warn("Firestore Index 설정이 필요할 수 있습니다.");
        }
      });

      function escapeHtml(text) {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
      }
    });
