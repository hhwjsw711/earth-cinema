# 任务助手 - 架构文档

## 项目概述

Chrome 扩展程序，用于快速创建任务并提交到任务看板。

**当前版本**: v1.0.0

**状态**: 生产就绪（截图功能已暂时隐藏）

## 项目结构

```
earth-cinema/
├── manifest.json           # 扩展程序配置
├── README.md              # 使用说明
├── architecture.md        # 本文档
├── PRIVACY.md             # 隐私政策
├── popup/
│   ├── popup.html         # 弹窗页面
│   ├── popup.js           # 弹窗逻辑
│   └── popup.css          # 样式
├── scripts/
│   └── background.js      # 后台服务 worker
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── iconicon128.png
```

## 当前实现的功能

### 1. 填写任务信息
- 任务标题（必填）
- 任务类型（16种类型可选）
- 状态（未开始/未排期/进行中/已完成）
- 所属子平台（20+平台可选）
- 所属区县（11个区县可选）
- 任务描述（可选）

### 2. API 配置
- 默认 API 密钥预配置
- 支持自定义 API 密钥
- 安全存储在浏览器本地

### 3. 任务提交
- 提交到 Convex 后端服务
- 轮询获取任务创建状态
- 成功/失败 toast 提示

## 已隐藏的功能

### 截图功能

**隐藏原因**: 任务管理平台暂不支持截图上传

**隐藏范围**:
1. popup.html - 第 165-213 行被注释
2. popup.js - 移除 captureBtn, captureSection, capturePreview, previewImage 等元素引用
3. popup.js - 移除 captureView 函数
4. background.js - 移除 CAPTURED_IMAGE 存储键
5. popup.html - 步骤指示器从 3 步改为 2 步

## 恢复截图功能指南

若需恢复截图功能，按以下步骤操作：

### 步骤 1: 恢复 popup.html

找到被注释的 `<section class="card" id="capture-section">`（约第 165-213 行），取消注释：

```html
<section class="card" id="capture-section">
    <!-- ... 内容 ... -->
</section>
```

### 步骤 2: 恢复步骤指示器

将步骤指示器改回 3 步：

```html
<div class="steps">
    <div class="step" data-step="1">
        <span class="step-number">1</span>
        <span class="step-label">截图</span>
    </div>
    <div class="step-line"></div>
    <div class="step" data-step="2">
        <span class="step-number">2</span>
        <span class="step-label">填写</span>
    </div>
    <div class="step-line"></div>
    <div class="step" data-step="3">
        <span class="step-number">3</span>
        <span class="step-label">提交</span>
    </div>
</div>
```

### 步骤 3: 恢复 popup.js 元素引用

在 elements 对象中添加：

```javascript
captureBtn: document.getElementById('capture-btn'),
captureSection: document.getElementById('capture-section'),
capturePreview: document.getElementById('capture-preview'),
previewImage: document.getElementById('preview-image'),
```

### 步骤 4: 恢复 popup.js state

在 state 对象中添加：

```javascript
capturedImageBase64: null,
```

### 步骤 5: 恢复 STORAGE_KEYS

在 STORAGE_KEYS 中添加：

```javascript
CAPTURED_IMAGE: 'taskManager_capturedImage',
```

### 步骤 6: 恢复 loadPersistedState

在 loadPersistedState 函数中添加：

```javascript
state.capturedImageBase64 = stored[STORAGE_KEYS.CAPTURED_IMAGE] || null;
```

### 步骤 7: 恢复 saveState

在 saveState 函数中添加：

```javascript
[STORAGE_KEYS.CAPTURED_IMAGE]: state.capturedImageBase64,
```

### 步骤 8: 恢复 captureView 函数

添加 captureView 函数：

```javascript
async function captureView() {
  if (!state.hasApiKey) {
    showToast('需要 API 密钥', '请先配置您的 API 密钥', 'error');
    toggleApiSection();
    return;
  }
  
  showLoading('正在截取当前页面...');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    showLoading('正在截图...');
    const imageData = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });
    
    if (imageData) {
      state.capturedImageBase64 = imageData;
      await saveState();
      
      elements.previewImage.src = imageData;
      elements.capturePreview.classList.remove('hidden');
      elements.transformSection.classList.remove('hidden');
      elements.resetBtn?.classList.remove('hidden');
      
      updateStep(2);
      showToast('截图完成', '请填写任务信息', 'success');
    } else {
      throw new Error('No image data returned');
    }
  } catch (error) {
    showToast('截图失败', error.message || '请确保您已打开目标页面', 'error');
  }
  
  hideLoading();
}
```

### 步骤 9: 恢复事件监听

在 setupEventListeners 中添加：

```javascript
elements.captureBtn.addEventListener('click', captureView);
```

### 步骤 10: 恢复 API 状态更新

在 checkApiKey 和 saveApiKey 函数中恢复：

```javascript
elements.captureBtn.disabled = false;
```

### 步骤 11: 恢复 background.js 存储键

在 STORAGE_KEYS 中添加：

```javascript
CAPTURED_IMAGE: 'taskManager_capturedImage',
```

### 步骤 12: 恢复 UI 逻辑

更新 restoreUI 函数，恢复截图预览显示和步骤状态。

更新 resetState 函数，恢复截图相关元素的重置。

## 技术栈

- **前端**: Chrome Extension (Manifest V3)
- **后端**: Convex
- **API**: REST API with Bearer Token 认证

## 配置文件说明

### manifest.json
- name: 任务助手
- version: 1.0.0
- permissions: activeTab, storage, tabs
- host_permissions: convex.site, convex.cloud

### Convex API
- BASE_URL: https://accurate-shepherd-453.convex.site
- TASKS_ENDPOINT: /api/tasks
- DEFAULT_API_KEY: tf_338bc8fc6a2c0a6e39f1bf2cc934c4b6ba687b11086c104695b9b2621464aad7