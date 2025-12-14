# 0.1.0 - 0.1.17

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