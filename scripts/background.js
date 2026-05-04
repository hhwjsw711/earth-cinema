// ============================================
// Task Manager - Background Service Worker
// Handles Convex API calls
// ============================================

const STORAGE_KEYS = {
  CAPTURED_IMAGE: 'taskManager_capturedImage',
  OPERATION: 'taskManager_operation',
  OPERATION_ERROR: 'taskManager_operationError',
  TASK_RESULT: 'taskManager_result',
  API_KEY: 'convexApiKey'
};

const DEFAULT_API_KEY = 'tf_338bc8fc6a2c0a6e39f1bf2cc934c4b6ba687b11086c104695b9b2621464aad7';

const CONVEX_API = {
  BASE_URL: 'https://accurate-shepherd-453.convex.site',
  TASKS: '/api/tasks'
};

// ============================================
// Service Worker Keep-Alive Helper
// ============================================
async function waitUntil(promise) {
  const keepAlive = setInterval(() => {
    chrome.runtime.getPlatformInfo();
  }, 25 * 1000);
  
  try {
    return await promise;
  } finally {
    clearInterval(keepAlive);
  }
}

// ============================================
// Message Handler
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sendResponse);
  return true;
});

async function handleMessage(request, sendResponse) {
  try {
    switch (request.action) {
      case 'createTask':
        sendResponse({ started: true });
        createTaskInBackground(request.taskData);
        break;
        
      case 'checkOperationStatus':
        const status = await getOperationStatus();
        sendResponse(status);
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action: ' + request.action });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================
// Get Operation Status
// ============================================
async function getOperationStatus() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.OPERATION,
    STORAGE_KEYS.OPERATION_ERROR,
    STORAGE_KEYS.TASK_RESULT
  ]);
  
  return {
    operation: stored[STORAGE_KEYS.OPERATION] || null,
    error: stored[STORAGE_KEYS.OPERATION_ERROR] || null,
    result: stored[STORAGE_KEYS.TASK_RESULT] || null
  };
}

// ============================================
// Get API Key
// ============================================
async function getApiKey() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
  return stored[STORAGE_KEYS.API_KEY] || DEFAULT_API_KEY;
}

// ============================================
// Create Task
// ============================================
async function createTaskInBackground(taskData) {
  const apiKey = await getApiKey();
  
  await chrome.storage.local.set({
    [STORAGE_KEYS.OPERATION]: 'creating',
    [STORAGE_KEYS.OPERATION_ERROR]: null
  });
  
  try {
    const response = await waitUntil(fetch(CONVEX_API.BASE_URL + CONVEX_API.TASKS, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskData)
    }));
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errorMessage = errorData.detail || errorData.message || `API error: ${response.status}`;
      
      if (response.status === 401 || response.status === 403) {
        errorMessage = '无效的 API 密钥，请检查配置';
      }
      
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    
    const taskId = result._id || result.id || result.taskId || result.task?._id || result.task?.id;
    
    if (taskId) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.TASK_RESULT]: result,
        [STORAGE_KEYS.OPERATION]: null,
        [STORAGE_KEYS.OPERATION_ERROR]: null
      });
      
      notifyPopup('taskCreated', { success: true, task: result });
    } else {
      throw new Error('创建任务失败');
    }
    
  } catch (error) {
    let userMessage = error.message;
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      userMessage = '网络错误，请检查网络连接';
    }
    
    await saveOperationError('creating', userMessage);
    notifyPopup('taskCreated', { success: false, error: userMessage });
  }
}

// ============================================
// Save Operation Error
// ============================================
async function saveOperationError(operation, errorMessage) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.OPERATION]: null,
    [STORAGE_KEYS.OPERATION_ERROR]: errorMessage
  });
}

// ============================================
// Notify Popup
// ============================================
function notifyPopup(action, data) {
  chrome.runtime.sendMessage({ action, ...data }).catch(() => {});
}