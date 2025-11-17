<template>
  <div class="object-communication-demo">
    <h2>对象通信演示 - 元素容器</h2>
    
    <!-- Textbox作为元素容器演示 -->
    <div class="textbox-demo">
      <h3>Textbox元素容器</h3>
      <p>此演示展示Textbox作为元素容器，管理Element对象</p>
      
      <div class="demo-container">
        <TextboxComponent
          ref="textboxRef"
          :mode="textboxMode"
          :placeholder="'点击下方按钮添加元素到容器中'"
        ></TextboxComponent>
        
        <!-- 控制按钮 -->
        <div class="control-buttons">
          <template-button 
            @click="toggleTextboxMode"
            class="control-button"
          >
            切换模式 ({{ textboxMode }})
          </template-button>
          
          <template-button 
            @click="addElementToTextbox"
            class="control-button"
          >
            添加新元素
          </template-button>
          
          <template-button 
            @click="signalUpdateToElements"
            class="control-button"
          >
            向所有元素发送更新信号
          </template-button>
          
          <template-button 
            @click="clearTextboxElements"
            class="control-button danger"
          >
            清空元素
          </template-button>
        </div>
      </div>
    </div>
    
    <!-- 元素列表与状态信息 -->
    <div class="elements-status">
      <h3>容器元素状态</h3>
      
      <div class="status-grid">
        <div class="status-card">
          <h4>文本框信息</h4>
          <p><strong>模式:</strong> {{ textboxMode }}</p>
          <p><strong>元素数量:</strong> {{ textboxElements.length }}</p>
          <p><strong>上次更新:</strong> {{ lastUpdateTime }}</p>
        </div>
        
        <div class="status-card" v-if="selectedElement">
          <h4>选中元素详情</h4>
          <p><strong>ID:</strong> {{ selectedElement.elementId.substring(0, 10) }}...</p>
          <p><strong>类型:</strong> {{ getElementTypeName(selectedElement.type) }}</p>
          <p><strong>内容:</strong> {{ formatElementContent(selectedElement.getContent()) }}</p>
        </div>
      </div>
    </div>
    
    <!-- 通信监控面板 -->
    <div class="communication-panel">
      <h3>通信日志</h3>
      <div class="log-container">
        <p v-for="(log, index) in communicationLogs" :key="index" class="log-entry">
          <span class="log-time">{{ log.timestamp }}</span>
          <span class="log-type" :class="`type-${log.type}`">{{ log.type }}</span>
          <span class="log-message">{{ log.message }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { Textbox } from '../components/Object/textbox';
import { TextElement as Element } from '../components/Object/textElement';
import TextboxComponent from '../components/Templates/Textbox.vue';
import TemplateButton from '../components/Templates/Button.vue';
import { useEventNode, NotesChannels } from '@/Event';

// 文本框相关状态
const textboxMode = ref<'view' | 'edit'>('edit');
const textboxRef = ref();
const textboxElements = ref<Element[]>([]);
const selectedElement = ref<Element | null>(null);
const lastUpdateTime = ref('');
const eventNode = useEventNode({ tags: ['object-demo'] });

// 通信日志
const communicationLogs = ref<Array<{
  timestamp: string;
  type: string;
  message: string;
}>>([]);

// 元素ID计数器
let elementCounter = 0;

// 添加通信日志
function addCommunicationLog(type: string, message: string) {
  const log = {
    timestamp: new Date().toLocaleTimeString(),
    type,
    message
  };
  
  communicationLogs.value.unshift(log);
  
  // 限制日志数量
  if (communicationLogs.value.length > 30) {
    communicationLogs.value.pop();
  }
  
  // 更新最后更新时间
  lastUpdateTime.value = log.timestamp;
}

// emits 监听移除，统一改由事件系统更新

// 事件系统监听（双发布阶段）
eventNode.on(NotesChannels.ELEMENT_DOUBLE_CLICK, ({ payload }) => {
  const { element } = payload as any;
  if (element) {
    selectedElement.value = element as Element;
    addCommunicationLog('EventBus', `双击元素: ${(element as Element).elementId}`);
  }
});

eventNode.on(NotesChannels.ELEMENTS_CHANGE, ({ payload }) => {
  const { elements } = payload as any;
  if (Array.isArray(elements)) {
    textboxElements.value = elements as Element[];
    addCommunicationLog('EventBus', `元素列表更新（事件总线）: ${elements.length}`);
  }
});

eventNode.on(NotesChannels.TEXTBOX_MODE_CHANGE, ({ payload }) => {
  const { mode } = payload as any;
  if (mode === 'view' || mode === 'edit') {
    textboxMode.value = mode;
    addCommunicationLog('EventBus', `模式变更（事件总线）为: ${mode}`);
  }
});

// 切换文本框模式
function toggleTextboxMode() {
  textboxMode.value = textboxMode.value === 'view' ? 'edit' : 'view';
  if (textboxRef.value) {
    textboxRef.value.toggleMode();
  }
  addCommunicationLog('Demo', `手动切换模式为: ${textboxMode.value}`);
}

// 添加元素到文本框
function addElementToTextbox() {
  if (!textboxRef.value) return;
  
  elementCounter++;
  const newElement = new Element(`demo-element-${elementCounter}`);
  
  // 设置元素内容
  const elementContent = {
    title: `演示元素 ${elementCounter}`,
    description: `这是通过ObjectCommunicationDemo添加的元素`,
    timestamp: new Date().toLocaleString(),
    type: 'dynamic-element'
  };
  
  newElement.setContent(elementContent);
  
  // 添加元素到文本框
  textboxRef.value.addElement(newElement);
  
  addCommunicationLog('Demo', `已添加新元素: ${newElement.elementId}`);
}

// 向所有元素发送更新信号
function signalUpdateToElements() {
  if (!textboxRef.value || textboxElements.value.length === 0) return;

  const textboxInstance = textboxRef.value.getInstance?.() as Textbox | undefined;
  if (!textboxInstance) {
    addCommunicationLog('Error', '未获取到 Textbox 实例，无法发送更新信号');
    return;
  }
  
  const updateData = {
    updateSource: 'ObjectCommunicationDemo',
    updateTime: new Date().toISOString(),
    updateCount: textboxElements.value.length
  };
  
  // 向每个元素发送更新信号
  textboxElements.value.forEach(element => {
    textboxInstance.sendSignal(element, 'updateContent', updateData);
  });
  
  addCommunicationLog('Signal', `已向 ${textboxElements.value.length} 个元素发送更新信号`);
}

// 清空文本框中的所有元素
function clearTextboxElements() {
  if (!textboxRef.value) return;
  
  textboxRef.value.clearElements();
  textboxElements.value = [];
  selectedElement.value = null;
  
  addCommunicationLog('Demo', '已清空文本框中的所有元素');
}

// emits 监听移除，统一改由事件系统更新

// 获取元素类型的中文名称
function getElementTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    'demo-element': '演示元素',
    'dynamic-element': '动态元素',
    'element': '普通元素'
  };
  return typeMap[type] || type || '未知类型';
}

