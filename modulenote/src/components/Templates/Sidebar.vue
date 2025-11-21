<template>
  <div class="sidebar" :class="{ expanded: expanded }">
    <!-- 图标栏 - 始终显示 -->
    <div class="sidebar-icon-bar" @click="toggleExpanded">
      <div class="icon">⚙️</div>
    </div>
    
    <!-- 内容区 - 根据展开状态显示 -->
    <div class="sidebar-content">
      <div class="sidebar-header">
        <div class="title-bar">
          <h3>元素属性</h3>
          <button
            class="refresh-button"
            type="button"
            @click="refreshSelectedObject"
          >
            刷新
          </button>
        </div>
      </div>
      <div class="sidebar-body">
        <div v-if="selectedObject" class="object-info">
          <div class="info-item">
            <label>类型:</label>
            <span>{{ selectedObject.type || '未知' }}</span>
          </div>
          <div class="info-item">
            <label>ID:</label>
            <span>{{ selectedObject.id || '未设置' }}</span>
          </div>
          <div
            v-if="supportsDisplayText"
            class="info-item content-section"
          >
            <label for="display-text-input">展示内容:</label>
            <textarea
              id="display-text-input"
              v-model="displayText"
              @input="updateDisplayText"
              placeholder="输入展示文本..."
              rows="3"
            ></textarea>
          </div>
          <div
            v-if="supportsTextColor"
            class="info-item color-section"
          >
            <label>文字颜色:</label>
            <div class="color-palette">
              <button
                v-for="color in colorPalette"
                :key="color"
                type="button"
                class="color-swatch"
                :style="{ backgroundColor: color }"
                :class="{ active: textColor === color }"
                @click="updateTextColor(color)"
                :title="color"
              ></button>
            </div>
          </div>
          <div
            v-if="supportsBackgroundColor"
            class="info-item color-section"
          >
            <label>背景颜色:</label>
            <div class="color-palette">
              <button
                v-for="color in backgroundColorPalette"
                :key="color"
                type="button"
                class="color-swatch"
                :style="{ backgroundColor: color }"
                :class="{ active: backgroundColor === color }"
                @click="updateBackgroundColor(color)"
                :title="color"
              ></button>
            </div>
          </div>
          <div
            v-if="supportsSplittable"
            class="info-item splittable-section"
          >
            <label for="splittable-toggle">可分割:</label>
            <div class="toggle-container">
              <input
                id="splittable-toggle"
                type="checkbox"
                v-model="splittable"
                @change="updateSplittable"
                class="toggle-switch"
              />
              <label for="splittable-toggle" class="toggle-label">
                {{ splittable ? '是' : '否' }}
              </label>
            </div>
          </div>
          <div
            v-if="isVarElement"
            class="info-item var-element-section"
          >
            <label>对象类型:</label>
            <div class="object-type-display">{{ varElementObjectType }}</div>
            <div class="object-elements-section">
              <label>对象元素列表:</label>
              <div class="elements-list">
                <div
                  v-for="(element, index) in varElementObjectElements"
                  :key="index"
                  class="element-item"
                >
                  <div class="element-display-blocks">
                    <span class="element-type-block">{{ getElementType(element) }}</span>
                    <span class="element-name-block">{{ getElementName(element) }}</span>
                    <input
                      :value="getElementValue(element)"
                      @input="updateElementValue(element, ($event.target as HTMLInputElement).value)"
                      @blur="onElementValueBlur(element, ($event.target as HTMLInputElement).value)"
                      class="element-value-input"
                      type="text"
                      placeholder="值"
                    />
                  </div>
                  <button
                    type="button"
                    class="remove-element-btn"
                    @click="removeElementFromVarElement(element)"
                    title="移除元素"
                  >
                    ×
                  </button>
                </div>
                <div v-if="varElementObjectElements.length === 0" class="no-elements">
                  暂无元素
                </div>
              </div>
              <div class="add-element-controls">
                <div class="add-element-form">
                  <div class="form-row">
                    <label>类型:</label>
                    <input
                      v-model="elementForm.elementType"
                      type="text"
                      class="form-input-small"
                      placeholder="输入类型..."
                      @keydown.enter="confirmAddElement"
                    />
                  </div>
                  <div class="form-row">
                    <label>名称:</label>
                    <input
                      v-model="elementForm.elementName"
                      type="text"
                      class="form-input-small"
                      placeholder="元素名称..."
                      @keydown.enter="confirmAddElement"
                    />
                  </div>
                  <div class="form-row">
                    <label>值:</label>
                    <input
                      v-model="elementForm.elementValue"
                      type="text"
                      class="form-input-small"
                      placeholder="输入值..."
                      @keydown.enter="confirmAddElement"
                    />
                  </div>
                  <button
                    type="button"
                    class="add-element-confirm-btn"
                    @click="confirmAddElement"
                    :disabled="!canAddElement"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="info-item content-section">
            <label for="content-input">内容:</label>
            <textarea
              id="content-input"
              v-model="contentText"
              @input="updateContent"
              placeholder="输入内容..."
              rows="6"
            ></textarea>
          </div>
        </div>
        <div v-else class="no-selection">
          未选择任何元素
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ObjectBase } from '../Object/object';
import { VarElement } from '../Object/varElement';
import { TextElement } from '../Object/textElement';
import { Textbox } from '../Object/textbox';
import {
  useEventNode,
  NotesChannels,
  type SelectionChangedPayload,
  type SidebarExpandedPayload,
  type SidebarContentUpdatedPayload,
} from '@/Event';

