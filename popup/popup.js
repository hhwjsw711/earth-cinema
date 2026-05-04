// ============================================
// Task Manager - Popup Controller
// ============================================

const elements = {
  apiToggle: document.getElementById('api-toggle'),
  apiContent: document.getElementById('api-content'),
  apiStatusBadge: document.getElementById('api-status-badge'),
  apiKeyInput: document.getElementById('api-key'),
  toggleVisibility: document.getElementById('toggle-visibility'),
  saveKeyBtn: document.getElementById('save-key'),
  
  steps: document.querySelectorAll('.step'),
  
  captureBtn: document.getElementById('capture-btn'),
  captureSection: document.getElementById('capture-section'),
  capturePreview: document.getElementById('capture-preview'),
  previewImage: document.getElementById('preview-image'),
  
  transformSection: document.getElementById('transform-section'),
  taskTitle: document.getElementById('task-title'),
  taskType: document.getElementById('task-type'),
  taskStatus: document.getElementById('task-status'),
  subPlatform: document.getElementById('sub-platform'),
  district: document.getElementById('district'),
  taskDescription: document.getElementById('task-description'),
  transformBtn: document.getElementById('transform-btn'),
  
  successSection: document.getElementById('success-section'),
  openBoardBtn: document.getElementById('open-board-btn'),
  newTaskBtn: document.getElementById('new-task-btn'),
  
  resetBtn: document.getElementById('reset-btn'),
  
  toast: document.getElementById('toast'),
  loading: document.getElementById('loading'),
  loadingText: document.getElementById('loading-text'),
  apiCard: document.querySelector('.api-card')
};

const state = {
  capturedImageBase64: null,
  currentOperation: null,
  isApiKeyVisible: false,
  hasApiKey: false,
  shownSuccess: false
};

const DEFAULT_API_KEY = 'tf_338bc8fc6a2c0a6e39f1bf2cc934c4b6ba687b11086c104695b9b2621464aad7';

const STORAGE_KEYS = {
  CAPTURED_IMAGE: 'taskManager_capturedImage',
  OPERATION: 'taskManager_operation',
  OPERATION_ERROR: 'taskManager_operationError',
  TASK_RESULT: 'taskManager_result'
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadPersistedState();
  await checkApiKey();
  setupEventListeners();
  restoreUI();
});

async function loadPersistedState() {
  try {
    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.CAPTURED_IMAGE,
      STORAGE_KEYS.OPERATION,
      STORAGE_KEYS.TASK_RESULT
    ]);
    
    state.capturedImageBase64 = stored[STORAGE_KEYS.CAPTURED_IMAGE] || null;
    state.currentOperation = stored[STORAGE_KEYS.OPERATION] || null;
  } catch (error) {
    // Silent fail
  }
}

async function saveState() {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CAPTURED_IMAGE]: state.capturedImageBase64,
      [STORAGE_KEYS.OPERATION]: state.currentOperation
    });
  } catch (error) {
    // Silent fail
  }
}

async function restoreUI() {
  updateStep(1);
  
  if (state.capturedImageBase64) {
    elements.previewImage.src = state.capturedImageBase64;
    elements.capturePreview.classList.remove('hidden');
    elements.transformSection.classList.remove('hidden');
    updateStep(2);
  }
  
  if (state.capturedImageBase64) {
    elements.resetBtn?.classList.remove('hidden');
  }
  
  // 只在有进行中的操作时才检查，不显示之前的结果
  if (state.currentOperation === 'creating') {
    showLoading('正在提交任务...');
    startPolling();
  }
}

async function resetState() {
  state.capturedImageBase64 = null;
  state.currentOperation = null;
  state.shownSuccess = false;
  
  await saveState();
  
  elements.previewImage.src = '';
  elements.capturePreview.classList.add('hidden');
  elements.transformSection.classList.add('hidden');
  elements.successSection.classList.add('hidden');
  elements.taskTitle.value = '';
  elements.taskDescription.value = '';
  elements.resetBtn?.classList.add('hidden');
  elements.apiCard.classList.remove('hidden');
  elements.captureSection?.classList.remove('hidden');
  
  updateStep(1);
  hideLoading();
  
  showToast('已重置', '可以开始新任务', 'info');
}

