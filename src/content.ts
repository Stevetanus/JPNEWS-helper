// Log when content script is loaded
console.log('[JPNEWS] ===== CONTENT SCRIPT LOADED =====');
console.log('[JPNEWS] Content script loaded at:', new Date().toISOString());
console.log('[JPNEWS] URL:', window.location.href);
console.log('[JPNEWS] Document ready state:', document.readyState);
let rawNews = '';
// 只在 NHK Easy News 網頁執行
if (window.location.href.includes('https://www3.nhk.or.jp/news/easy/')) {
  const urlSegments = window.location.pathname.split('/');
  const lastSegment = urlSegments[urlSegments.length - 1];
  const pageId = lastSegment.endsWith('.html')
    ? lastSegment.replace('.html', '')
    : lastSegment;

  // 主動通知 background
  chrome.runtime.sendMessage({
    action: 'nhk-news-page',
    pageId,
    url: window.location.href,
  });

  let result = '';
  document
    .querySelectorAll('#js-article-body p')
    .forEach((p) => (result += (p as HTMLParagraphElement).innerText + '\n'));

  rawNews = result; // 儲存原始新聞內容
}

const ACTION = {
  FLASHCARD_ADDED: 'flashcard-added',
  content_TEXT: 'analyze-text',
};

// content.js

let mainStatus: 'chat' | 'sum' | 'analyze' | 'empty' = 'empty';
let buttons: HTMLDivElement | null = null;
let toggleButtons: HTMLButtonElement[] = [];
let summarizeBtn: HTMLButtonElement | null = null;
let translateBtn: HTMLButtonElement | null = null;
let analyzeBtn: HTMLButtonElement | null;
let sidebar: HTMLDivElement | null = null;
let header: HTMLDivElement | null = null;
let content: HTMLDivElement | null = null;
let main: HTMLDivElement | null = null;
let bgOverlay: HTMLDivElement | null = null;
let overlay: HTMLDivElement | null = null;
let spinner: HTMLDivElement | null = null;
let chat: HTMLDivElement | null = null;
let chatForm: HTMLFormElement | null = null;
let chatInput: HTMLInputElement | null = null;
let sendBtn: HTMLButtonElement | null = null;
let switchBtn: HTMLButtonElement | null = null;
let isChatOpen = false;
let userMsgList: HTMLDivElement[] = [];
let botMsgList: HTMLDivElement[] = [];
let controlsDiv: HTMLDivElement | null = null;
let prevBtn: HTMLButtonElement | null = null;
let nextBtn: HTMLButtonElement | null = null;

