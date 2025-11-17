<template>
  <div class="demo-container">
    <h2>文本框元素容器演示</h2>
    
    <!-- Textbox元素容器 -->
    <div class="textbox-demo-section">
      <h3>Textbox作为元素容器</h3>
      <p>以下是一个可以添加元素的Textbox组件演示：</p>
      
      <div class="textbox-wrapper">
        <template-textbox
          ref="textboxRef"
          :mode="demoMode"
          :placeholder="'暂无元素，请点击下方按钮添加元素'"
        ></template-textbox>
      </div>
      
      <!-- 控制按钮区域 -->
      <div class="control-buttons">
        <template-button 
          @click="toggleMode"
          class="demo-button"
        >
          切换模式 (当前: {{ demoMode }})
        </template-button>
        
        <template-button 
          @click="addNewElement"
          class="demo-button"
        >
          添加文本元素
        </template-button>
        
        <template-button 
          @click="addButtonElement"
          class="demo-button"
        >
          添加按钮元素
        </template-button>
        
        <template-button 
          @click="clearAllElements"
          class="demo-button danger"
        >
          清空所有元素
        </template-button>
      </div>
    </div>
    
    <!-- 状态显示区域 -->
    <div class="state-info">
      <h4>当前状态：</h4>
      <div class="info-item">
        <span>模式：</span>
        <strong>{{ demoMode }}</strong>
      </div>
      <div class="info-item">
        <span>元素数量：</span>
        <strong>{{ elements.length }}</strong>
      </div>
      <div v-if="selectedElement" class="info-item">
        <span>选中元素：</span>
        <strong>{{ getElementTypeName(selectedElement.type) }}</strong>
        (ID: {{ selectedElement.elementId.substring(0, 8) }}...)
      </div>
    </div>
    
    <!-- 元素列表展示 -->
    <div class="elements-list">
      <h4>当前元素列表：</h4>
      <ul v-if="elements.length > 0">
        <li v-for="element in elements" :key="element.elementId" class="element-item">
          <div class="element-info">
            <span class="element-type">{{ getElementTypeName(element.type) }}</span>
            <span class="element-id">ID: {{ element.elementId.substring(0, 8) }}...</span>
          </div>
          <template-button 
            @click="removeSpecificElement(element.elementId)"
            class="small-button danger"
          >
            移除
          </template-button>
        </li>
      </ul>
      <p v-else class="empty-text">当前没有元素</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useEventNode, NotesChannels } from '@/Event';
import { Textbox } from '../components/Object/textbox';
import { TextElement as Element } from '../components/Object/textElement';
import { tButton } from '../components/Object/Button';
import TemplateTextbox from '../components/Templates/Textbox.vue';
import TemplateButton from '../components/Templates/Button.vue';

// 演示模式
const demoMode = ref<'view' | 'edit'>('edit');
// 文本框引用
const textboxRef = ref();
// 元素列表
const elements = ref<Element[]>([]);
// 选中的元素
const selectedElement = ref<Element | null>(null);
const eventNode = useEventNode({ tags: ['simple-demo'] });

// 切换模式
function toggleMode() {
  demoMode.value = demoMode.value === 'view' ? 'edit' : 'view';
  console.log(`模式已切换为: ${demoMode.value}`);
}

// 添加新的文本元素
function addNewElement() {
  if (!textboxRef.value) return;
  
  // 创建一个新的文本元素
  const textElement = new Element('demo-text-element');
  
  // 设置元素内容
  const elementContent = {
    title: `文本元素 ${elements.value.length + 1}`,
    description: `这是一个动态添加的文本元素`,
    timestamp: new Date().toLocaleString(),
    type: 'text'
  };
  
  textElement.setContent(elementContent);
  
  // 添加元素到文本框
  textboxRef.value.addElement(textElement);
  
  console.log('已添加新文本元素:', textElement.elementId);
}

// 添加按钮元素
function addButtonElement() {
  if (!textboxRef.value) return;
  
  // 创建一个新的按钮元素
  const buttonElement = new tButton('demo-button');
  buttonElement.setContent({
    label: `按钮 ${elements.value.length + 1}`,
    type: 'primary',
    disabled: false
  });
  
  // 添加元素到文本框
  textboxRef.value.addElement(buttonElement);
  
  console.log('已添加新按钮元素:', buttonElement.id);
}

