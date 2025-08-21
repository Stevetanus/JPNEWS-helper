"use strict";
const result = document.getElementById('result');
const analyze = document.getElementById('analyze');
const closeDiv = document.getElementById('close');
closeDiv.addEventListener('click', () => {
    window.close(); // 直接關閉 popup
});
const updateStatusBtn = (document.getElementById('update-status-btn'));
updateStatusBtn.addEventListener('click', async () => {
    try {
        const overlay = document.getElementById('overlay');
        overlay.style.display = 'flex';
        // const status = await fetchFeatureStatus();
        const status = await fetchFeatureStatusViaPort(port);
        const isAllSuccess = Object.values(status).every((feature) => {
            return feature.success;
        });
        if (isAllSuccess) {
            overlay.style.display = 'none';
            instruction.innerHTML = '* Use ctrl + j to open chat';
        }
        console.log('[JPNEWS] Model status:', status);
        // 之後試看看透過其他按鈕去預先取資料
        return;
        // ✅ 這裡就可以拿 status 去做其他操作
        const allReady = Object.values(status).every((f) => f.success);
        if (allReady) {
            await featchBackGroundInfo();
            // chrome.runtime.sendMessage({
            //   action: 'open-chat',
            // });
        }
    }
    catch (err) {
        console.error(err);
    }
});
const chatBtn = document.getElementById('chat-btn');
const instruction = document.getElementById('instruction');
const port = chrome.runtime.connect({ name: 'popup-channel' });
// chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//   chrome.tabs.sendMessage(tabs[0].id!, { action: 'check-chat' }, (response) => {
//     if (chrome.runtime.lastError) {
//       console.log(
//         'Content script not ready or no sidebar:',
//         chrome.runtime.lastError
//       );
//       return;
//     }
//   });
// });
async function fetchFeatureStatusViaPort(port) {
    return new Promise((resolve, reject) => {
        const listener = (response) => {
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
    // const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const getTextFromContent = () => new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'get-text' }, (response) => {
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
/**
 *
 * @param port connect backend with port
 * @param rawNews news text from content
 */
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
        const [translation, summary, analysis] = await Promise.all([
            sendPortMessage('translate-text', rawNews),
            sendPortMessage('summarize-text', rawNews),
            sendPortMessage('analyze-text', rawNews),
        ]);
        // const [translation, summary] = await Promise.all([
        //   sendPortMessage('translate-text', rawNews),
        //   sendPortMessage('summarize-text', rawNews),
        //   // sendPortMessage('analyze-text', rawNews),
        // ]);
        // try analyzing in background
        // sendPortMessage('analyze-text', rawNews);
        console.log('lucky lucky');
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