const eventNode = useEventNode({ tags: ['sidebar'] });

const selectedObject = ref<ObjectBase | null>(null);
const contentText = ref('');
const expanded = ref(false);
const displayText = ref('');
const textColor = ref('#1f2937');
const backgroundColor = ref('#e5e7eb');
const splittable = ref(true);

// varElement 相关
const varElementObjectType = ref('');
const varElementObjectElements = ref<ObjectBase[]>([]);

// 添加元素表单相关
const elementForm = ref({
  elementType: '',
  elementName: '',
  elementValue: '',
});

// 检查是否可以添加元素（三个字段都填好）
const canAddElement = computed(() => {
  const { elementType, elementName, elementValue } = elementForm.value;
  return elementType.trim().length > 0 && elementName.trim().length > 0 && elementValue.trim().length > 0;
});

const supportsDisplayText = computed(() => {
  const obj = selectedObject.value as any;
  return !!(obj && typeof obj.displayText === 'string');
});

const supportsTextColor = computed(() => {
  const obj = selectedObject.value as any;
  return !!(
    obj &&
    (typeof obj.textColor === 'string' || typeof obj.getTextColor === 'function')
  );
});

const supportsSplittable = computed(() => {
  const obj = selectedObject.value as any;
  return !!(
    obj &&
    (typeof obj.splittable === 'boolean' || typeof obj.getSplittable === 'function')
  );
});

const supportsBackgroundColor = computed(() => {
  const obj = selectedObject.value as any;
  return !!(
    obj &&
    (typeof obj.backgroundColor === 'string' || typeof obj.getBackgroundColor === 'function')
  );
});

const isVarElement = computed(() => {
  const obj = selectedObject.value as any;
  return obj && (obj.type === 'var-element' || obj instanceof VarElement);
});

const colorPalette = [
  '#1f2937',
  '#111827',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f8fafc',
];

const backgroundColorPalette = [
  'rgba(33, 150, 243, 0.08)',
  'rgba(33, 150, 243, 0.15)',
  'rgba(239, 68, 68, 0.08)',
  'rgba(239, 68, 68, 0.15)',
  'rgba(249, 115, 22, 0.08)',
  'rgba(249, 115, 22, 0.15)',
  'rgba(245, 158, 11, 0.08)',
  'rgba(245, 158, 11, 0.15)',
  'rgba(16, 185, 129, 0.08)',
  'rgba(16, 185, 129, 0.15)',
  'rgba(14, 165, 233, 0.08)',
  'rgba(14, 165, 233, 0.15)',
  'rgba(59, 130, 246, 0.08)',
  'rgba(59, 130, 246, 0.15)',
  'rgba(99, 102, 241, 0.08)',
  'rgba(99, 102, 241, 0.15)',
  'rgba(139, 92, 246, 0.08)',
  'rgba(139, 92, 246, 0.15)',
  'rgba(236, 72, 153, 0.08)',
  'rgba(236, 72, 153, 0.15)',
  'rgba(20, 184, 166, 0.08)',
  'rgba(20, 184, 166, 0.15)',
  'rgba(248, 250, 252, 0.8)',
  'transparent',
];

const emitExpandedState = (value: boolean) => {
  eventNode.emit(NotesChannels.SIDEBAR_EXPANDED, { expanded: value });
};

const setExpanded = (value: boolean) => {
  if (expanded.value === value) return;
  expanded.value = value;
  emitExpandedState(value);
};

