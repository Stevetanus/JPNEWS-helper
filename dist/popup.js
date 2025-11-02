"use strict";
const closeDiv = document.getElementById('close');
closeDiv.addEventListener('click', () => {
    window.close(); // 直接關閉 popup
});
const updateStatusBtn = (document.getElementById('update-status-btn'));
updateStatusBtn.addEventListener('click', async () => {
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'flex';
    try {
        console.log('start fetching feature status...');
        const featureStatus = await fetchFeatureStatusViaPort(port);
        await setFeatureStatus(featureStatus);
        console.log('[JPNEWS] Feature status:', featureStatus);
        // 更新 UI
        updateUI(featureStatus);
        // 之後可以在這裡做額外操作，例如 open-chat
        // if (isAllSuccess) {
        //   chrome.runtime.sendMessage({ action: 'open-chat' });
        // }
    }
    catch (err) {
        console.error(err);
    }
    finally {
        overlay.style.display = 'none';
    }
});
const languageSelect = document.getElementById('language-select');
languageSelect.addEventListener('change', async (event) => {
    const target = event.target;
    const selectedLang = target.value;
    chrome.storage.local.set({ translatorLanguage: selectedLang });
    // 如果側邊欄是開啟的，則關閉它
    const isSidebarOpen = await getSidebarOpen();
    if (isSidebarOpen) {
        port.postMessage({ action: 'toggle-sidebar' });
        const chatBtn = document.getElementById('chat-btn');
        chatBtn.textContent = 'Open Chat';
    }
});
(async () => {
    const resF = await chrome.storage.session.get('featureStatus');
    const resT = await chrome.storage.local.get('translatorLanguage');
    if (resF.featureStatus) {
        updateUI(resF.featureStatus);
    }
    if (resT.translatorLanguage) {
        languageSelect.value = resT.translatorLanguage;
    }
})();
const port = chrome.runtime.connect({ name: 'popup-channel' });
port.onMessage.addListener((msg) => {
    if (msg.action.startsWith('download_progress_')) {
        const feature = msg.action.replace('download_progress_', '');
        const percent = msg.data.percent;
        // TODO:動態更新 UI，待想方法測試
        const el = document.getElementById(`${feature}-status`);
        if (el && !el?.textContent) {
            el.textContent = `${feature}: ${percent}%`;
        }
    }
});
// sidebar 狀態檢查
(async () => {
    const isSidebarOpen = await getSidebarOpen();
    if (isSidebarOpen) {
        const chatBtn = document.getElementById('chat-btn');
        chatBtn.textContent = 'Close Chat';
    }
})();
const chatBtn = document.getElementById('chat-btn');
chatBtn.addEventListener('click', async () => {
    port.postMessage({ action: 'toggle-sidebar' });
    window.close();
});
const instruction = document.getElementById('instruction');
function updateUI(featureStatus) {
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
    const chatBtn = document.getElementById('chat-btn');
    const instruction = document.getElementById('instruction');
    // 判斷是否全部成功
    const isAllSuccess = Object.values(featureStatus).every((f) => f.success);
    if (isAllSuccess) {
        chatBtn.style.display = 'block';
        instruction.innerHTML = '* Use ctrl + j to open chat';
    }
    else {
        chatBtn.style.display = 'none';
        instruction.innerHTML = '* Check model status';
    }
}
async function getSidebarOpen() {
    const tab = await getActiveTab();
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'check-sidebar' }, (response) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            const isSidebarOpen = response?.data?.isSidebarOpen;
            resolve(isSidebarOpen);
        });
    });
}
async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}
async function setFeatureStatus(featureStatus) {
    chrome.storage.session.set({ featureStatus }, () => {
        console.log('[JPNEWS] featureStatus saved:', featureStatus);
    });
}
async function fetchFeatureStatusViaPort(port) {
    return new Promise((resolve, reject) => {
        const listener = (response) => {
            const featureStatus = response.data.featureStatus;
            resolve(featureStatus);
            port.onMessage.removeListener(listener); // 移除 listener 避免累積
        };
        port.onMessage.addListener(listener);
        port.postMessage({ action: 'get-feature-status' });
    });
}
// below functions are not used currently, but might be useful in the future
async function featchBackGroundInfo() {
    const getTextFromContent = () => new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'get-text' }, (response) => {
            if (chrome.runtime.lastError)
                return reject(chrome.runtime.lastError);
            resolve(response.text);
        });
    });
    try {
        const rawNews = await getTextFromContent();
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
