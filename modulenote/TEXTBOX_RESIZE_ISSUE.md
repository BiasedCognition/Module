# Textbox 编辑模式调整大小问题分析

## 问题描述

在 Textbox 切换到编辑模式后，虽然可以看到调整大小手柄（鼠标悬停时显示对应的箭头样式），但无法通过拖拽手柄来改变 Textbox 的大小。

## 当前代码状态

### 1. 模板部分（Template）

**手柄定义**（第 87-127 行）：
- ✅ 8 个调整大小手柄已正确定义
- ✅ 使用 `v-if="currentMode === 'edit'"` 控制显示
- ✅ 使用 `@mousedown.stop="startResize($event, 'direction')` 绑定事件
- ✅ 事件使用 `.stop` 修饰符阻止冒泡

**手柄位置**：
- 上边缘（n）、下边缘（s）、左边缘（w）、右边缘（e）
- 四个角：左上（nw）、右上（ne）、左下（sw）、右下（se）

### 2. 事件处理函数

#### `startResize` 函数（第 763-801 行）

**当前实现**：
```typescript
function startResize(event: MouseEvent, direction: string) {
  event.preventDefault();
  event.stopPropagation();
  
  if (!wrapperRef.value || !textboxInstance.value) return;
  
  isResizing.value = true;
  resizeDirection.value = direction;
  resizeStartX.value = event.clientX;
  resizeStartY.value = event.clientY;
  
  // 从 DOM 获取实际尺寸
  const rect = wrapperRef.value.getBoundingClientRect();
  resizeStartWidth.value = rect.width;
  resizeStartHeight.value = rect.height;
  
  // 获取位置...
  // 设置 cursor...
}
```

**状态**：
- ✅ 正确设置 `isResizing.value = true`
- ✅ 正确记录初始位置和尺寸
- ✅ 正确阻止默认行为和事件冒泡

#### `handleMouseMove` 函数（第 803-876 行）

**当前实现**：
```typescript
function handleMouseMove(event: MouseEvent) {
  // 优先处理调整大小
  if (isResizing.value && wrapperRef.value && textboxInstance.value) {
    // 计算新的尺寸和位置
    // 对齐到网格
    // 更新 DOM 样式和对象属性
    return;
  }
  
  // 处理拖拽
  if (isDragging.value && wrapperRef.value) {
    // ...
    return;
  }
}
```

**状态**：
- ✅ 调整大小逻辑优先于拖拽逻辑
- ✅ 正确检查 `isResizing.value`
- ✅ 正确更新 DOM 样式和对象属性

#### `handleMouseUp` 函数（第 878-923 行）

**当前实现**：
```typescript
function handleMouseUp(event: MouseEvent) {
  // 处理拖拽结束
  if (isDragging.value) {
    // ...
  }
  
  // 处理调整大小结束
  if (isResizing.value) {
    isResizing.value = false;
    resizeDirection.value = '';
    // 保存位置和尺寸...
  }
}
```

**状态**：
- ✅ 正确重置 `isResizing.value`
- ✅ 正确保存最终位置和尺寸

### 3. 事件监听器绑定

**onMounted**（第 221-245 行）：
```typescript
onMounted(() => {
  // ...
  // 添加全局鼠标事件监听
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  // ...
});
```

**状态**：
- ✅ 正确绑定到 `document`
- ✅ 在 `onUnmounted` 中正确移除

### 4. 样式定义

**编辑模式样式**（第 1265-1276 行）：
```css
.edit-mode .textbox-wrapper {
  cursor: default !important;
  overflow: visible !important; /* 显示调整大小手柄 */
}
```

**手柄样式**（第 1278-1365 行）：
```css
.resize-handle {
  position: absolute;
  background-color: rgba(59, 130, 246, 0.8) !important;
  border: 2px solid rgba(59, 130, 246, 1) !important;
  z-index: 9999 !important;
  pointer-events: auto !important;
  /* ... */
}
```

**状态**：
- ✅ `overflow: visible` 确保手柄可见
- ✅ `z-index: 9999` 确保手柄在最上层
- ✅ `pointer-events: auto` 确保手柄可点击

## 可能的问题原因

### 1. 事件被其他元素拦截

**可能原因**：
- `textbox-content` 或其他子元素可能覆盖了手柄
- 其他事件监听器可能阻止了事件传播

**检查点**：
- 检查 `textbox-content` 的 `z-index` 和 `pointer-events`
- 检查是否有其他全局事件监听器

### 2. `currentMode` 未正确更新

**可能原因**：
- `currentMode.value` 可能没有正确同步到 `'edit'`
- 手柄的 `v-if` 条件可能不满足

**检查点**：
- 确认编辑模式下 `currentMode.value === 'edit'` 为 `true`
- 检查手柄是否实际渲染到 DOM 中

### 3. `startResize` 函数未被执行

**可能原因**：
- 事件绑定可能有问题
- 事件可能被其他处理函数拦截