function createSidebar() {
  sidebar = document.createElement('div');

  sidebar.id = 'jpnews-sidebar';
  sidebar.style.position = 'fixed';
  sidebar.style.top = '40px';
  sidebar.style.right = '50px';
  sidebar.style.width = '300px';
  sidebar.style.height = window.innerHeight - 80 + 'px';
  sidebar.style.backgroundColor = 'white';
  sidebar.style.border = '1px solid #ccc';
  sidebar.style.zIndex = '9999';
  sidebar.style.overflowY = 'auto';
  sidebar.style.padding = '10px';
  sidebar.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
  sidebar.style.resize = 'both';
  sidebar.style.minWidth = '200px';
  sidebar.style.minHeight = '200px';

  // 上方 tab / header
  header = document.createElement('div');
  header.style.backgroundColor = '#eee';
  header.style.padding = '8px';
  header.style.cursor = 'move';
  header.style.fontWeight = 'bold';
  header.style.marginBottom = '8px';
  header.innerText = 'JP NEWS HELPER';

  // 內容區
  content = document.createElement('div');
  // content.style.padding = '10px';
  content.style.gap = '8px';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.height = 'calc(100% - 50px)'; // header 高度約 40px
  content.style.overflowY = 'auto';

  main = document.createElement('div');
  main.id = 'jpnews-main';
  main.style.flex = '1';
  main.style.overflowY = 'auto';
  main.style.fontSize = '16px';
  main.style.lineHeight = '1.5';
  main.style.border = '1px solid #ccc';
  main.style.paddingLeft = '4px';
  main.style.paddingRight = '4px';
  content.appendChild(main);

  // 先確保 main 可以當定位父層
  main.style.position = 'relative';

  // 建立一個跟 main 一樣大小的透明 div
  bgOverlay = document.createElement('div');
  bgOverlay.id = 'jpnews-bg-overlay';
  bgOverlay.style.position = 'absolute';
  bgOverlay.style.top = main.offsetTop + 'px';
  bgOverlay.style.left = main.offsetLeft + 'px';
  bgOverlay.style.width = main.offsetWidth + 'px';
  bgOverlay.style.height = main.offsetHeight + 'px';
  bgOverlay.style.backgroundColor = 'transparent';
  bgOverlay.style.zIndex = '0';

  // 把 bgOverlay 插到 main 前面（main 的背後）
  content.insertBefore(bgOverlay, main);

  // 建立 overlay
  overlay = document.createElement('div');
  overlay.id = 'jpnews-overlay';
  overlay.style.position = 'absolute';
  overlay.style.top = '56px';
  overlay.style.left = '8px';

  const observer = new ResizeObserver(() => {
    overlay!.style.width = main!.offsetWidth + 'px';
    overlay!.style.height = main!.offsetHeight + 'px';
  });
  observer.observe(main);

  overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'; // 半透明白色
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '1000';
  overlay.innerText = 'Loading...';

  // 建立 spinner
  spinner = document.createElement('div');
  spinner.id = 'jpnews-spinner';
  spinner.style.width = '40px';
  spinner.style.height = '40px';
  spinner.style.border = '4px solid #ccc';
  spinner.style.borderTop = '4px solid #333';
  spinner.style.borderRadius = '50%';
  spinner.style.animation = 'spin 1s linear infinite';

  // 加上動畫 (只需要一次)
  const style = document.createElement('style');
  style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  `;
  document.head.appendChild(style);
  // 加入 spinner 到 overlay
  overlay.appendChild(spinner);
  // 把 overlay 加到 sidebar 裡
  sidebar.appendChild(overlay);

  // 建立容器
  chatForm = document.createElement('form');
  chatForm.style.width = '100%';
  chatForm.style.height = '40px';
  chatForm.style.gap = '8px';
  chatForm.style.display = 'flex';
  chatForm.style.backgroundColor = '#f9f9f9';
  chatForm.style.border = 'none';
  chatForm.style.fontSize = '16px';

  // 建立切換按鈕
  // switchBtn = document.createElement('button');
  // switchBtn.type = 'submit';
  // switchBtn.innerText = '^';
  // switchBtn.style.width = '40px';
  // switchBtn.style.padding = '8px 12px';
  // switchBtn.style.border = 'none';
  // switchBtn.style.backgroundColor = '#4caf50';
  // switchBtn.style.color = '#fff';
  // switchBtn.style.borderRadius = '4px';
  // switchBtn.style.cursor = 'pointer';
  // switchBtn.style.display = 'flex';
  // switchBtn.style.justifyContent = 'center';
  // switchBtn.style.alignItems = 'center';

  // 建立輸入框
  chatInput = document.createElement('input');
  chatInput.id = 'chatInputId';
  chatInput.name = 'chatInputName';
  chatInput.type = 'text';
  chatInput.placeholder = 'Better start with buttons!!!';
  chatInput.style.flex = '1';
  chatInput.style.borderRadius = '4px';
  chatInput!.setAttribute('autocomplete', 'off');

  chatInput.addEventListener('focus', () => {
    closeSummarizeAnalyzeBtns();
    if (mainStatus !== 'chat') {
      renderChatPage(currentPage);
    }
  });

  // chat log
  // chatLog = document.createElement('div');

  // 建立送出按鈕
  sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.innerText = '>';
  sendBtn.style.width = '40px';
  sendBtn.style.padding = '8px 12px';
  sendBtn.style.border = 'none';
  sendBtn.style.backgroundColor = '#4caf50';
  sendBtn.style.color = '#fff';
  sendBtn.style.borderRadius = '4px';
  sendBtn.style.cursor = 'pointer';
  sendBtn.style.display = 'flex';
  sendBtn.style.justifyContent = 'center';
  sendBtn.style.alignItems = 'center';

  // 把輸入框和按鈕加到表單
  // chatForm.appendChild(switchBtn);
  chatForm.appendChild(chatInput);
  chatForm.appendChild(sendBtn);

  // 把表單加到 body
  content.appendChild(chatForm);

  // 表單送出事件
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = chatInput!.value.trim();
    if (value) {
      showOverlay();
      closeSummarizeAnalyzeBtns();
      disableElements();
      chatInput!.value = '';

      chrome.runtime.sendMessage(
        {
          action: 'send-prompt',
          text: value,
        },
        (apiResponse: {
          success: boolean;
          data: { length: string; reply: string };
        }) => {
          addChatMessage(value, apiResponse.data.reply);
          hideOverlay();
          enableElements();
          mainStatus = 'chat';
        }
      );
    }
  });
  let chatHistory: { user: string; bot: string }[] = [];
  let currentPage = 0;
  // const messagesPerPage = 5; // 每頁顯示幾條對話

  // close the buttons besides Translate button
  function closeSummarizeAnalyzeBtns() {
    toggleButtons.forEach((btn) => {
      if (btn.innerText === 'Translate') return;
      if (btn.dataset.active === 'true') {
        btn.click();
      }
    });
  }

  // 新增訊息時也更新按鈕狀態
  function addChatMessage(userText: string, botText: string) {
    chatHistory.push({ user: userText, bot: botText });
    currentPage = chatHistory.length - 1;
    renderChatPage(currentPage);
    updateNavButtons();
  }

  function renderChatPage(page: number) {
    cleanMain();
    createPrevNextBtn();
    const msg = chatHistory[page];
    if (!msg) return;

    const userMsg = document.createElement('div');
    const userLabel = document.createElement('span');
    userLabel.textContent = 'User: ';
    userLabel.style.fontWeight = 'bold';
    userMsg.appendChild(userLabel);
    userMsg.appendChild(document.createTextNode(msg.user));
    main!.appendChild(userMsg);

    const botMsg = document.createElement('div');
    const botLabel = document.createElement('span');
    botLabel.textContent = 'Bot: ';
    botLabel.style.fontWeight = 'bold';
    botMsg.appendChild(botLabel);
    botMsg.appendChild(document.createTextNode(msg.bot));
    main!.appendChild(botMsg);
  }

  // 更新 disabled 狀態函數
  function updateNavButtons() {
    prevBtn!.disabled = currentPage <= 0;
    nextBtn!.disabled = currentPage >= chatHistory.length - 1;
  }
  /**
   *
   * 製作換頁按鈕
   */
  function createPrevNextBtn() {
    if (controlsDiv) {
      controlsDiv.style.display = 'flex';
    }
    if (controlsDiv && prevBtn && nextBtn) return;
    // 前一則按鈕
    controlsDiv = document.createElement('div');
    controlsDiv.style.display = 'flex';
    controlsDiv.style.justifyContent = 'space-between';
    controlsDiv.style.gap = '4px';
    controlsDiv.style.position = 'absolute';
    controlsDiv.style.right = '16px';
    controlsDiv.style.bottom = '106px';
    controlsDiv.style.padding = '4px';
    controlsDiv.style.zIndex = '999';
    controlsDiv.style.backgroundColor = 'lightgrey';

    prevBtn = document.createElement('button');
    prevBtn.textContent = 'Prev';
    prevBtn.disabled = true; // 初始禁用
    prevBtn.style.zIndex = '999';
    prevBtn.style.fontSize = '16px';
    prevBtn.style.padding = '4px';
    controlsDiv!.appendChild(prevBtn);

    // 下一則按鈕
    nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';

    nextBtn.disabled = true; // 初始禁用
    nextBtn.style.zIndex = '999';
    nextBtn.style.fontSize = '16px';
    nextBtn.style.padding = '4px';
    controlsDiv!.appendChild(nextBtn);

    sidebar?.appendChild(controlsDiv);

    // --- hover 控制 ---
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    // 顯示控制列
    function showControls() {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      controlsDiv!.style.opacity = '1';
    }

    // 隱藏控制列
    function hideControls() {
      controlsDiv!.style.opacity = '0';
    }

    // 進入 main
    main?.addEventListener('mouseenter', () => {
      showControls();
      hideTimer = setTimeout(hideControls, 1000); // 2 秒後自動隱藏
    });

    // 進入 controlsDiv（保持顯示）
    controlsDiv.addEventListener('mouseenter', showControls);

    // 離開 controlsDiv（延遲隱藏）
    controlsDiv.addEventListener('mouseleave', () => {
      hideTimer = setTimeout(hideControls, 200);
    });

    // 前一則
    prevBtn.addEventListener('click', () => {
      if (currentPage > 0) {
        currentPage--;
        renderChatPage(currentPage);
        updateNavButtons();
      }
    });

    // 下一則
    nextBtn.addEventListener('click', () => {
      if (currentPage < chatHistory.length - 1) {
        currentPage++;
        renderChatPage(currentPage);
        updateNavButtons();
      }
    });
  }

  // 建立按鈕
  buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.justifyContent = 'space-between';
  // buttons.style.height = '40px';
  buttons.style.gap = '4px';
  // buttons.style.marginBottom = '4px';

  // 使用範例
  const labels = ['Summarize', 'Translate', 'Vocabulary'];
  const callbacks = [
    (active: boolean) => (active ? summarizeNews : cleanMain),
    (active: boolean) => (active ? translateNews : () => translateNews(true)),
    (active: boolean) => (active ? analyzeNews : cleanMain),
  ];

  toggleButtons = createMutuallyExclusiveToggles(labels, callbacks);

  // 加到頁面
  // const container = document.getElementById('main-controls')!;
  toggleButtons.forEach((btn) => buttons!.appendChild(btn));

  // summarizeBtn = document.createElement('button');
  // summarizeBtn.innerText = 'Summarize';
  // summarizeBtn.style.padding = '4px 6px';
  // summarizeBtn.style.fontSize = '12px';
  // summarizeBtn.style.cursor = 'pointer';
  // summarizeBtn.addEventListener('click', summarizeNews);

  // translateBtn = document.createElement('button');
  // translateBtn.innerText = 'Translate';
  // translateBtn.style.padding = '4px 6px';
  // translateBtn.style.fontSize = '12px';
  // translateBtn.style.cursor = 'pointer';

  // analyzeBtn = document.createElement('button');
  // analyzeBtn.id = 'analyzeBtnContent';
  // analyzeBtn.innerText = 'Analyze Text';
  // analyzeBtn.style.padding = '4px 6px';
  // analyzeBtn.style.fontSize = '12px';
  // analyzeBtn.style.cursor = 'pointer';
  // analyzeBtn.addEventListener('click', analyzeNews);

  // buttons.appendChild(analyzeBtn);
  // buttons.appendChild(summarizeBtn);
  // buttons.appendChild(translateBtn);
  // 插入到容器最前面

  sidebar.appendChild(header);
  content.insertBefore(buttons, chatForm);
  sidebar.appendChild(content);
  document.body.appendChild(sidebar);

  makeDraggable(header, sidebar);

  // Ctrl + J 打開/關閉 sidebar
  window.addEventListener('keydown', closeSidebar);

  function closeSidebar(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      sidebar!.remove();
      window.removeEventListener('keydown', closeSidebar);
    }
  }
}

function createMutuallyExclusiveToggles(
  labels: string[],
  callbacks: ((active: boolean) => (...args: any[]) => any)[]
) {
  const buttons: HTMLButtonElement[] = [];

  labels.forEach((label, idx) => {
    const btn = document.createElement('button');
    btn.id = `${label.toLowerCase()}-toggle`;
    btn.innerText = label;
    btn.style.padding = '4px 6px';
    btn.style.fontSize = '12px';
    btn.style.cursor = 'pointer';

    btn.dataset.active = 'false';

    if (label === 'Vocabulary') {
      chrome.runtime.sendMessage(
        { action: 'get-feature-status' },
        (response) => {
          // 初始 hide
          hideOverlay();
          const featureStatus = response.data.featureStatus;
          if (!featureStatus['language-model'].success) {
            btn.disabled = true;
          }
        }
      );
    }
    btn.addEventListener('click', (event) => {
      const isActive = btn.dataset.active === 'true';

      // Translate 獨立控制
      // 先關掉其他按鈕
      if (btn.innerText !== 'Translate') {
        buttons.forEach((b, i) => {
          if (b !== btn) {
            if (b.innerText === 'Translate') return;
            b.dataset.active = 'false';
            b.style.backgroundColor = '';
            b.style.color = '';
            if (event.isTrusted) {
              callbacks[i](false)(); // 停止其他功能
            }
          }
        });
      }

      // 切換自己
      btn.dataset.active = (!isActive).toString();
      btn.style.backgroundColor = !isActive ? '#4caf50' : '';
      btn.style.color = !isActive ? 'white' : '';
      callbacks[idx](!isActive)();
    });

    buttons.push(btn);
  });

  return buttons;
}

// 只用 header 拖動 sidebar
function makeDraggable(dragHandle: HTMLElement, el: HTMLElement) {
  let posX = 0,
    posY = 0,
    mouseX = 0,
    mouseY = 0;
  dragHandle.onmousedown = dragMouseDown;

  function dragMouseDown(e: MouseEvent) {
    e.preventDefault();
    mouseX = e.clientX;
    mouseY = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e: MouseEvent) {
    e.preventDefault();
    posX = mouseX - e.clientX;
    posY = mouseY - e.clientY;
    mouseX = e.clientX;
    mouseY = e.clientY;
    el.style.top = el.offsetTop - posY + 'px';
    el.style.left = el.offsetLeft - posX + 'px';
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function toggleSidebar(e?: KeyboardEvent) {
  // if (e) {
  //   if (e.key === 'Escape') {
  //     if (sidebar && document.body.contains(sidebar)) {
  //       sidebar.remove();
  //       window.removeEventListener('keydown', toggleSidebar);
  //     }
  //   } else if (e.ctrlKey && e.key.toLowerCase() === 'j') {
  //     if (sidebar && document.body.contains(sidebar)) {
  //       sidebar.remove();
  //       window.removeEventListener('keydown', toggleSidebar);
  //     } else {
  //       createSidebar();
  //       isChatOpen = true;
  //     }
  //   }
  // } else {
  if (sidebar && document.body.contains(sidebar)) {
    sidebar.remove();
    window.removeEventListener('keydown', toggleSidebar);
  } else {
    createSidebar();
    isChatOpen = true;
  }
  // }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'flashcard-added') {
    alert(`已加入單字: ${msg.word}`);
  } else if (msg.action === 'get-text') {
    // 是為了在 popup 更新裡面的 rawNews 取得新聞文字
    let result = '';
    document
      .querySelectorAll('#js-article-body p')
      .forEach((p) => (result += (p as HTMLParagraphElement).innerText + '\n'));
    sendResponse({ text: result });
    rawNews = result; // 儲存原始新聞內容

    return true; // 表示會異步回應
  } else if (msg.action === 'toggle-sidebar') {
    toggleSidebar();
    sendResponse({
      success: true,
      data: {
        isChatOpen,
      },
    });
  } else if (msg.action === 'check-chat') {
    sendResponse({
      success: true,
      data: {
        isChatOpen,
      },
    });
  } else if (msg.action === 'analyze-text-background') {
    const toggleVoc = <HTMLButtonElement>(
      document.getElementById('vocabulary-toggle')
    );
    if (toggleVoc) {
      toggleVoc.disabled = false;
    }
  }

  if (msg.action === 'status') {
    content!.innerHTML = ''; // 清空內容區
    if (msg.status === 'waiting') {
      content!.innerText = '⏳ 分析中...';
      // translateBtn.disabled = true;
      // analyzeBtn.disabled = true;
    } else if (msg.status === 'done') {
      content!.innerText = '✅ 完成！';
      // translateBtn.disabled = false;
      // analyzeBtn.disabled = false;
    } else if (msg.status === 'error') {
      content!.innerText = '❌ 失敗了，請再試一次';
      // translateBtn.disabled = false;
      // analyzeBtn.disabled = false;
    }
  }
});

async function analyzeNews() {
  showOverlay();
  disableElements();
  // 再傳給 background.js 去呼叫 API
  chrome.runtime.sendMessage(
    { action: 'analyze-text', text: rawNews },
    (apiResponse: {
      success: boolean;
      data: {
        analyzation:
          | string
          | {
              english: string;
              chinese?: string;
              japanese: string;
              description?: string;
            }[];
        count: number;
        tsv: string;
      };
    }) => {
      if (typeof apiResponse.data.analyzation === 'string') {
        const div = document.createElement('div');
        div.innerText = apiResponse.data.analyzation;
        main?.appendChild(div);
        return;
      }

      // 先清空舊內容
      cleanMain();

      // 建立 table
      const table = document.createElement('table');
      table.style.borderCollapse = 'collapse';
      table.style.height = '40px';
      // table.innerHTML = `
      //   <tr>
      //     <th style="border:1px solid #ccc; padding:4px;">English</th>
      //     <th style="border:1px solid #ccc; padding:4px;">Japanese</th>
      //     <th style="border:1px solid #ccc; padding:4px;">Description</th>
      //   </tr>
      //     ${apiResponse.data.analyzation
      //       .map(
      //         (w) => `
      //       <tr>
      //         <td style="border:1px solid #ccc; padding:4px;">${w.english}</td>
      //         <td style="border:1px solid #ccc; padding:4px;">${w.japanese}</td>
      //         <td style="border:1px solid #ccc; padding:4px;">${w.description}</td>
      //       </tr>
      //               `
      //       )
      //       .join('')}`;

      table.innerHTML = `
        <tr>
          <th style="border:1px solid #ccc; padding:4px;">English</th>
          <th style="border:1px solid #ccc; padding:4px;">Japanese</th>
        </tr>
        ${apiResponse.data.analyzation
          .map(
            (w) => `
          <tr>
            <td style="border:1px solid #ccc; padding:4px;">${w.english}</td>
            <td style="border:1px solid #ccc; padding:4px;">${w.japanese}</td>
          </tr>
          <tr>
            <td colspan="2" style="border:1px solid #ccc; padding:4px; color:#555;">
              ${w.description}
            </td>
          </tr>
          `
          )
          .join('')}
      `;

      const copyBtn = document.createElement('button');
      copyBtn.innerText = 'Copy Table';
      copyBtn.style.paddingLeft = '4px';
      copyBtn.style.paddingRight = '4px';
      copyBtn.style.margin = '8px 0';
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();

        // Select the table content
        const range = document.createRange();
        range.selectNode(table);
        const selection = window.getSelection();
        selection!.removeAllRanges();
        selection!.addRange(range);

        document.execCommand('copy');
        selection!.removeAllRanges(); // Clear selection after copying
        copyBtn.innerText = 'Copied!';
        const timeout = setTimeout(() => {
          copyBtn.innerText = 'Copy Table';
          clearTimeout(timeout);
        }, 1500);
      });
      // 插入按鈕跟 table
      main!.appendChild(copyBtn);
      main!.appendChild(table);
      if (chatInput) {
        chatInput.placeholder = 'Enter Thoughts...';
      }
      hideOverlay();
      enableElements();
      mainStatus = 'analyze';
      chatInput!.placeholder = 'Enter thoughts...';
      if (controlsDiv) {
        controlsDiv.style.display = 'none';
      }
    }
  );
}

