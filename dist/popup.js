"use strict";
console.log('Hello, I am popup!');
const result = document.getElementById('result');
const analyze = document.getElementById('analyze');
const closeDiv = document.getElementById('close');
closeDiv.addEventListener('click', () => {
    window.close(); // 直接關閉 popup
});
const updateStatusBtn = (document.getElementById('update-status-btn'));
updateStatusBtn.addEventListener('click', async () => {
    try {
        // const status = await fetchFeatureStatus();
        const status = await fetchFeatureStatusViaPort(port);
        console.log('最新狀態:', status);
        // ✅ 這裡就可以拿 status 去做其他操作
        const allReady = Object.values(status).every((f) => f.success);
        if (allReady) {
            await featchBackGroundInfo();
        }
    }
    catch (err) {
        console.error(err);
    }
});
// const translateBtn = <HTMLButtonElement>(
//   document.getElementById('translator-btn')
// );
// translateBtn.addEventListener('click', translateNews);
const chatBtn = document.getElementById('chat-btn');
const instruction = document.getElementById('instruction');
const port = chrome.runtime.connect({ name: 'popup-channel' });
chrome.runtime.onMessage.addListener((msg) => {
    // console.log({ msg });
    // if (msg.action === 'status') {
    //   const statusEl = document.getElementById('status');
    //   if (!statusEl) return;
    //   if (msg.status === 'waiting') {
    //     statusEl.innerText = '⏳ 分析中...';
    //     translateBtn.disabled = true;
    //     // analyzeBtn.disabled = true;
    //   } else if (msg.status === 'done') {
    //     statusEl.innerText = '✅ 完成！';
    //     translateBtn.disabled = false;
    //     // analyzeBtn.disabled = false;
    //   } else if (msg.status === 'error') {
    //     statusEl.innerText = '❌ 失敗了，請再試一次';
    //     translateBtn.disabled = false;
    //     // analyzeBtn.disabled = false;
    //   }
    // }
});
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'check-chat' }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('Content script not ready or no sidebar:', chrome.runtime.lastError);
            return;
        }
        // chatBtn.innerText = response.isChatOpen ? 'Close Chat' : 'Open Chat';
    });
});
// 取得 Translator, LanguageModel, Summarizor 的狀態
// async function fetchFeatureStatus(): Promise<
//   Record<string, { success: boolean; message: string }>
// > {
//   return new Promise((resolve, reject) => {
//     chrome.runtime.sendMessage(
//       { action: 'get-feature-status' },
//       (response: {
//         success: boolean;
//         data: {
//           featureStatus: Record<string, { success: boolean; message: string }>;
//         };
//       }) => {
//         console.log('Got initial status:', response);
//         const featureStatus = response.data.featureStatus;
//         Object.entries(featureStatus).forEach(([k, v]) => {
//           const feature = k.replace('-status', '');
//           console.log({ feature });
//           const statusEl = document.getElementById(`${feature}-status`);
//           const btnEl = document.getElementById(
//             `${feature}-btn`
//           ) as HTMLButtonElement;
//           if (v.success) {
//             statusEl!.textContent = `✅ ${feature} ready`;
//             btnEl.disabled = false;
//           } else {
//             statusEl!.textContent = `❌ ${v.message}`;
//             btnEl.disabled = true;
//           }
//         });
//         // 回傳資料
//         resolve(featureStatus);
//       }
//     );
//   });
// }
async function fetchFeatureStatusViaPort(port) {
    return new Promise((resolve, reject) => {
        const listener = (response) => {
            console.log('Got initial status via port:', response);
            const featureStatus = response.data.featureStatus;
            Object.entries(featureStatus).forEach(([k, v]) => {
                const feature = k.replace('-status', '');
                const statusEl = document.getElementById(`${feature}-status`);
                const btnEl = document.getElementById(`${feature}-btn`);
                if (v.success) {
                    statusEl.textContent = `✅ ${feature} ready`;
                    btnEl.disabled = false;
                }
                else {
                    statusEl.textContent = `❌ ${v.message}`;
                    btnEl.disabled = true;
                }
            });
            resolve(featureStatus);
            port.onMessage.removeListener(listener); // 移除 listener 避免累積
        };
        port.onMessage.addListener(listener);
        port.postMessage({ action: 'get-feature-status' });
    });
}
async function featchBackGroundInfo() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const getTextFromContent = () => new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'get-text' }, (response) => {
            if (chrome.runtime.lastError)
                return reject(chrome.runtime.lastError);
            resolve(response.text);
        });
    });
    try {
        const rawNews = await getTextFromContent();
        // await analyzeAll(rawNews); // 等待全部 API 都完成
        await analyzeAllViaPort(port, rawNews); // 等待全部 API 都完成
    }
    catch (err) {
        console.error('Error fetching background info:', err);
    }
}
async function analyzeAllViaPort(port, rawNews) {
    const main = document.getElementById('main');
    // main.style.display = 'none'; // 先隱藏結果
    document.body.classList.add('loading');
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'flex';
    // 用 port 包成 Promise
    const sendPortMessage = (action, text) => {
        return new Promise((resolve, reject) => {
            const listener = (msg) => {
                if (msg.action === action) {
                    port.onMessage.removeListener(listener);
                    if (msg.success) {
                        resolve(msg.data);
                    }
                    else {
                        reject(msg.data);
                    }
                }
            };
            port.onMessage.addListener(listener);
            port.postMessage({ action, text });
        });
    };
    try {
        // const [translation, summary, analysis] = await Promise.all([
        const [translation, summary] = await Promise.all([
            sendPortMessage('translate-text', rawNews),
            sendPortMessage('summarize-text', rawNews),
            // sendPortMessage('analyze-text', rawNews),
        ]);
        // try analyzing in background
        sendPortMessage('analyze-text', rawNews);
        console.log('lucky lucky');
        console.log('Translate:', translation);
        console.log('Summarize:', summary);
        // 全部完成後顯示結果
        // main.style.display = 'block';
        overlay.style.display = 'none';
        instruction.innerHTML = '* Use ctrl + j to open chat';
        document.body.classList.remove('loading'); // 可以把結果放到 UI
    }
    catch (err) {
        console.error('Error during analyzing all via port:', err);
    }
}
// async function analyzeAll(rawNews: string) {
//   const main = document.getElementById('main')!;
//   main.style.display = 'none'; // 先隱藏結果
//   // 封裝 sendMessage 成 Promise
//   const sendMessageAsync = (action: string, text: string) => {
//     return new Promise<any>((resolve, reject) => {
//       chrome.runtime.sendMessage({ action, text }, (response) => {
//         if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
//         resolve(response);
//       });
//     });
//   };
//   try {
//     const [translateRes, summarizeRes, analyzeRes] = await Promise.all([
//       sendMessageAsync('translate-text', rawNews),
//       sendMessageAsync('summarize-text', rawNews),
//       sendMessageAsync('analyze-text', rawNews),
//     ]);
//     console.log('Translate:', translateRes);
//     console.log('Summarize:', summarizeRes);
//     console.log('Analyze:', analyzeRes);
//     // 全部完成後顯示結果
//     main.style.display = 'block';
//     // 你可以把結果放進各自的 UI 區域
//   } catch (err) {
//     console.error('Error during analyzing all:', err);
//   }
// }
// 發訊息給 content 再發訊息給 background 去呼叫 API
// async function translateNews() {
//   // const rawNews = await updateRawNews();
//   // 先取得目前 active tab
//   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//   // 發訊息給 content.js
//   chrome.tabs.sendMessage(
//     tab.id!,
//     { action: 'get-text' },
//     (response: { text: string }) => {
//       if (chrome.runtime.lastError) {
//         console.error(chrome.runtime.lastError);
//         return;
//       }
//       // 拿到 content.js 傳回來的文字
//       let rawNews = response.text;
//       // 再傳給 background.js 去呼叫 API
//       chrome.runtime.sendMessage(
//         { action: 'translate-text', text: rawNews },
//         (apiResponse: {
//           success: boolean;
//           data: { length: string; translation: string };
//         }) => {
//           console.log('API 回應:', { apiResponse });
//           result!.innerText = apiResponse.data.translation;
//         }
//       );
//     }
//   );
// }
// async function updateRawNews() {
//   if (!rawNews) {
//     console.log('[JPNEWS] Updating raw news text...');
//     // 先取得目前 active tab
//     const [tab] = await chrome.tabs.query({
//       active: true,
//       currentWindow: true,
//     });
//     chrome.tabs.sendMessage(
//       tab.id!,
//       { action: 'get-text' },
//       (response: { text: string }) => {
//         if (chrome.runtime.lastError) {
//           console.error(chrome.runtime.lastError);
//           return;
//         }
//         // 拿到 content.js 傳回來的文字
//         rawNews = response.text;
//         console.log('[JPNEWS] Inner Raw news text updated:', rawNews);
//       }
//     );
//   }
//   console.log('[JPNEWS] Raw news text updated:', rawNews);
//   return rawNews;
// }
// async function analyzeNews() {
//   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//   // 發訊息給 content.js
//   chrome.tabs.sendMessage(
//     tab.id!,
//     { action: 'get-text' },
//     (response: { text: string }) => {
//       if (chrome.runtime.lastError) {
//         console.error(chrome.runtime.lastError);
//         return;
//       }
//       // 拿到 content.js 傳回來的文字
//       rawNews = response.text;
//       // 再傳給 background.js 去呼叫 API
//       chrome.runtime.sendMessage(
//         { action: 'analyze-text', text: rawNews },
//         (apiResponse: {
//           success: boolean;
//           data: {
//             analyzation:
//               | string
//               | {
//                   english: string;
//                   chinese?: string;
//                   japanese: string;
//                   description?: string;
//                 }[];
//             count: number;
//             tsv: string;
//           };
//         }) => {
//           console.log('API 回應:', { apiResponse });
//           if (typeof apiResponse.data.analyzation === 'string') {
//             analyze!.innerText = apiResponse.data.analyzation;
//             return;
//           }
//           // 先清空舊內容
//           analyze!.innerHTML = '';
//           // 建立 table
//           const table = document.createElement('table');
//           table.style.borderCollapse = 'collapse';
//           table.style.width = '100%';
//           table.innerHTML = `
//         <tr>
//           <th style="border:1px solid #ccc; padding:4px;">English</th>
//           <th style="border:1px solid #ccc; padding:4px;">Japanese</th>
//           <th style="border:1px solid #ccc; padding:4px;">Description</th>
//         </tr>
//           ${apiResponse.data.analyzation
//             .map(
//               (w) => `
//             <tr>
//               <td style="border:1px solid #ccc; padding:4px;">${w.english}</td>
//               <td style="border:1px solid #ccc; padding:4px;">${w.japanese}</td>
//               <td style="border:1px solid #ccc; padding:4px;">${w.description}</td>
//             </tr>
//                     `
//             )
//             .join('')}`;
//           const copyBtn = document.createElement('button');
//           copyBtn.innerText = 'Copy Table';
//           copyBtn.style.margin = '8px 0';
//           copyBtn.addEventListener('click', (e) => {
//             e.preventDefault();
//             // Select the table content
//             const range = document.createRange();
//             range.selectNode(table);
//             const selection = window.getSelection();
//             selection!.removeAllRanges();
//             selection!.addRange(range);
//             document.execCommand('copy');
//             selection!.removeAllRanges(); // Clear selection after copying
//             copyBtn.innerText = 'Copied!';
//             const timeout = setTimeout(() => {
//               copyBtn.innerText = 'Copy Table';
//               clearTimeout(timeout);
//             }, 1500);
//           });
//           // 插入按鈕跟 table
//           analyze!.appendChild(copyBtn);
//           analyze!.appendChild(table);
//         }
//       );
//     }
//   );
// }