// 格式化元素内容显示
function formatElementContent(content: any): string {
  if (!content) return '空内容';
  
  try {
    const contentObj = typeof content === 'object' ? content : JSON.parse(content);
    return contentObj.title || contentObj.label || '无标题';
  } catch {
    return String(content).substring(0, 30) + '...';
  }
}

onMounted(() => {
  // 初始化通信日志
  addCommunicationLog('System', '组件初始化完成，Textbox配置为元素容器');
  
  // 初始添加一个示例元素
  setTimeout(() => {
    addElementToTextbox();
  }, 1000);
});
</script>

<style scoped>
.object-communication-demo {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.demo-container {
  margin-bottom: 20px;
}

/* 控制按钮样式 */
.control-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 15px;
}

.control-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  background-color: #2196f3;
  color: white;
  transition: background-color 0.3s;
}

.control-button:hover {
  background-color: #1976d2;
}

.control-button.danger {
  background-color: #f44336;
}

.control-button.danger:hover {
  background-color: #d32f2f;
}

/* 状态卡片网格 */
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.status-card {
  padding: 15px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-card h4 {
  margin-top: 0;
  color: #333;
  font-size: 16px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.status-card p {
  margin: 8px 0;
  font-size: 14px;
}

.status-card strong {
  color: #666;
  margin-right: 5px;
}

/* 通信面板样式 */
.communication-panel {
  margin-top: 30px;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 10px;
  margin-top: 15px;
}

.log-entry {
  display: flex;
  align-items: center;
  margin: 5px 0;
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #999;
  font-size: 12px;
  margin-right: 10px;
  min-width: 80px;
}

.log-type {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-right: 10px;
  min-width: 60px;
  text-align: center;
}

.type-System {
  background-color: #e3f2fd;
  color: #1565c0;
}

.type-Textbox {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.type-Demo {
  background-color: #fff3e0;
  color: #ef6c00;
}

.type-Signal {
  background-color: #f3e5f5;
  color: #6a1b9a;
}

.log-message {
  color: #333;
  flex: 1;
}

/* 页面标题样式 */
h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 24px;
  text-align: center;
}

h3 {
  color: #555;
  margin-top: 30px;
  margin-bottom: 15px;
  font-size: 18px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

h4 {
  color: #666;
  margin-bottom: 10px;
  font-size: 16px;
}

/* 文本框演示区域 */
.textbox-demo {
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

/* 元素状态区域 */
.elements-status {
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}
</style>