const readObjectContent = (target: any) => {
  if (typeof target?.getContent === 'function') {
    const content = target.getContent();
    contentText.value =
      typeof content === 'object'
        ? JSON.stringify(content, null, 2)
        : String(content ?? '');
  } else {
    contentText.value = '';
  }

  if (typeof target?.displayText === 'string') {
    displayText.value = target.displayText ?? '';
  } else {
    displayText.value = '';
  }

  if (typeof target?.getTextColor === 'function') {
    textColor.value = target.getTextColor() || '#1f2937';
  } else if (typeof target?.textColor === 'string') {
    textColor.value = target.textColor || '#1f2937';
  } else {
    textColor.value = '#1f2937';
  }

  if (typeof target?.getBackgroundColor === 'function') {
    backgroundColor.value = target.getBackgroundColor() || '#e5e7eb';
  } else if (typeof target?.backgroundColor === 'string') {
    backgroundColor.value = target.backgroundColor || '#e5e7eb';
  } else {
    backgroundColor.value = '#e5e7eb';
  }

  if (typeof target?.getSplittable === 'function') {
    splittable.value = target.getSplittable() ?? true;
  } else if (typeof target?.splittable === 'boolean') {
    splittable.value = target.splittable;
  } else {
    splittable.value = true; // 默认可分割
  }

  // 如果是 varElement，读取对象信息
  if (target && (target.type === 'var-element' || target instanceof VarElement)) {
    const varEl = target as VarElement;
    if (typeof varEl.updateObjectElements === 'function') {
      varEl.updateObjectElements();
    }
    varElementObjectType.value = varEl.objectType || 'NULL';
    varElementObjectElements.value = varEl.objectElements || [];
  } else {
    varElementObjectType.value = '';
    varElementObjectElements.value = [];
  }
};

const applySelectedObject = (object: ObjectBase | null) => {
  selectedObject.value = object;
  if (object) {
    setExpanded(true);
    readObjectContent(object as any);
  } else {
    contentText.value = '';
    displayText.value = '';
    textColor.value = '#1f2937';
    backgroundColor.value = '#e5e7eb';
    splittable.value = true;
  }
};

eventNode.on(NotesChannels.SELECTION_CHANGED, ({ payload }) => {
  const { element } =
    (payload as SelectionChangedPayload) ?? { element: payload };
  applySelectedObject((element as ObjectBase) ?? null);
});

// Methods
const toggleExpanded = () => {
  setExpanded(!expanded.value);
};

const updateContent = () => {
  if (!selectedObject.value) return;
  const target: any = selectedObject.value;
  if (typeof target.setContent === 'function') {
    let content;
    try {
      content = JSON.parse(contentText.value);
    } catch (e) {
      content = contentText.value;
    }
    target.setContent(content);
    eventNode.emit(NotesChannels.SIDEBAR_CONTENT_UPDATED, {
      element: selectedObject.value,
      content,
    } satisfies SidebarContentUpdatedPayload);
  }
};

const refreshSelectedObject = () => {
  if (!selectedObject.value) return;
  readObjectContent(selectedObject.value as any);
};

const updateDisplayText = () => {
  if (!selectedObject.value || !supportsDisplayText.value) return;
  const target: any = selectedObject.value;
  if (typeof target.setDisplayText === 'function') {
    target.setDisplayText(displayText.value);
  } else {
    target.displayText = displayText.value;
  }
};

const updateTextColor = (color: string) => {
  if (!selectedObject.value || !supportsTextColor.value) return;
  textColor.value = color;
  const target: any = selectedObject.value;
  if (typeof target.setTextColor === 'function') {
    target.setTextColor(color);
  } else {
    target.textColor = color;
  }
};

const updateBackgroundColor = (color: string) => {
  if (!selectedObject.value || !supportsBackgroundColor.value) return;
  backgroundColor.value = color;
  const target: any = selectedObject.value;
  if (typeof target.setBackgroundColor === 'function') {
    target.setBackgroundColor(color);
  } else {
    target.backgroundColor = color;
  }
};

const updateSplittable = () => {
  if (!selectedObject.value || !supportsSplittable.value) return;
  const target: any = selectedObject.value;
  if (typeof target.setSplittable === 'function') {
    target.setSplittable(splittable.value);
  } else {
    target.splittable = splittable.value;
  }
};

// varElement 相关方法
const getElementType = (element: ObjectBase): string => {
  const el = element as any;
  // 优先使用 type 属性
  if (el.type) {
    return el.type;
  }
  return '未知类型';
};

