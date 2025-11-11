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
import { ref, watch, computed } from 'vue';
import { ObjectBase } from '../Object/object';

// Props
interface Props {
  selectedObject: ObjectBase | null;
}

const props = defineProps<Props>();

// Emits
interface Emits {
  contentUpdated: [object: ObjectBase, content: any];
  expandedChange: [expanded: boolean];
}

const emit = defineEmits<Emits>();

// Local state
const contentText = ref('');
const expanded = ref(false);
const displayText = ref('');
const textColor = ref('#1f2937');

const supportsDisplayText = computed(() => {
  const obj = props.selectedObject as any;
  return !!(obj && typeof obj.displayText === 'string');
});

const supportsTextColor = computed(() => {
  const obj = props.selectedObject as any;
  return !!(obj && (typeof obj.textColor === 'string' || typeof obj.getTextColor === 'function'));
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
  '#f8fafc'
];

// Watch for selected object changes
watch(() => props.selectedObject, (newObject) => {
  if (newObject) {
    // 自动展开侧边栏
    expanded.value = true;
    // 确保对象有getContent方法
    if (typeof (newObject as any).getContent === 'function') {
      const content = (newObject as any).getContent();
      contentText.value = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
    } else {
      contentText.value = '';
    }

    if (supportsDisplayText.value) {
      displayText.value = (newObject as any).displayText || '';
    } else {
      displayText.value = '';
    }

    if (supportsTextColor.value) {
      const target: any = newObject;
      if (typeof target.getTextColor === 'function') {
        textColor.value = target.getTextColor() || '#1f2937';
      } else {
        textColor.value = target.textColor || '#1f2937';
      }
    } else {
      textColor.value = '#1f2937';
    }
  } else {
    contentText.value = '';
    displayText.value = '';
    textColor.value = '#1f2937';
  }
}, { immediate: true });

// 监听展开状态变化并通知父组件
watch(expanded, (newValue) => {
  emit('expandedChange', newValue);
}, { immediate: true });

// Methods
const toggleExpanded = () => {
  expanded.value = !expanded.value;
  emit('expandedChange', expanded.value);
};

const updateContent = () => {
  if (props.selectedObject) {
    // 确保对象有setContent方法
    if (typeof (props.selectedObject as any).setContent === 'function') {
      let content;
      try {
        // 尝试解析JSON
        content = JSON.parse(contentText.value);
      } catch (e) {
        // 如果不是有效的JSON，则使用原始字符串
        content = contentText.value;
      }
      (props.selectedObject as any).setContent(content);
      emit('contentUpdated', props.selectedObject, content);
    }
  }
};

const refreshSelectedObject = () => {
  if (!props.selectedObject) return;
  const target = props.selectedObject as any;

  if (typeof target.getContent === 'function') {
    const content = target.getContent();
    contentText.value = typeof content === 'object'
      ? JSON.stringify(content, null, 2)
      : String(content ?? '');
  }

  if (supportsDisplayText.value) {
    displayText.value = target.displayText || '';
  }

  if (supportsTextColor.value) {
    if (typeof target.getTextColor === 'function') {
      textColor.value = target.getTextColor() || '#1f2937';
    } else {
      textColor.value = target.textColor || '#1f2937';
    }
  }
};

const updateDisplayText = () => {
  if (!props.selectedObject || !supportsDisplayText.value) return;
  const target: any = props.selectedObject;
  if (typeof target.setDisplayText === 'function') {
    target.setDisplayText(displayText.value);
  } else {
    target.displayText = displayText.value;
  }
};

const updateTextColor = (color: string) => {
  if (!props.selectedObject || !supportsTextColor.value) return;
  textColor.value = color;
  const target: any = props.selectedObject;
  if (typeof target.setTextColor === 'function') {
    target.setTextColor(color);
  } else {
    target.textColor = color;
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

.no-selection {
  text-align: center;
  color: #999;
  padding: 40px 20px;
  font-style: italic;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar.expanded .sidebar-content {
    width: 200px;
  }
}
</style>