// 移除特定元素
function removeSpecificElement(elementId: string) {
  if (!textboxRef.value) return;
  
  textboxRef.value.removeElement(elementId);
  console.log('已移除元素:', elementId);
}

// 清空所有元素
function clearAllElements() {
  if (!textboxRef.value) return;
  
  textboxRef.value.clearElements();
  elements.value = [];
  selectedElement.value = null;
  console.log('已清空所有元素');
}

// 处理元素变化
function handleElementsChange(newElements: Element[]) {
  elements.value = newElements;
  console.log('元素列表已更新:', elements.value.length, '个元素');
}

// 事件系统监听（双发布阶段保持并行）
eventNode.on(NotesChannels.ELEMENT_CLICK, ({ payload }) => {
  const { element } = payload as any;
  if (element) {
    selectedElement.value = element as Element;
  }
});

eventNode.on(NotesChannels.TEXTBOX_MODE_CHANGE, ({ payload }) => {
  const { mode } = payload as any;
  if (mode === 'view' || mode === 'edit') {
    demoMode.value = mode;
  }
});

// 处理元素点击
function handleElementClick(element: Element) {
  selectedElement.value = element;
  console.log('元素被点击:', element.elementId, element.type);
}

// 处理元素双击
function handleElementDoubleClick(element: Element) {
  selectedElement.value = element;
  // 双击事件会通过冒泡触发App.vue中的handleElementDoubleClick
  console.log('元素被双击:', element.elementId, element.type);
}

// 处理元素添加
function handleElementAdd(element: Element) {
  console.log('元素已添加:', element.elementId, element.type);
}

// 处理元素移除
function handleElementRemove(elementId: string) {
  // 如果移除的是当前选中的元素，清除选中状态
  if (selectedElement.value && selectedElement.value.elementId === elementId) {
    selectedElement.value = null;
  }
  console.log('元素已移除:', elementId);
}

// 获取元素类型的中文名称
function getElementTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    'demo-text-element': '文本元素',
    'demo-button': '按钮元素',
    'element': '普通元素'
  };
  return typeMap[type] || type || '未知类型';
}

// 初始化
onMounted(() => {
  console.log('组件初始化完成，已加载TemplateTextbox组件');
  console.log('已加载TemplateButton组件');
  console.log(`初始模式: ${demoMode.value}`);
});
</script>

<style scoped>
.demo-container {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 8px;
}

h2 {
  color: #333;
  margin-bottom: 20px;
}

h3 {
  color: #555;
  margin-bottom: 10px;
  font-size: 1.1em;
}

h4 {
  color: #666;
  margin-bottom: 10px;
  font-size: 1em;
}

/* 文本框演示区域样式 */
.textbox-demo-section {
  margin: 20px 0;
  padding: 15px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 文本框包装器样式 */
.textbox-wrapper {
  margin: 15px 0;
  min-height: 120px;
}

/* 控制按钮区域 */
.control-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 15px;
}

/* 演示按钮样式 */
.demo-button {
  padding: 8px 16px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.demo-button:hover {
  background-color: #45a049;
}

/* 状态显示区域 */
.state-info {
  margin: 20px 0;
  padding: 15px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
}

.info-item span {
  color: #666;
  width: 100px;
}

.info-item strong {
  color: #333;
}

/* 元素列表展示 */
.elements-list {
  margin-top: 30px;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.element-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  margin: 5px 0;
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  list-style: none;
}

.element-info {
  display: flex;
  gap: 15px;
  align-items: center;
}

.element-type {
  font-weight: 600;
  padding: 3px 8px;
  background-color: #e3f2fd;
  border-radius: 4px;
  color: #1565c0;
}

.element-id {
  font-size: 12px;
  color: #666;
}

.small-button {
  padding: 4px 10px;
  font-size: 12px;
}

.empty-text {
  text-align: center;
  color: #999;
  font-style: italic;
  padding: 20px;
}

.elements-list ul {
  margin: 0;
  padding: 0;
}

/* 危险操作按钮样式 */
.danger {
  background-color: #f44336;
  color: white;
}

.danger:hover {
  background-color: #d32f2f;
}
</style>