async function checkApiKey() {
  try {
    let apiKey = DEFAULT_API_KEY;
    const stored = await chrome.storage.local.get('convexApiKey');
    if (stored.convexApiKey) {
      apiKey = stored.convexApiKey;
      state.hasApiKey = true;
    } else {
      await chrome.storage.local.set({ convexApiKey: DEFAULT_API_KEY });
      state.hasApiKey = true;
    }
    
    elements.apiKeyInput.value = '••••••••••••••••••••';
    elements.apiKeyInput.dataset.saved = 'true';
    updateApiStatus(true);
    elements.captureBtn.disabled = false;
  } catch (error) {
    // Silent fail
  }
}

function setupEventListeners() {
  elements.apiToggle.addEventListener('click', toggleApiSection);
  elements.toggleVisibility.addEventListener('click', toggleKeyVisibility);
  elements.saveKeyBtn.addEventListener('click', saveApiKey);
  
  elements.captureBtn.addEventListener('click', captureView);
  elements.transformBtn.addEventListener('click', createTask);
  
  elements.openBoardBtn?.addEventListener('click', () => {
    window.open('https://task.isllm.com', '_blank');
  });
  
  elements.newTaskBtn?.addEventListener('click', resetState);
  
  elements.resetBtn?.addEventListener('click', resetState);
  
  document.getElementById('cancel-btn')?.addEventListener('click', cancelOperation);
  
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
}

function handleBackgroundMessage(message, sender, sendResponse) {
  if (message.action === 'taskCreated') {
    stopPolling();
    state.currentOperation = null;
    
    if (message.success) {
      showToast('创建成功', `"${message.task?.title || '任务'}" 已添加到任务看板`, 'success');
      updateStep(3);
      
      // 隐藏其他部分，只显示成功页面
      elements.transformSection.classList.add('hidden');
      elements.successSection.classList.remove('hidden');
      elements.resetBtn?.classList.add('hidden');
      elements.apiCard.classList.add('hidden');
      elements.captureSection?.classList.add('hidden');
    } else {
      showToast('创建失败', message.error, 'error');
    }
    
    saveState();
    hideLoading();
    elements.transformBtn.disabled = false;
  }
  
  if (sendResponse) {
    sendResponse({ received: true });
  }
}

function toggleApiSection() {
  const isExpanded = elements.apiCard.classList.toggle('expanded');
  elements.apiContent.classList.toggle('collapsed', !isExpanded);
}

async function toggleKeyVisibility() {
  state.isApiKeyVisible = !state.isApiKeyVisible;
  
  if (elements.apiKeyInput.dataset.saved === 'true' && state.isApiKeyVisible) {
    const stored = await chrome.storage.local.get('convexApiKey');
    if (stored.convexApiKey) {
      elements.apiKeyInput.value = stored.convexApiKey;
    }
  } else if (elements.apiKeyInput.dataset.saved === 'true' && !state.isApiKeyVisible) {
    elements.apiKeyInput.value = '••••••••••••••••••••';
  }
  
  elements.apiKeyInput.type = state.isApiKeyVisible ? 'text' : 'password';
}

async function saveApiKey() {
  const key = elements.apiKeyInput.value.trim();
  
  if (key === '••••••••••••••••••••' && elements.apiKeyInput.dataset.saved === 'true') {
    showToast('已保存', '您的 API 密钥已安全存储', 'info');
    elements.apiCard.classList.remove('expanded');
    elements.apiContent.classList.add('collapsed');
    return;
  }
  
  if (!key || key === '••••••••••••••••••••') {
    showToast('无效密钥', '请输入有效的 API 密钥', 'error');
    return;
  }
  
  try {
    await chrome.storage.local.set({ convexApiKey: key });
    state.hasApiKey = true;
    
    elements.apiKeyInput.value = '••••••••••••••••••••';
    elements.apiKeyInput.dataset.saved = 'true';
    elements.apiKeyInput.type = 'password';
    updateApiStatus(true);
    elements.captureBtn.disabled = false;
    
    elements.apiCard.classList.remove('expanded');
    elements.apiContent.classList.add('collapsed');
    
    showToast('已保存', 'API 密钥已安全存储', 'success');
  } catch (error) {
    showToast('保存失败', error.message, 'error');
  }
}