async function summarizeNews() {
  // 再傳給 background.js 去呼叫 API
  showOverlay();
  disableElements();
  chrome.runtime.sendMessage(
    { action: 'summarize-text', text: rawNews },
    (apiResponse: {
      success: boolean;
      data: {
        sum: string;
        count: number;
      };
    }) => {
      // 先清空舊內容
      cleanMain();
      if (!apiResponse.data.sum) {
        const div = document.createElement('div');
        div.innerText = 'Summarizor Error!';
        main?.appendChild(div);
        return;
      }
      const div = document.createElement('div');
      div.innerText = apiResponse.data.sum;
      main?.appendChild(div);
      hideOverlay();
      enableElements();
      mainStatus = 'sum';
      chatInput!.placeholder = 'Enter thoughts...';
      if (controlsDiv) {
        controlsDiv.style.display = 'none';
      }
    }
  );
}

async function translateNews(close = false) {
  if (close) {
    // 移除先前插入的翻譯
    document.querySelectorAll('[id^="jp_news-"]').forEach((el) => el.remove());
  } else {
    const h1 = document.querySelector('.article-title') as HTMLHeadingElement;

    chrome.runtime.sendMessage(
      {
        action: 'translate-text',
        text: h1.innerText,
      },
      (apiResponse: {
        success: boolean;
        data: { length: string; translation: string };
      }) => {
        if (isChatOpen) {
          h1.insertAdjacentHTML(
            'afterend',
            `<div id=jp_news-title>${apiResponse.data.translation}</div>`
          );
        }
      }
    );

    document.querySelectorAll('#js-article-body p').forEach((p, i) =>
      chrome.runtime.sendMessage(
        {
          action: 'translate-text',
          text: (p as HTMLParagraphElement).innerText,
        },
        (apiResponse: {
          success: boolean;
          data: { length: string; translation: string };
        }) => {
          if (isChatOpen) {
            // 在每個 <p> 後面插入翻譯
            p.insertAdjacentHTML(
              'afterend',
              `<div id=jp_news-${i}>${apiResponse.data.translation}</div>`
            );
          }
        }
      )
    );
  }
  return true;
}

const cleanMain = () => {
  Array.from(main!.children).forEach((child) => {
    main!.removeChild(child);
  });
  mainStatus = 'empty';
  if (controlsDiv) {
    controlsDiv.style.display = 'none';
  }
};

function disableElements() {
  chatInput!.disabled = true;
  chatInput!.style.cursor = 'not-allowed';
  sendBtn!.disabled = true;
  sendBtn!.style.cursor = 'not-allowed';
  toggleButtons.forEach((btn) => {
    if (btn.innerText !== 'Translate') {
      btn.disabled = true;
      btn.style.cursor = 'not-allowed';
    }
  });
}

function enableElements() {
  chatInput!.disabled = false;
  chatInput!.style.cursor = 'text';
  sendBtn!.disabled = false;
  sendBtn!.style.cursor = 'pointer';
  toggleButtons.forEach((btn) => {
    if (btn.innerText !== 'Translate') {
      btn.disabled = false;
      btn.style.cursor = 'pointer';
    }
  });
}

function hideOverlay() {
  if (overlay) {
    overlay.style.display = 'none';
  }
}
function showOverlay() {
  if (overlay) {
    overlay.style.display = 'flex';
  }
}
