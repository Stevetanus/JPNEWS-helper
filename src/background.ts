console.log('Hello for background!');
declare const LanguageModel: any;
declare const Translator: any;
declare const Summarizer: any;
const featureStatus: Record<string, { success: boolean; message: string }> = {};
let session_l: any;
let session_t_jp_en: any;
let session_s: any;
let pageId = '';

chrome.tabs.onUpdated.addListener((tabId, tab) => {
  console.log('Tab updated:', { tabId }, { tab });
  if (tab.status === 'complete') {
    // chrome.runtime.sendMessage({ action: 'get-url' }, (apiResponse) => {
    //   const url = apiResponse.data.url;
    //   if (url && url.includes('https://www3.nhk.or.jp/news/easy/')) {
    //     const splitList = url.split('/');
    //     const lastSegment = splitList[splitList.length - 1];
    //     console.log('Last segment of URL:', lastSegment);
    //     if (lastSegment.includes('.html')) {
    //       pageId = lastSegment.replace('.html', '');
    //     }
    //   }
    // });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-flashcard',
    title: '加入 Flashcard',
    contexts: ['selection'], // 只在選字時出現
  });
  initializeLanguageModel()
    .then(() => {
      console.log('LanguageModel initialized successfully');
    })
    .catch((error: any) => {
      console.error('Error initializing LanguageModel:', error);
    });
  initializeTranslator()
    .then(() => {
      console.log('Translator initialized successfully');
    })
    .catch((error: any) => {
      console.error('Error initializing Translator:', error);
    });
  initializeSummarizer()
    .then(() => {
      console.log('Summarizer initialized successfully');
    })
    .catch((error: any) => {
      console.error('Error initializing Summarizer:', error);
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-flashcard' && info.selectionText) {
    const word = info.selectionText.trim();

    // 存到 chrome.storage
    chrome.storage.sync.get({ flashcards: [] }, ({ flashcards }) => {
      flashcards.push({ word, addedAt: Date.now() });
      chrome.storage.sync.set({ flashcards }, () => {
        console.log('[Flashcard] Saved word via context menu:', word);
      });
    });

    // 可選：傳給 content script 做 UI 提示
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'flashcard-added', word });
    }
  }
});

