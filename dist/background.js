"use strict";
const featureStatus = {
    summarizer: {
        success: false,
        message: 'Summarizer not initialized',
    },
    translator: {
        success: false,
        message: 'Translator not initialized',
    },
    'language-model': {
        success: false,
        message: 'LanguageModel not initialized',
    },
};
/** Language Model session */
let session_l;
/** Translator session for Japnanese to English */
let session_t_jp_en;
/** Summarizer session  */
let session_s;
/** Page Id get from NHK News Easy url */
let pageId = '';
chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'toggle-sidebar') {
        console.log('[JPNEWS] Processing toggle-sidebar command');
        // Check if tab is ready
        if (tab.status !== 'complete') {
            console.warn('[JPNEWS] Tab is not ready, status:', tab.status);
        }
        // Send a message to the content script in the active tab
        chrome.tabs
            .sendMessage(tab.id, { action: 'toggle-sidebar' })
            .then((response) => {
            console.log('[JPNEWS] Message sent successfully, response:', response);
        })
            .catch((error) => {
            console.error('[JPNEWS] Error sending message:', error);
        });
    }
});
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'add-flashcard',
        title: '加入 Flashcard',
        contexts: ['selection'], // 只在選字時出現
    });
    initializeLanguageModel()
        .then(() => { })
        .catch((error) => {
        console.error('Error initializing LanguageModel:', error);
    });
    initializeTranslator()
        .then(() => { })
        .catch((error) => {
        console.error('Error initializing Translator:', error);
    });
    initializeSummarizer()
        .then(() => { })
        .catch((error) => {
        console.error('Error initializing Summarizer:', error);
    });
});
// 右鍵選單先不用
// chrome.contextMenus.onClicked.addListener((info, tab) => {
//   if (info.menuItemId === 'add-flashcard' && info.selectionText) {
//     const word = info.selectionText.trim();
//     // 存到 chrome.storage
//     chrome.storage.sync.get({ flashcards: [] }, ({ flashcards }) => {
//       flashcards.push({ word, addedAt: Date.now() });
//       chrome.storage.sync.set({ flashcards }, () => {
//         console.log('[Flashcard] Saved word via context menu:', word);
//       });
//     });
//     // 可選：傳給 content script 做 UI 提示
//     if (tab?.id) {
//       chrome.tabs.sendMessage(tab.id, { action: 'flashcard-added', word });
//     }
//   }
// });
chrome.runtime.onConnect.addListener((port) => {
    console.log('[JPNEWS] Port connected:', port.name);
    if (port.name === 'popup-channel') {
        port.onMessage.addListener(async (msg) => {
            const { action, text } = msg;
            if (action === 'translate-text') {
                (async () => {
                    try {
                        const translation = await translateText(text);
                        const res = {
                            action,
                            success: true,
                            data: {
                                translation,
                                length: text.length.toString(),
                            },
                        };
                        // 如果 popuup 的 port 還在，才送訊息
                        try {
                            port.postMessage(res);
                        }
                        catch (e) {
                            console.warn('Port disconnected, cannot send:', e);
                        }
                    }
                    catch (err) {
                        port.postMessage({
                            action,
                            success: false,
                            data: {
                                translation: 'Translation failed',
                                length: '0',
                            },
                        });
                    }
                })();
                return true;
            }
            if (action === 'analyze-text') {
                (async () => {
                    try {
                        const raw = await analyzeText(text);
                        await setToStorage('raw', { raw, savedAt: Date.now() });
                        let words = [];
                        try {
                            words = safeParseModelJson(raw);
                        }
                        catch (err) {
                            console.error('Failed to parse JSON:', err);
                        }
                        // 如果 port 還在，才送訊息
                        try {
                            port.postMessage({
                                action,
                                success: true,
                                data: { analyzation: words, count: words.length },
                            });
                        }
                        catch (e) {
                            chrome.runtime.sendMessage({ action: 'analyze-text-background' });
                            console.warn('Port disconnected, cannot send:', e);
                        }
                    }
                    catch (err) {
                        port.postMessage({
                            action,
                            success: false,
                            data: { analyzation: 'Analyzation failed', count: 0 },
                        });
                    }
                })();
                return true;
            }
            if (action === 'summarize-text') {
                (async () => {
                    try {
                        const sum = await summarizeText(text);
                        await setToStorage('sum', { sum, saveAt: Date.now() });
                        port.postMessage({
                            action,
                            success: true,
                            data: { sum, count: sum.length },
                        });
                    }
                    catch (err) {
                        port.postMessage({
                            action,
                            success: false,
                            data: { sum: 'Summarization failed', count: 0 },
                        });
                    }
                })();
                return true;
            }
            if (action === 'get-feature-status') {
                port.postMessage({
                    action,
                    success: true,
                    data: { featureStatus },
                });
                return true;
            }
        });
    }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action, text } = message;
    const handleError = (err, fallbackData, status = 'error') => {
        console.error(`[JPNEWS] Error during ${action}:`, err);
        sendResponse({
            success: false,
            data: fallbackData,
        });
        // chrome.runtime.sendMessage({ action: 'status', status });
    };
    if (action === 'translate-text') {
        (async () => {
            try {
                const translation = await translateText(text);
                const res = {
                    success: true,
                    data: {
                        translation,
                        length: text.length.toString(),
                    },
                };
                console.log('[JPNEWS] Translation result:', res);
                sendResponse(res);
            }
            catch (err) {
                handleError(err, { translation: 'Translation failed', length: '0' });
            }
        })();
        return true;
    }
    if (action === 'analyze-text') {
        (async () => {
            // chrome.runtime.sendMessage({ action: 'status', status: 'waiting' });
            try {
                const raw = await analyzeText(text);
                await setToStorage('raw', { raw, saveAt: Date.now() });
                let words = [];
                try {
                    words = safeParseModelJson(raw);
                }
                catch (err) {
                    console.error('Failed to parse JSON:', err);
                }
                console.log('[JPNEWS] Vocabulary result:', { words });
                sendResponse({
                    success: true,
                    data: { analyzation: words, count: words.length },
                });
                // chrome.runtime.sendMessage({ action: 'status', status: 'done' });
            }
            catch (err) {
                handleError(err, { analyzation: 'Analyzation failed', count: 0 });
            }
        })();
        return true;
    }
    if (action === 'summarize-text') {
        (async () => {
            try {
                const sum = await summarizeText(text);
                await setToStorage('sum', { sum, savedAt: Date.now() });
                console.log('[JPNEWS] Summarizer result:', { sum });
                sendResponse({
                    success: true,
                    data: { sum, count: sum.length },
                });
            }
            catch (err) {
                handleError(err, { sum: 'Summarization failed', count: 0 });
            }
        })();
        return true;
    }
    if (action === 'get-feature-status') {
        sendResponse({
            success: true,
            data: { featureStatus },
        });
    }
    if (action === 'nhk-news-page') {
        pageId = message.pageId;
        sendResponse({ success: true });
    }
    if (action === 'send-prompt') {
        (async () => {
            try {
                const reply = await promptLanguageModel(text);
                sendResponse({
                    success: true,
                    data: { reply, count: reply.length },
                });
            }
            catch (err) {
                handleError(err, { reply: '500', count: 0 });
            }
        })();
        return true;
    }
});
/** get value from extension storage local */
async function getFromStorage(key) {
    const ki = `${pageId}-${key}`;
    return new Promise((resolve) => {
        chrome.storage.local.get(ki, (res) => {
            if (res[ki]) {
                resolve(res[ki]); // 回傳值
            }
            else {
                resolve(null); // 沒有的話回 null
            }
        });
    });
}
/** set value to extension storage local */
async function setToStorage(key, value) {
    const ki = `${pageId}-${key}`;
    return new Promise((resolve) => {
        chrome.storage.local.set({ [ki]: value }, () => {
            resolve();
        });
    });
}
async function summarizeText(text) {
    let sumStorage = await getFromStorage('sum');
    if (sumStorage) {
        return sumStorage.sum;
    }
    const response = await session_s.summarize(text);
    return response;
    // 未來再處理看看 stream
    // const stream = await session_s.summarizeStreaming(text);
    // return stream;
}
async function translateText(text) {
    const result = await session_t_jp_en.translate(text);
    return result;
}
async function analyzeText(text) {
    const rawStorage = await getFromStorage('raw');
    if (rawStorage) {
        return rawStorage.raw;
    }
    const schema = {
        type: 'array',
        minItems: 10,
        maxItems: 10,
        items: {
            type: 'object',
            properties: {
                english: { type: 'string' },
                japanese: { type: 'string' },
                description: { type: 'string' },
            },
            // required: ['english', 'chinese', 'japanese'],
            required: ['english', 'japanese', 'description'],
            additionalProperties: false,
        },
    };
    const response = await session_l.prompt(`Analyze the following text and return exactly 10 important words in different language and also the description of the words in English.
    - English: The word in English
    - Japanese: The word in Japanese with hiragana
    - Description: The description of the word in English
  Example: [{ "english": "Japan", "japanese": "日本 (にほん)", "description": "A country in East Asia" }, ...]

  Text:
  ${text}`, {
        responseConstraint: schema,
    });
    return response;
}
// 儲存訊息
async function saveChatMessage(msg) {
    const ki = `${pageId}-chat`;
    const chatLog = (await getFromStorage('chat')) || [];
    chatLog.push(msg);
    await setToStorage('chat', chatLog);
}
// 讀取聊天歷史
function getChatLog() {
    return new Promise((resolve) => {
        const ki = `${pageId}-chat`;
        chrome.storage.local.get(ki, (res) => {
            resolve(res[ki] || []);
        });
    });
}
async function promptLanguageModel(text) {
    // 1️⃣ 取得歷史聊天紀錄
    let chatLog = (await getFromStorage('chat')) || [];
    let sumStorge = await getFromStorage('sum');
    let rawStorage = await getFromStorage('raw');
    let sum = sumStorge ? sumStorge.sum : '';
    let raw = rawStorage ? rawStorage.raw : '';
    let words = safeParseModelJson(raw);
    let englishVocabulary = '';
    let japaneseVocabulary = '';
    words.forEach((wordArr, i) => {
        if (i) {
            englishVocabulary += `, ${wordArr.english}`;
            japaneseVocabulary += `, ${wordArr.japanese}`;
        }
        else {
            englishVocabulary += wordArr.english;
            japaneseVocabulary += wordArr.japanese;
        }
    });
    let finalPrompt = '';
    if (!sum && !words.length) {
        // 沒有背景或單字，先給簡單提示
        finalPrompt = `
    You are a Japanese learning assistant. Currently, you don't have the news summary or vocabulary.
    Please reply briefly: tell the user to press the **Summarize** button or **Vocabulary** button first.
    Keep your answer short and friendly.

    User: ${text}
    AI:
  `;
    }
    else {
        // 2️⃣ 將聊天紀錄轉成文字 prompt
        let context = chatLog
            .map((msg) => {
            if (msg.user === 'me')
                return `User: ${msg.text}`;
            else
                return `AI: ${msg.text}`;
        })
            .join('\n');
        let backgroundPrompt = sum
            ? `Background about the news: ${sum}.`
            : `No background about the news. Recommend user to press **Summarize** button.`;
        let wordsPrompt = words.length
            ? `Words system know in English: ${englishVocabulary}. Words system know in Japanese: ${japaneseVocabulary}.`
            : `No background about the vocabulary in the news. Recommend users to press **Vocabulary** button.`;
        // 3️⃣ 加上新的使用者訊息
        finalPrompt = `
    You are a Japanese learning assistant who read through the news now. ${backgroundPrompt} ${wordsPrompt} Based on background and previous vocabulary you given, **generate a natural answer to the user's question**. If the user prompt is too away from the topic of the news, just answer a little bit. If the user asks a normal question, answer briefly in 3 to 5 sentences,
and make sure the answer is not longer than the user's question. You always answer in English and teach at least 1 Japanese word in the reply. At the end of your response, include a short and dirverse encouraging phrase in Japanese with English translation.

    Conversation history:
    ${context}

    User: ${text}
    AI:
    `;
    }
    // 4️⃣ 呼叫語言模型
    const response = (await session_l.prompt(finalPrompt.trim())).trim();
    // 5️⃣ 儲存新的訊息到 chatLog
    const userMsg = { user: 'me', text, timestamp: Date.now() };
    const aiMsg = {
        user: 'ai',
        text: response,
        timestamp: Date.now(),
    };
    await saveChatMessage(userMsg);
    await saveChatMessage(aiMsg);
    return response;
}
// Summarizer API
async function initializeSummarizer() {
    if (typeof Summarizer === 'undefined') {
        notifyPopup('summarizer', false, 'Summarizer not available');
        console.warn('LanguageModel API not available in this context.');
        return;
    }
    const availability = await Summarizer.availability();
    if (availability !== 'available') {
        notifyPopup('summarizer', false, 'Summarizer not ready (downloading...)');
    }
    try {
        // Proceed to request batch or streaming summarization
        const options = {
            sharedContext: 'This is a news from NHK News',
            type: 'teaser',
            format: 'plain-text',
            length: 'medium',
            monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                    console.log(`[JPNEWS] Summarizer Downloaded ${e.loaded * 100}%`);
                });
            },
        };
        session_s = await Summarizer.create(options);
        notifyPopup('summarizer', true, 'Summarizer initialized successfully');
        console.log('[JPNEWS] Summarizer session created:', session_s);
    }
    catch {
        notifyPopup('summarizer', false, 'Error creating summarizer session');
    }
}
async function initializeTranslator() {
    if (typeof Translator === 'undefined') {
        notifyPopup('translator', false, 'Translator not available');
        console.warn('Translator API not available in this context.');
        return;
    }
    const availability = await Translator.availability({
        sourceLanguage: 'ja',
        targetLanguage: 'en',
    });
    if (availability !== 'available') {
        notifyPopup('translator', false, 'Translator not ready (downloading...)');
    }
    try {
        session_t_jp_en = await Translator.create({
            sourceLanguage: 'ja',
            targetLanguage: 'en',
            monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                    const percent = (e.loaded * 100).toFixed(1);
                    console.log(`[JPNEWS] Translator Downloaded ${percent}%`);
                    if (e.loaded === 1) {
                    }
                });
            },
        });
        console.log('[JPNEWs] Translator session created:', session_t_jp_en);
        notifyPopup('translator', true, 'Translator initialized successfully');
    }
    catch {
        notifyPopup('translator', false, 'Error creating Translator session');
    }
}
async function initializeLanguageModel() {
    if (typeof LanguageModel === 'undefined') {
        notifyPopup('language-model', false, 'LanguageModel not available');
        console.warn('LanguageModel API not available in this context.');
        return;
    }
    const availability = await LanguageModel.availability();
    if (availability !== 'available') {
        notifyPopup('language-model', false, 'LanguageModel not ready, downlaoding...');
    }
    try {
        session_l = await LanguageModel.create({
            initialPrompts: [
                {
                    role: 'system',
                    content: 'You are a vocabulary extraction assistant give back the words in English, Chinese and Japanese. Also, you give back the detail descripiton of the words in English.',
                },
            ],
            monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                    const percent = (e.loaded * 100).toFixed(1);
                    console.log(`[JPNEWS] Language Model Downloaded ${percent}%`);
                    if (e.loaded === 1) {
                        console.log('[JPNEWs] Language Model fully downloaded. Ready to use!');
                    }
                });
            },
        });
        console.log('[JPNEWS] Language model session created:', session_l);
        notifyPopup('language-model', true, 'LanguageModel initialized successfully');
    }
    catch {
        notifyPopup('language-model', false, 'Error creating LanguageModel session');
    }
}
/**
 * Notify the popup about the status of a feature.
 * @param feature The feature to notify about (summarizer, translator, language-model).
 * @param success Whether the feature is successfully initialized.
 * @param message A message to display in the popup.
 */
function notifyPopup(feature, success, message) {
    featureStatus[feature] = {
        success,
        message,
    };
}
function safeParseModelJson(raw) {
    try {
        // 去掉 ```json``` 或其他多餘字符
        const cleaned = raw.replace(/```json|```/g, '').trim();
        return JSON.parse(cleaned);
    }
    catch (e) {
        console.warn('Parsing failed, returning empty array', { raw });
        return [];
    }
}
// Log when service worker starts
console.log('[JPNEWS] ===== BACKGROUND SCRIPT LOADED =====');
console.log('[JPNEWS] Background script loaded at:', new Date().toISOString());
console.log('[JPNEWS] Chrome version:', navigator.userAgent);
// Check commands on startup
chrome.commands.getAll((commands) => {
    console.log('[JPNEWS] Commands available on startup:', commands);
});