const getElementName = (element: ObjectBase): string => {
  const el = element as any;
  // 优先使用 name 属性
  if (el.name) {
    return el.name;
  }
  // 其次使用 displayText
  if (el.displayText) {
    return el.displayText;
  }
  // 最后使用 elementId
  if (el.elementId) {
    return el.elementId.substring(0, 8);
  }
  return '未命名';
};

const getElementValue = (element: ObjectBase): string => {
  const el = element as any;
  // 优先使用 value 属性
  if (el.value !== undefined && el.value !== null) {
    return String(el.value);
  }
  // 其次使用 content
  if (el.content !== undefined && el.content !== null) {
    return String(el.content);
  }
  // 对于 textElement，使用 displayText 作为值
  if (el.type === 'text-element' && el.displayText) {
    return el.displayText;
  }
  return '';
};

// 确认添加元素
const confirmAddElement = () => {
  if (!selectedObject.value || !isVarElement.value) return;
  
  const varEl = selectedObject.value as VarElement;
  const { elementType, elementName, elementValue } = elementForm.value;
  
  // 验证必填字段
  if (!elementType.trim() || !elementName.trim() || !elementValue.trim()) {
    return;
  }
  
  // 如果 VarElement 没有目标对象，先创建一个 Textbox 作为容器
  if (!varEl.targetObject) {
    const newTextbox = new Textbox();
    newTextbox.type = 'var-object';
    varEl.targetObject = newTextbox;
    varEl.setContent(newTextbox);
  }
  
  // 创建一个 Textbox 来存储元素信息
  const newElement = new Textbox();
  newElement.type = elementType.trim();
  newElement.setContent(elementValue.trim());
  (newElement as any).name = elementName.trim();
  (newElement as any).value = elementValue.trim();
  (newElement as any).displayText = elementValue.trim();
  
  if (typeof varEl.addElementToObject === 'function') {
    varEl.addElementToObject(newElement);
    // 更新显示
    if (typeof varEl.updateObjectElements === 'function') {
      varEl.updateObjectElements();
    }
    varElementObjectType.value = varEl.objectType || 'NULL';
    varElementObjectElements.value = varEl.objectElements || [];
    
    // 清空表单
    elementForm.value = {
      elementType: '',
      elementName: '',
      elementValue: '',
    };
  }
};

const removeElementFromVarElement = (element: ObjectBase) => {
  if (!selectedObject.value || !isVarElement.value) return;
  
  const varEl = selectedObject.value as VarElement;
  
  // 尝试多种方式获取 elementId
  const elementId = (element as any).elementId || (element as any).id || (element as any).name;
  
  // 如果还是没有 elementId，尝试通过索引移除
  if (!elementId) {
    const index = varElementObjectElements.value.findIndex(el => el === element);
    if (index !== -1 && varEl.targetObject && (varEl.targetObject as any).elements) {
      (varEl.targetObject as any).elements.splice(index, 1);
      varEl.updateObjectElements();
      varElementObjectType.value = varEl.objectType || 'NULL';
      varElementObjectElements.value = varEl.objectElements || [];
      return;
    }
  }
  
  if (elementId && typeof varEl.removeElementFromObject === 'function') {
    varEl.removeElementFromObject(elementId);
    // 更新显示
    if (typeof varEl.updateObjectElements === 'function') {
      varEl.updateObjectElements();
    }
    varElementObjectType.value = varEl.objectType || 'NULL';
    varElementObjectElements.value = varEl.objectElements || [];
  }
};

// 更新元素的值
const updateElementValue = (element: ObjectBase, newValue: string) => {
  const el = element as any;
  
  // 更新元素的 value 属性
  if (el.value !== undefined) {
    el.value = newValue;
  }
  
  // 更新 content
  if (el.setContent && typeof el.setContent === 'function') {
    el.setContent(newValue);
  } else {
    el.content = newValue;
  }
  
  // 更新 displayText（如果存在）
  if (el.setDisplayText && typeof el.setDisplayText === 'function') {
    el.setDisplayText(newValue);
  } else if (el.displayText !== undefined) {
    el.displayText = newValue;
  }
};

// 当输入框失去焦点时，确保值已保存
const onElementValueBlur = (element: ObjectBase, newValue: string) => {
  updateElementValue(element, newValue);
  
  // 如果 VarElement 存在，更新其对象元素列表
  if (selectedObject.value && isVarElement.value) {
    const varEl = selectedObject.value as VarElement;
    if (typeof varEl.updateObjectElements === 'function') {
      varEl.updateObjectElements();
    }
    varElementObjectElements.value = varEl.objectElements || [];
  }
};
</script>