function updateApiStatus(configured) {
  const badge = elements.apiStatusBadge;
  const statusText = badge.querySelector('.status-text');
  
  if (configured) {
    badge.classList.add('configured');
    statusText.textContent = '已配置';
  } else {
    badge.classList.remove('configured');
    statusText.textContent = '未配置';
  }
}

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

async function createTask() {
  const title = elements.taskTitle.value.trim();
  const taskType = elements.taskType.value;
  const status = elements.taskStatus.value;
  const subPlatform = elements.subPlatform.value;
  const district = elements.district.value;
  const description = elements.taskDescription.value.trim();
  
  if (!title) {
    showToast('需要填写', '请填写任务标题', 'error');
    elements.taskTitle.focus();
    return;
  }
  
  state.currentOperation = 'creating';
  await saveState();
  
  showLoading('正在提交任务...');
  elements.transformBtn.disabled = true;
  
  try {
    await chrome.runtime.sendMessage({
      action: 'createTask',
      taskData: {
        title: title,
        taskType: taskType,
        status: status,
        subPlatform: subPlatform,
        district: district,
        description: description
      }
    });
    
    startPolling();
    
  } catch (error) {
    state.currentOperation = null;
    await saveState();
    showToast('提交失败', error.message, 'error');
    hideLoading();
    elements.transformBtn.disabled = false;
  }
}

let pollingInterval = null;

function startPolling() {
  if (pollingInterval) return;
  
  pollingInterval = setInterval(async () => {
    try {
      const status = await chrome.runtime.sendMessage({ action: 'checkOperationStatus' });
      
if (status.result && status.operation === null) {
        stopPolling();
        hideLoading();
        elements.transformBtn.disabled = false;
        updateStep(3);
        const taskTitle = status.result.title || '任务';
        showToast('创建成功', `"${taskTitle}" 已添加到任务看板`, 'success');
        
        elements.transformSection.classList.add('hidden');
        elements.successSection.classList.remove('hidden');
        elements.resetBtn?.classList.add('hidden');
        return;
      }
      
      if (status.error) {
        stopPolling();
        hideLoading();
        elements.transformBtn.disabled = false;
        showToast('创建失败', status.error, 'error');
        return;
      }
      
      // In progress
      if (status.operation === 'creating') {
        showLoading('正在提交任务...');
      }
      
      if (!status.operation) {
        stopPolling();
        hideLoading();
        elements.transformBtn.disabled = false;
      }
    } catch (error) {
      // Silent fail
    }
  }, 2000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

async function cancelOperation() {
  stopPolling();
  state.currentOperation = null;
  
  await chrome.storage.local.set({
    [STORAGE_KEYS.OPERATION]: null,
    [STORAGE_KEYS.OPERATION_ERROR]: null
  });
  
  hideLoading();
  elements.transformBtn.disabled = false;
  showToast('已取消', '操作已取消', 'info');
}

function updateStep(activeStep) {
  elements.steps.forEach((step, index) => {
    const stepNum = index + 1;
    step.classList.remove('active', 'completed');
    
    if (stepNum < activeStep) {
      step.classList.add('completed');
    } else if (stepNum === activeStep) {
      step.classList.add('active');
    }
  });
}

function showToast(title, message, type = 'info') {
  elements.toast.className = `toast ${type}`;
  elements.toast.querySelector('.toast-title').textContent = title;
  elements.toast.querySelector('.toast-message').textContent = message;
  elements.toast.classList.remove('hidden');
  
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2500);
}

function showLoading(text) {
  elements.loadingText.textContent = text;
  elements.loading.classList.remove('hidden');
}

function hideLoading() {
  elements.loading.classList.add('hidden');
}