**检查点**：
- 在 `startResize` 函数开头添加 `console.log` 确认是否被调用
- 检查是否有其他 `mousedown` 事件监听器

### 4. `isResizing` 状态未正确设置

**可能原因**：
- `isResizing.value` 可能在某个地方被重置
- 响应式系统可能有问题

**检查点**：
- 在 `startResize` 中确认 `isResizing.value` 被设置为 `true`
- 在 `handleMouseMove` 中确认 `isResizing.value` 仍为 `true`

### 5. DOM 样式更新被覆盖

**可能原因**：
- 其他代码可能在更新样式时覆盖了调整大小的结果
- 计算属性或 watch 可能在重置样式

**检查点**：
- 检查是否有 watch 监听器在重置样式
- 检查是否有其他函数在更新 `wrapperRef.value.style`

## 与 CanvasElement 的对比

### CanvasElement 的实现

**关键差异点**：
1. CanvasElement 使用 `canvasContainer` 作为容器
2. CanvasElement 的手柄直接绑定在容器上
3. CanvasElement 的 resize 逻辑与 Textbox 基本相同

**需要检查**：
- CanvasElement 是否有特殊的样式设置
- CanvasElement 的事件绑定方式是否有不同

## 建议的调试步骤

1. **添加调试日志**：
   ```typescript
   function startResize(event: MouseEvent, direction: string) {
     console.log('startResize called', direction, currentMode.value);
     // ...
   }
   
   function handleMouseMove(event: MouseEvent) {
     if (isResizing.value) {
       console.log('resizing', resizeDirection.value);
     }
     // ...
   }
   ```

2. **检查 DOM 结构**：
   - 在浏览器开发者工具中检查手柄是否实际渲染
   - 检查手柄的 `z-index` 和 `pointer-events` 计算值

3. **检查事件流**：
   - 在浏览器开发者工具的事件监听器中检查是否有其他监听器
   - 检查事件是否被阻止或停止传播

4. **检查响应式状态**：
   - 在 Vue DevTools 中检查 `isResizing` 的值
   - 检查 `currentMode` 的值

## 新发现的问题

### `textbox-content` 可能影响手柄定位

**发现**（第 1088-1091 行）：
```css
.textbox-content {
  position: relative;
  min-height: 150px;
}
```

**可能影响**：
- `position: relative` 可能影响手柄的绝对定位
- 如果 `textbox-content` 的 `z-index` 高于手柄，可能会覆盖手柄

**需要检查**：
- `textbox-content` 的 `z-index` 值
- 手柄是否在 `textbox-wrapper` 内部正确渲染
- 手柄的定位是否相对于 `textbox-wrapper` 而不是 `textbox-content`

### 手柄的 DOM 位置

**当前结构**：
```
textbox-wrapper
  ├── textbox-toolbar
  ├── textbox-content (position: relative)
  │   └── elements-container
  └── resize-handle (position: absolute, 相对于 textbox-wrapper)
```

**可能问题**：
- 如果手柄在 `textbox-content` 之后渲染，但 `textbox-content` 有较高的 `z-index`，可能会覆盖手柄
- 需要确认手柄的 `z-index` 是否足够高

## 下一步行动

1. **添加详细的调试日志**：
   - 在 `startResize` 函数开头添加 `console.log`
   - 在 `handleMouseMove` 中添加日志确认是否进入调整大小分支
   - 检查 `isResizing.value` 的值

2. **检查 DOM 结构**：
   - 在浏览器开发者工具中检查手柄是否实际渲染
   - 检查手柄的 `z-index` 和 `pointer-events` 计算值
   - 检查是否有其他元素覆盖了手柄

3. **检查事件流**：
   - 在浏览器开发者工具的事件监听器中检查是否有其他监听器
   - 检查事件是否被阻止或停止传播
   - 确认 `mousedown` 事件是否真的触发了 `startResize`

4. **对比 CanvasElement**：
   - 检查 CanvasElement 的 DOM 结构
   - 检查 CanvasElement 的样式设置
   - 找出与 Textbox 的关键差异

5. **测试响应式状态**：
   - 在 Vue DevTools 中检查 `isResizing` 的值
   - 检查 `currentMode` 的值
   - 确认状态是否正确更新

## 建议的快速修复尝试

1. **确保手柄在最上层**：
   ```css
   .resize-handle {
     z-index: 99999 !important; /* 增加到更高的值 */
   }
   ```

2. **确保 textbox-content 不覆盖手柄**：
   ```css
   .textbox-content {
     position: relative;
     z-index: 1; /* 确保低于手柄 */
   }
   ```

3. **添加调试日志**：
   ```typescript
   function startResize(event: MouseEvent, direction: string) {
     console.log('🔵 startResize called', {
       direction,
       currentMode: currentMode.value,
       isResizing: isResizing.value,
       wrapperRef: !!wrapperRef.value,
       textboxInstance: !!textboxInstance.value
     });
     // ...
   }
   ```

