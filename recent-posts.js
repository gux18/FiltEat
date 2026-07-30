import { db } from "./firebaseAdmin.js";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const recentPostList = document.getElementById("recentPostList");

/**
 * Firestore의 memos 컬렉션에서 최신 게시글을 불러옵니다.
 */
async function loadRecentPosts() {
  if (!recentPostList) {
    return;
  }
  showLoadingMessage();
  try {
    const memosReference = collection(db, "memos");
    const recentPostsQuery = query(memosReference,orderBy("createdAt", "desc"),limit(3));
    const querySnapshot = await getDocs(recentPostsQuery);

    if (querySnapshot.empty) {
      showEmptyMessage();
      return;
    }

    recentPostList.replaceChildren();

    querySnapshot.forEach((documentSnapshot) => {
      const post = documentSnapshot.data();
      const postElement = createRecentPostElement(documentSnapshot.id, post);
      recentPostList.appendChild(postElement);
    });
  } catch (error) {
    console.error("최근 게시글 불러오기 실패:", error);
    showErrorMessage(error);
  }
}

/**
 * 최근 게시글 한 개의 HTML 요소를 생성합니다.
 */
function createRecentPostElement(documentId, post) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "recent-post";

  const category = document.createElement("span");
  category.className = "post-category";
  category.textContent = post.category || "일반";

  const information = document.createElement("span");
  information.className = "post-information";

  const title = document.createElement("strong");
  title.textContent = post.title || "제목 없는 게시글";

  const metadata = document.createElement("small");

  const author = post.author || post.nickname || "익명";
  const date = formatFirestoreDate(post.createdAt);

  metadata.textContent = `${author} · ${date}`;

  information.append(title, metadata);

  const arrow = document.createElement("span");
  arrow.className = "post-arrow";
  arrow.textContent = "›";

  button.append(category, information, arrow);

  button.addEventListener("click", () => {
    /*
      현재는 게시판 탭만 엽니다.
      documentId를 사용하면 나중에 특정 게시글까지 열 수 있습니다.
    */
    sessionStorage.setItem(
      "selectedMemoId",
      documentId
    );

    if (typeof window.openTab === "function") {
      window.openTab("board");
    }
  });

  return button;
}

/**
 * Firestore Timestamp 또는 날짜 값을 화면용 문자열로 변환합니다.
 */
function formatFirestoreDate(value) {
  if (!value) {
    return "날짜 없음";
  }

  let date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return "날짜 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function showLoadingMessage() {
  recentPostList.replaceChildren();
  
  const message = document.createElement("div");
  message.className = "recent-post-message";
  message.textContent = "최근 게시글을 불러오는 중입니다.";

  recentPostList.appendChild(message);
}

function showEmptyMessage() {
  recentPostList.replaceChildren();

  const message = document.createElement("div");
  message.className = "recent-post-message";
  message.textContent = "아직 작성된 게시글이 없습니다.";

  recentPostList.appendChild(message);
}

function showErrorMessage(error) {
  recentPostList.replaceChildren();

  const message = document.createElement("div");
  message.className = "recent-post-message error";
  message.textContent =
    "최근 게시글을 불러오지 못했습니다.";

  recentPostList.appendChild(message);

  /*
    permission-denied 오류라면 Firestore 보안 규칙을 확인해야 합니다.
  */
  if (error?.code === "permission-denied") {
    console.error(
      "Firestore 읽기 권한이 없습니다. 보안 규칙을 확인하세요."
    );
  }
}

document.addEventListener("DOMContentLoaded", loadRecentPosts);
