# JP NEWS Helper
---
JP News Helper is an extension to help users learn Japanese through [NHK News Easy](https://www3.nhk.or.jp/news/easy/).

## [Intro Video](https://youtu.be/fV98dxeJ_vU)

## Example: 
Use extension on [news](https://www3.nhk.or.jp/news/easy/ne2025073112098/ne2025073112098.html)

![Full Screen](static/jpnewshelper_0.png)

### Extension Popup
First, press **update models** to download models [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api), [Translator](https://developer.chrome.com/docs/ai/translator-api) and [Language Model](https://developer.chrome.com/docs/ai/prompt-api) built in Google Chrome, so you can use the feature via API to the models just in website.

![Extension Popup](static/jpnewshelper_3.png)

### Summary
- 📝 **Summarize** → Summarize the news  

![Summary](static/jpnewshelper_1.png)

### Vocabulary
- 📚 **Vocabulary** → Extract 10 words to learn  

![News Vocabulary](static/jpnewshelper_4.png)

### Chat
- 💬 **Chat** → Use input at the bottom to chat with Language Model about the news.

![Chat with AI](static/jpnewshelper_5.png)

## Features
| Action        | Function                                       |
|---------------|------------------------------------------------|
| **Summarize** | Summarize the news                             |
| **Translate** | Translate the news title and content, and show translations below the original lines |
| **Vocabulary**| Extract 10 key words to learn from the news     |
| **Chat**      | Chat in real time about the news               |

## How to use locally:
1. Code preparation
```
git clone
npm install
npx tsc // .ts file compile to .js file
```
2. Upload extension
* go to manage extensions (chrome://extensions/)
* click **Load unpacked** and select the this code folder to upload
3. Start to use
* got to [NHK News Easy](https://www3.nhk.or.jp/news/easy/) and choose a news then start to use JP NEWS Helper from the right top extension icon.
