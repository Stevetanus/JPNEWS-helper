# 0.1.0 - 0.1.21

## 0.1.22
1. enhace update models' timeout to 30 secs.

## 0.1.21
1. catch error when content.js not loaded for `check-side-bar` action.
2. when background.js have no pageId defined in `getFromStorage` function, will call `process-new-page` action for content.js to process the page again.
3. add `isNotSupportedPage` to content.js to prevent running on main page of NHK NEWS EASY.

## 0.1.20
1. enhance to 10 secs limit for loading feature to prevent early rejection when the features are loading. 

## 0.1.19
1. When summarizer and language-model features are initialized, the UI should be green correct sign.

## 0.1.18
1. When detected session is an empty object, will also trigger update models.
2. Comment out sendDownloadProgress function for now, because it may let the UI only show percentage but not feature status at this time.

## 0.1.17
1. update status button will update models when the language model sessions are ended(value === null)

## 0.1.16
1. add clean model session button for users to clean session and update models again to reduce failed process of the extension

## 0.1.14
1. move "featureStatus" storage to session storage, cleaning up when background script being cleaned

## 0.1.13
1. Add utils/types to collect types
2. Add moveFiles.js to move important files for uploading to Chrome Web Store
3. UI improvement on prev/next button
4. Add TODO on percentage UI feature

## 0.1.12
1. Every tab changes will get featureStatus from extension storage
2. Add CHANGELOG.md