<style scoped>
.sidebar {
  display: flex;
  height: 100vh;
  position: fixed;
  top: 0;
  right: 0;
  z-index: 1000;
  background-color: #ffffff;
  transition: transform 0.3s ease;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
}

/* 图标栏 - 始终显示 */
.sidebar-icon-bar {
  width: 50px;
  height: 100%;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-right: 1px solid #e0e0e0;
}

.sidebar-icon-bar .icon {
  font-size: 24px;
  transition: transform 0.2s ease;
}

.sidebar-icon-bar:hover .icon {
  transform: scale(1.1);
}

/* 内容区 - 默认隐藏 */
.sidebar-content {
  width: 0;
  overflow: hidden;
  transition: width 0.3s ease;
  display: flex;
  flex-direction: column;
}

/* 展开状态 */
.sidebar.expanded .sidebar-content {
  width: 250px;
}

.sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f5f5f5;
}

.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: #333;
  flex: 1;
}

.refresh-button {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.6);
  background-color: #fff;
  color: #1f2937;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.refresh-button:hover {
  background-color: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.6);
  color: #1d4ed8;
}

.refresh-button:active {
  background-color: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.7);
  color: #1e3a8a;
}

.sidebar-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.object-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item label {
  font-weight: 500;
  color: #666;
  font-size: 14px;
}

.info-item span {
  font-size: 14px;
  color: #333;
  padding: 8px 12px;
  background-color: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.content-section {
  margin-top: 8px;
}

#content-input {
  font-family: monospace;
  font-size: 13px;
}

#content-input,
#display-text-input,
#comment-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.2s;
}

#content-input:focus,
#display-text-input:focus,
#comment-input:focus {
  outline: none;
  border-color: #4a90e2;
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
}

.color-section .color-palette {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.2);
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  padding: 0;
}

.color-swatch:hover {
  transform: scale(1.05);
  border-color: rgba(15, 23, 42, 0.4);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.color-swatch.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.4);
}

.splittable-section .toggle-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-switch {
  width: 44px;
  height: 24px;
  appearance: none;
  background-color: #cbd5e1;
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s ease;
  outline: none;
}

.toggle-switch:checked {
  background-color: #3b82f6;
}

.toggle-switch::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #ffffff;
  top: 2px;
  left: 2px;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-switch:checked::before {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 14px;
  color: #333;
  cursor: pointer;
  user-select: none;
}

.no-selection {
  text-align: center;
  color: #999;
  padding: 40px 20px;
  font-style: italic;
}

/* 添加元素表单样式 */
.add-element-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-row label {
  font-size: 12px;
  font-weight: 500;
  color: #666;
  min-width: 40px;
}

.form-input-small,
.form-select-small {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.form-input-small:focus,
.form-select-small:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.add-element-confirm-btn {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid rgba(59, 130, 246, 0.6);
  background-color: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  margin-top: 4px;
}

.add-element-confirm-btn:hover:not(:disabled) {
  background-color: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.8);
  color: #2563eb;
}

.add-element-confirm-btn:active:not(:disabled) {
  background-color: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.9);
  color: #1d4ed8;
}

.add-element-confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 元素列表样式 */
.elements-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.element-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 13px;
  gap: 8px;
}

.element-display-blocks {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.element-type-block,
.element-name-block,
.element-value-block {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.element-type-block {
  background-color: rgba(99, 102, 241, 0.15);
  color: #6366f1;
}

.element-name-block {
  background-color: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.element-value-block {
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.element-value-input {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
  outline: none;
  min-width: 60px;
  flex: 1;
  max-width: 150px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
  font-family: inherit;
}

.element-value-input:focus {
  border-color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.25);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.element-value-input::placeholder {
  color: rgba(59, 130, 246, 0.5);
}

.remove-element-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 4px;
  background-color: #ef4444;
  color: #ffffff;
  font-size: 18px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
  flex-shrink: 0;
}

.remove-element-btn:hover {
  background-color: #dc2626;
  transform: scale(1.1);
}

.remove-element-btn:active {
  background-color: #b91c1c;
  transform: scale(0.95);
}

.no-elements {
  text-align: center;
  color: #999;
  padding: 20px;
  font-style: italic;
  font-size: 13px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar.expanded .sidebar-content {
    width: 200px;
  }
}
</style>