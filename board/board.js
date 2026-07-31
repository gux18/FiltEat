// ========================================
// Firebase 모듈
// ========================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// ========================================
// Firebase 설정
// ========================================

const firebaseConfig = {
  apiKey: "AIzaSyBdicsQX8aQmeF8zRc-xh-1f6Baf3vv9Sc",
  authDomain: "foodavoidance.firebaseapp.com",
  projectId: "foodavoidance",
  storageBucket: "foodavoidance.firebasestorage.app",
  messagingSenderId: "503905836537",
  appId: "1:503905836537:web:3bf376542f1767fd643128",
  measurementId: "G-LXMMWZ1YFP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


// ========================================
// 게시판 초기화
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("inputPanel");
  const memoInput = document.getElementById("memoInput");
  const memoList = document.getElementById("memoList");

  const toggleBtn = document.getElementById("toggleBtn");
  const submitBtn = document.getElementById("submitBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  const searchInput =
    document.getElementById("boardSearchInput");

  const searchResultText =
    document.getElementById("searchResultText");

  if (
    !panel ||
    !memoInput ||
    !memoList ||
    !toggleBtn ||
    !submitBtn ||
    !cancelBtn
  ) {
    console.error("게시판에 필요한 HTML 요소를 찾지 못했습니다.");
    return;
  }

  let currentUser = null;
  let allMemos = [];

  let unsubscribeMemos = null;

  /*
    게시글마다 생성하는 좋아요 및 댓글 실시간 리스너를
    저장하는 Map입니다.
  */
  const postSubscriptions = new Map();


  // ========================================
  // 게시글 작성창
  // ========================================

  function setFormOpen(isOpen) {
    if (isOpen) {
      panel.classList.add("active");
      toggleBtn.classList.add("open");

      toggleBtn.setAttribute("aria-expanded", "true");
      toggleBtn.setAttribute(
        "aria-label",
        "게시글 작성창 닫기"
      );

      memoInput.focus();
    } else {
      panel.classList.remove("active");
      toggleBtn.classList.remove("open");

      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.setAttribute(
        "aria-label",
        "게시글 작성창 열기"
      );

      toggleBtn.blur();
    }
  }

  function toggleForm() {
    const isOpen = panel.classList.contains("active");
    setFormOpen(!isOpen);
  }

  toggleBtn.addEventListener("click", toggleForm);

  cancelBtn.addEventListener("click", () => {
    setFormOpen(false);
  });


  // ========================================
  // 익명 로그인
  // ========================================

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;

      if (!unsubscribeMemos) {
        subscribeToMemos();
      }

      return;
    }

    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error("익명 로그인 실패:", error);

      showBoardMessage(
        "사용자 인증에 실패했습니다. 페이지를 새로고침해 주세요."
      );
    }
  });


  // ========================================
  // 게시글 등록
  // ========================================

  submitBtn.addEventListener("click", async () => {
    const content = memoInput.value.trim();

    if (!content) {
      alert("내용을 입력해 주세요.");
      memoInput.focus();
      return;
    }

    if (content.length > 500) {
      alert("게시글은 500자 이내로 작성해 주세요.");
      return;
    }

    if (!currentUser) {
      alert("사용자 정보를 준비하는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "등록 중...";

    try {
      await addDoc(collection(db, "memos"), {
        content,
        createdAt: serverTimestamp()
      });

      memoInput.value = "";
      setFormOpen(false);
    } catch (error) {
      console.error("게시글 저장 오류:", error);

      alert(
        "게시글을 저장하지 못했습니다. Firestore 권한을 확인해 주세요."
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "게시글 등록";
    }
  });


  // ========================================
  // 검색
  // ========================================

  if (searchInput) {
    const handleSearchChange = () => {
      renderMemos();
    };
  
    // 키보드로 입력하거나 지울 때
    searchInput.addEventListener("input", handleSearchChange);
  
    // 검색창의 기본 × 버튼을 눌렀을 때
    searchInput.addEventListener("search", handleSearchChange);
  }


  // ========================================
  // 게시글 실시간 수신
  // ========================================

  function subscribeToMemos() {
    const memosQuery = query(
      collection(db, "memos"),
      orderBy("createdAt", "desc")
    );

    unsubscribeMemos = onSnapshot(
      memosQuery,

      (snapshot) => {
        allMemos = snapshot.docs.map((documentSnapshot) => {
          return {
            id: documentSnapshot.id,
            ...documentSnapshot.data()
          };
        });

        renderMemos();
      },

      (error) => {
        console.error("Firestore 게시글 수신 실패:", error);

        showBoardMessage(
          "게시글을 불러오지 못했습니다."
        );
      }
    );
  }


  // ========================================
  // 게시글 목록 출력
  // ========================================

  function renderMemos() {
    clearPostSubscriptions();

    memoList.replaceChildren();

    const keyword = searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";

    const filteredMemos = allMemos.filter((memo) => {
      const content = String(memo.content || "")
        .toLowerCase();

      return content.includes(keyword);
    });

    updateSearchInformation(
      keyword,
      filteredMemos.length
    );

    if (filteredMemos.length === 0) {
      const message = keyword
        ? "검색어와 일치하는 게시글이 없습니다."
        : "아직 작성된 게시글이 없습니다.";

      showBoardMessage(message);
      return;
    }

    filteredMemos.forEach((memo) => {
      const memoElement = createMemoElement(memo);
      memoList.appendChild(memoElement);
    });
  }


  function updateSearchInformation(keyword, resultCount) {
    if (!searchResultText) {
      return;
    }

    if (keyword) {
      searchResultText.textContent =
        `"${keyword}" 검색 결과 ${resultCount}개`;
    } else {
      searchResultText.textContent =
        `전체 게시글 ${allMemos.length}개`;
    }
  }


  // ========================================
  // 게시글 카드 생성
  // ========================================

  function createMemoElement(memo) {
    const memoElement = document.createElement("article");
    memoElement.className = "memo-item";

    const contentElement = document.createElement("div");
    contentElement.className = "memo-content";
    contentElement.textContent =
      memo.content || "내용 없는 게시글";

    const dateElement = document.createElement("div");
    dateElement.className = "memo-date";
    dateElement.textContent =
      formatFirestoreDate(memo.createdAt);

    /*
      좋아요 및 댓글 버튼
    */
    const actionsElement = document.createElement("div");
    actionsElement.className = "memo-actions";

    const likeButton = document.createElement("button");
    likeButton.type = "button";
    likeButton.className = "memo-action like-button";
    likeButton.setAttribute("aria-pressed", "false");

    const likeIcon = document.createElement("span");
    likeIcon.textContent = "♡";
    likeIcon.setAttribute("aria-hidden", "true");

    const likeLabel = document.createElement("span");
    likeLabel.textContent = "좋아요";

    const likeCount = document.createElement("strong");
    likeCount.textContent = "0";

    likeButton.append(
      likeIcon,
      likeLabel,
      likeCount
    );

    const commentButton = document.createElement("button");
    commentButton.type = "button";
    commentButton.className =
      "memo-action comment-toggle-button";

    commentButton.setAttribute(
      "aria-expanded",
      "false"
    );

    const commentIcon = document.createElement("span");
    commentIcon.textContent = "💬";
    commentIcon.setAttribute("aria-hidden", "true");

    const commentLabel = document.createElement("span");
    commentLabel.textContent = "댓글";

    const commentCount = document.createElement("strong");
    commentCount.textContent = "0";

    commentButton.append(
      commentIcon,
      commentLabel,
      commentCount
    );

    actionsElement.append(
      likeButton,
      commentButton
    );


    // ========================================
    // 댓글 패널
    // ========================================

    const commentPanel = document.createElement("div");
    commentPanel.className = "comment-panel";

    const commentList = document.createElement("div");
    commentList.className = "comment-list";

    const commentInputRow =
      document.createElement("div");

    commentInputRow.className = "comment-input-row";

    const commentInput = document.createElement("input");
    commentInput.type = "text";
    commentInput.className = "comment-input";
    commentInput.maxLength = 200;
    commentInput.placeholder = "댓글을 입력하세요";

    const commentSubmit =
      document.createElement("button");

    commentSubmit.type = "button";
    commentSubmit.className = "comment-submit";
    commentSubmit.textContent = "등록";

    commentInputRow.append(
      commentInput,
      commentSubmit
    );

    commentPanel.append(
      commentList,
      commentInputRow
    );


    // ========================================
    // 이벤트
    // ========================================

    likeButton.addEventListener("click", async () => {
      await toggleLike(
        memo.id,
        likeButton
      );
    });

    commentButton.addEventListener("click", () => {
      const isOpen =
        commentPanel.classList.contains("active");

      commentPanel.classList.toggle(
        "active",
        !isOpen
      );

      commentButton.setAttribute(
        "aria-expanded",
        String(!isOpen)
      );

      if (!isOpen) {
        commentInput.focus();
      }
    });

    commentSubmit.addEventListener("click", async () => {
      await submitComment(
        memo.id,
        commentInput,
        commentSubmit
      );
    });

    commentInput.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();

      await submitComment(
        memo.id,
        commentInput,
        commentSubmit
      );
    });


    memoElement.append(
      contentElement,
      dateElement,
      actionsElement,
      commentPanel
    );

    subscribeToPostFeatures(
      memo.id,
      {
        likeButton,
        likeIcon,
        likeCount,
        commentCount,
        commentList
      }
    );

    return memoElement;
  }


  // ========================================
  // 좋아요 및 댓글 실시간 수신
  // ========================================

  function subscribeToPostFeatures(memoId, elements) {
    const {
      likeButton,
      likeIcon,
      likeCount,
      commentCount,
      commentList
    } = elements;

    const unsubscribers = [];


    /*
      좋아요 하위 컬렉션을 실시간으로 구독합니다.
    */
    const likesReference = collection(
      db,
      "memos",
      memoId,
      "likes"
    );

    const unsubscribeLikes = onSnapshot(
      likesReference,

      (snapshot) => {
        const isLiked = snapshot.docs.some(
          (likeDocument) =>
            likeDocument.id === currentUser?.uid
        );

        likeCount.textContent =
          String(snapshot.size);

        likeIcon.textContent =
          isLiked ? "♥" : "♡";

        likeButton.classList.toggle(
          "liked",
          isLiked
        );

        likeButton.setAttribute(
          "aria-pressed",
          String(isLiked)
        );
      },

      (error) => {
        console.error(
          `좋아요 수신 실패 (${memoId}):`,
          error
        );
      }
    );

    unsubscribers.push(unsubscribeLikes);


    /*
      댓글 하위 컬렉션을 시간순으로 구독합니다.
    */
    const commentsQuery = query(
      collection(
        db,
        "memos",
        memoId,
        "comments"
      ),
      orderBy("createdAt", "asc")
    );

    const unsubscribeComments = onSnapshot(
      commentsQuery,

      (snapshot) => {
        commentCount.textContent =
          String(snapshot.size);

        renderComments(
          snapshot,
          commentList
        );
      },

      (error) => {
        console.error(
          `댓글 수신 실패 (${memoId}):`,
          error
        );

        commentList.replaceChildren();

        const errorMessage =
          document.createElement("div");

        errorMessage.className = "comment-empty";
        errorMessage.textContent =
          "댓글을 불러오지 못했습니다.";

        commentList.appendChild(errorMessage);
      }
    );

    unsubscribers.push(unsubscribeComments);

    postSubscriptions.set(
      memoId,
      unsubscribers
    );
  }


  function clearPostSubscriptions() {
    postSubscriptions.forEach((unsubscribers) => {
      unsubscribers.forEach((unsubscribe) => {
        unsubscribe();
      });
    });

    postSubscriptions.clear();
  }


  // ========================================
  // 좋아요 토글
  // ========================================

  async function toggleLike(memoId, button) {
    if (!currentUser) {
      alert("사용자 인증을 준비하는 중입니다.");
      return;
    }

    button.disabled = true;

    const likeReference = doc(
      db,
      "memos",
      memoId,
      "likes",
      currentUser.uid
    );

    try {
      const likeSnapshot =
        await getDoc(likeReference);

      if (likeSnapshot.exists()) {
        /*
          이미 좋아요를 눌렀으면 취소합니다.
        */
        await deleteDoc(likeReference);
      } else {
        /*
          사용자 UID를 문서 ID로 사용하므로
          같은 사용자는 문서를 하나만 가질 수 있습니다.
        */
        await setDoc(likeReference, {
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("좋아요 처리 실패:", error);

      alert(
        "좋아요를 처리하지 못했습니다. Firestore 권한을 확인해 주세요."
      );
    } finally {
      button.disabled = false;
    }
  }


  // ========================================
  // 댓글 등록
  // ========================================

  async function submitComment(
    memoId,
    input,
    button
  ) {
    const content = input.value.trim();

    if (!content) {
      input.focus();
      return;
    }

    if (content.length > 200) {
      alert("댓글은 200자 이내로 작성해 주세요.");
      return;
    }

    if (!currentUser) {
      alert("사용자 인증을 준비하는 중입니다.");
      return;
    }

    button.disabled = true;
    button.textContent = "등록 중...";

    try {
      await addDoc(
        collection(
          db,
          "memos",
          memoId,
          "comments"
        ),
        {
          content,
          authorId: currentUser.uid,
          createdAt: serverTimestamp()
        }
      );

      input.value = "";
      input.focus();
    } catch (error) {
      console.error("댓글 등록 실패:", error);

      alert(
        "댓글을 등록하지 못했습니다. Firestore 권한을 확인해 주세요."
      );
    } finally {
      button.disabled = false;
      button.textContent = "등록";
    }
  }


  // ========================================
  // 댓글 출력
  // ========================================

  function renderComments(snapshot, container) {
    container.replaceChildren();

    if (snapshot.empty) {
      const emptyMessage =
        document.createElement("div");

      emptyMessage.className = "comment-empty";
      emptyMessage.textContent =
        "아직 댓글이 없습니다.";

      container.appendChild(emptyMessage);
      return;
    }

    snapshot.forEach((commentDocument) => {
      const comment = commentDocument.data();

      const commentElement =
        document.createElement("div");

      commentElement.className = "comment-item";

      const bodyElement =
        document.createElement("div");

      bodyElement.className = "comment-body";
      bodyElement.textContent =
        comment.content || "";

      const metaElement =
        document.createElement("div");

      metaElement.className = "comment-meta";

      const authorName =
        comment.authorId === currentUser?.uid
          ? "나"
          : "익명";

      metaElement.textContent =
        `${authorName} · ${formatFirestoreDate(comment.createdAt)}`;

      commentElement.append(
        bodyElement,
        metaElement
      );

      container.appendChild(commentElement);
    });
  }


  // ========================================
  // 공통 함수
  // ========================================

  function formatFirestoreDate(value) {
    if (
      !value ||
      typeof value.toDate !== "function"
    ) {
      return "방금 전";
    }

    return value
      .toDate()
      .toLocaleString("ko-KR");
  }


  function showBoardMessage(message) {
    memoList.replaceChildren();

    const messageElement =
      document.createElement("div");

    messageElement.className =
      "board-status-message";

    messageElement.textContent = message;

    memoList.appendChild(messageElement);
  }


  window.addEventListener("beforeunload", () => {
    if (unsubscribeMemos) {
      unsubscribeMemos();
    }

    clearPostSubscriptions();
  });
});

const clearSearchIcon =
  document.getElementById("clearSearchIcon");

if (searchInput && clearSearchIcon) {
  searchInput.addEventListener("input", () => {
    clearSearchIcon.hidden =
      searchInput.value.length === 0;

    renderMemos();
  });

  clearSearchIcon.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchIcon.hidden = true;

    renderMemos();
    searchInput.focus();
  });
}