chrome.runtime.onConnect.addListener((port) => {
  console.log('Port connected:', port.name);

  if (port.name === 'popup-channel') {
    port.onMessage.addListener(async (msg) => {
      const { action, text } = msg;
      if (action === 'translate-text') {
        (async () => {
          try {
            console.log('[JPNEWS] Translating text:', text);
            const translation = await translateText(text);

            const res = {
              action,
              success: true,
              data: {
                translation,
                length: text.length.toString(),
              },
            };

            console.log('[JPNEWS] Translation result:', res);
            // 如果 port 還在，才送訊息
            try {
              port.postMessage(res);
            } catch (e) {
              console.warn('Port disconnected, cannot send:', e);
            }
          } catch (err) {
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
            const storageKey = `${pageId}-raw`;
            chrome.storage.local.set(
              { [storageKey]: { raw, savedAt: Date.now() } },
              () => console.log(`Saved analysis result for ${pageId}`)
            );

            let words: Word[] = [];
            try {
              words = safeParseModelJson(raw);
            } catch (err) {
              console.error('Failed to parse JSON:', err);
            }
            // 如果 port 還在，才送訊息
            try {
              port.postMessage({
                action,
                success: true,
                data: { analyzation: words, count: words.length },
              });
            } catch (e) {
              chrome.runtime.sendMessage({ action: 'analyze-text-background' });
              console.warn('Port disconnected, cannot send:', e);
            }
          } catch (err) {
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
            console.log('[JPNEWS] Summarizing text:', text);
            const sum = await summarizeText(text);

            const storageKey = `${pageId}-sum`;
            chrome.storage.local.set(
              { [storageKey]: { sum, savedAt: Date.now() } },
              () => console.log(`Saved summary for ${pageId}`)
            );
            port.postMessage({
              action,
              success: true,
              data: { sum, count: sum.length },
            });
          } catch (err) {
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

  const handleError = (
    err: any,
    fallbackData: any,
    status: 'error' | 'done' = 'error'
  ) => {
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
        console.log('[JPNEWS] Translating text:', text);
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
      } catch (err) {
        handleError(err, { translation: 'Translation failed', length: '0' });
      }
    })();
    return true;
  }

  if (action === 'analyze-text') {
    (async () => {
      // chrome.runtime.sendMessage({ action: 'status', status: 'waiting' });

      try {
        console.log('[JPNEWS] Analyzing text:', text);
        const raw = await analyzeText(text);

        const storageKey = `${pageId}-raw`;
        chrome.storage.local.set(
          { [storageKey]: { raw, savedAt: Date.now() } },
          () => console.log(`Saved analysis result for ${pageId}`)
        );

        let words: Word[] = [];
        try {
          words = safeParseModelJson(raw);
        } catch (err) {
          console.error('Failed to parse JSON:', err);
        }

        sendResponse({
          success: true,
          data: { analyzation: words, count: words.length },
        });

        // chrome.runtime.sendMessage({ action: 'status', status: 'done' });
      } catch (err) {
        handleError(err, { analyzation: 'Analyzation failed', count: 0 });
      }
    })();
    return true;
  }

  if (action === 'summarize-text') {
    (async () => {
      try {
        console.log('[JPNEWS] Summarizing text:', text);
        const sum = await summarizeText(text);

        const storageKey = `${pageId}-sum`;
        chrome.storage.local.set(
          { [storageKey]: { sum, savedAt: Date.now() } },
          () => console.log(`Saved summary for ${pageId}`)
        );

        sendResponse({
          success: true,
          data: { sum, count: sum.length },
        });
      } catch (err) {
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
    console.log({ pageId });
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
      } catch (err) {
        handleError(err, { reply: '500', count: 0 });
      }
    })();
    return true;
  }
});

// Log when service worker starts
console.log('[JPNEWS] ===== BACKGROUND SCRIPT LOADED =====');
console.log('[JPNEWS] Background script loaded at:', new Date().toISOString());
console.log('[JPNEWS] Chrome version:', navigator.userAgent);

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
  console.log('Translator availability:', availability);

  if (availability !== 'available') {
    notifyPopup('translator', false, 'Translator not ready (downloading...)');
    console.log('Translator not yet available, waiting for download...');
  }
  try {
    session_t_jp_en = await Translator.create({
      sourceLanguage: 'ja',
      targetLanguage: 'en',
      monitor(m: any) {
        m.addEventListener('downloadprogress', (e: any) => {
          const percent = (e.loaded * 100).toFixed(1);
          console.log(`Downloaded ${percent}%`);

          if (e.loaded === 1) {
            console.log('Model fully downloaded. Ready to use!');
          }
        });
      },
    });
    console.log('Translator model session created:', session_t_jp_en);
    notifyPopup('translator', true, 'Translator initialized successfully');
  } catch {
    notifyPopup('translator', false, 'Error creating Translator session');
  }
}

async function translateText(text: string) {
  const result = await session_t_jp_en.translate(text);
  console.log('Translation result:', result);
  return result;
}

async function summarizeText(text: string) {
  let sum = await new Promise<string | null>((resolve) => {
    const ki = `${pageId}-sum`;
    chrome.storage.local.get(ki, (res) => {
      if (res[ki]) {
        console.log('找到之前的分析結果:', res[ki]);
        resolve(res[ki].sum);
      } else {
        console.log('沒有分析過這篇摘要要呼叫 API');
        resolve(null);
      }
    });
  });
  if (sum) {
    console.log('Using cached analysis:', sum);
    return sum;
  }

  const response = await session_s.summarize(text);
  return response;
  // 未來在處理看看 stream
  // const stream = await session_s.summarizeStreaming(text);
  // return stream;
}

async function analyzeText(text: string) {
  let raw = await new Promise<string | null>((resolve) => {
    const ki = `${pageId}-raw`;
    chrome.storage.local.get(ki, (res) => {
      if (res[ki]) {
        console.log('找到之前的分析結果:', res[ki]);
        resolve(res[ki].raw);
      } else {
        console.log('沒有分析過這篇，要呼叫 API');
        resolve(null);
      }
    });
  });
  if (raw) {
    console.log('Using cached analysis:', raw);
    return raw;
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

  const response = await session_l.prompt(
    `Analyze the following text and return exactly 10 important words in different language and also the description of the words in English.
    - English: The word in English
    - Japanese: The word in Japanese with hiragana
    - Description: The description of the word in English
  Example: [{ "english": "Japan", "japanese": "日本 (にほん)", "description": "A country in East Asia" }, ...]

  Text:
  ${text}`,
    {
      responseConstraint: schema,
    }
  );
  console.log('Analyzed text response:', response);
  return response;
}

interface ChatMessage {
  user: 'me' | 'ai';
  text: string;
  timestamp: number;
}

// 儲存訊息
function saveChatMessage(msg: ChatMessage) {
  const ki = `${pageId}-chat`;
  chrome.storage.local.get(ki, (res) => {
    const chatLog: ChatMessage[] = res[ki] || [];
    chatLog.push(msg);
    chrome.storage.local.set({ [ki]: chatLog }, () => {
      console.log('Message saved');
    });
  });
}

// 讀取聊天歷史
function getChatLog(): Promise<ChatMessage[]> {
  return new Promise((resolve) => {
    const ki = `${pageId}-chat`;
    chrome.storage.local.get(ki, (res) => {
      resolve(res[ki] || []);
    });
  });
}

async function promptLanguageModel(text: string) {
  // 1️⃣ 取得歷史聊天紀錄
  let chatLog: ChatMessage[] = await getChatLog();

  // 2️⃣ 將聊天紀錄轉成文字 prompt
  let context = chatLog
    .map((msg) => {
      if (msg.user === 'me') return `User: ${msg.text}`;
      else return `AI: ${msg.text}`;
    })
    .join('\n');

  // 3️⃣ 加上新的使用者訊息
  const finalPrompt = `
    You are a Japanese learning assistant now. Based on previous vocabulary you given, **generate a natural answer to the user's question**. If the user prompt is too away from the topic of the news, just answer a little bit. If the user asks a normal question, answer briefly in 3 to 5 sentences, 
and make sure the answer is not longer than the user's question. You always answered in English, but can use a little bit Japanese.

    Conversation history:
    ${context}

    User: ${text}
    AI:
    `;

  console.log({ finalPrompt, session_l });

  // 4️⃣ 呼叫語言模型
  const response = (await session_l.prompt(finalPrompt.trim())).trim();

  // 5️⃣ 儲存新的訊息到 chatLog
  const userMsg: ChatMessage = { user: 'me', text, timestamp: Date.now() };
  const aiMsg: ChatMessage = {
    user: 'ai',
    text: response,
    timestamp: Date.now(),
  };
  saveChatMessage(userMsg);
  saveChatMessage(aiMsg);

  return response;
}

async function initializeLanguageModel() {
  if (typeof LanguageModel === 'undefined') {
    notifyPopup('language-model', false, 'LanguageModel not available');
    console.warn('LanguageModel API not available in this context.');
    return;
  }

  const availability = await LanguageModel.availability();
  console.log('LanguageMoodel availability:', availability);

  if (availability !== 'available') {
    notifyPopup(
      'language-model',
      false,
      'LanguageModel not ready, downlaoding...'
    );
    console.log('LanguageModel not yet available, waiting for download...');
  }

  try {
    session_l = await LanguageModel.create({
      initialPrompts: [
        {
          role: 'system',
          content:
            'You are a vocabulary extraction assistant give back the words in English, Chinese and Japanese. Also, you give back the detail descripiton of the words in English.',
        },
      ],
      monitor(m: any) {
        m.addEventListener('downloadprogress', (e: any) => {
          const percent = (e.loaded * 100).toFixed(1);
          console.log(`Downloaded ${percent}%`);

          if (e.loaded === 1) {
            console.log('Model fully downloaded. Ready to use!');
          }
        });
      },
    });
    console.log('Language model session created:', session_l);
    notifyPopup(
      'language-model',
      true,
      'LanguageModel initialized successfully'
    );
  } catch {
    notifyPopup(
      'language-model',
      false,
      'Error creating LanguageModel session'
    );
  }
}
// Summarizer API
async function initializeSummarizer() {
  if (typeof Summarizer === 'undefined') {
    notifyPopup('summarizer', false, 'Summarizer not available');
    console.warn('LanguageModel API not available in this context.');
    return;
  }

  const availability = await Summarizer.availability();
  console.log('Summarizer availability:', availability);
  if (availability !== 'available') {
    notifyPopup('summarizer', false, 'Summarizer not ready (downloading...)');
    console.log('Model not yet available, waiting for download...');
  }
  try {
    // Proceed to request batch or streaming summarization
    const options: {
      sharedContext: string;
      type: 'tldr' | 'teaser' | 'key-points' | 'headline'; // keypoint(default)
      format: 'markdown' | 'plain-text'; // markdown(default)
      length: 'short' | 'medium' | 'long'; // medium(default)
      monitor: (m: any) => void;
    } = {
      sharedContext: 'This is a news from NHK News',
      type: 'teaser',
      format: 'plain-text',
      length: 'medium',
      monitor(m: any) {
        m.addEventListener('downloadprogress', (e: any) => {
          console.log(`Downloaded ${e.loaded * 100}%`);
        });
      },
    };

    session_s = await Summarizer.create(options);
    notifyPopup('summarizer', true, 'Summarizer initialized successfully');

    console.log('Summarizer session created:', session_s);
  } catch {
    notifyPopup('summarizer', false, 'Error creating summarizer session');
  }
}

function notifyPopup(
  feature: 'summarizer' | 'translator' | 'language-model',
  success: boolean,
  message: string
) {
  featureStatus[feature] = {
    success,
    message,
  };
  // chrome.runtime.sendMessage({
  //   type: `${feature}-status`,
  //   success,
  //   message,
  // });
}

function safeParseModelJson(raw: string) {
  try {
    // 去掉 ```json``` 或其他多餘字符
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('Parsing failed, returning empty array', { raw });
    return [];
  }
}

/**
 * 將 JSON 陣列轉成 TSV 字串
 */
type Word = { english: string; chinese: string; japanese: string };
function jsonToTSV(words: Word[]): string {
  // 先加入表頭
  const header = ['English', 'Chinese', 'Japanese'].join('\t');

  // 每個物件的欄位用 tab 連接
  const rows = words.map((w) => [w.english, w.chinese, w.japanese].join('\t'));

  // header + rows，用換行連接
  return [header, ...rows].join('\n');
}

// Check commands on startup
// chrome.commands.getAll((commands) => {
//   console.log('[JPNEWS] Commands available on startup:', commands);
// });
