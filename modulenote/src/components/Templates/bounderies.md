# 画布边界拖拽调整逻辑说明

## 当前实现逻辑

### 坐标系统
- 使用屏幕坐标（`clientX`, `clientY`）进行拖拽计算
- 记录初始状态：
  - `resizeStartX`, `resizeStartY`: 鼠标按下时的屏幕坐标
  - `resizeStartWidth`, `resizeStartHeight`: 画布初始宽度和高度
  - `resizeStartLeft`, `resizeStartTop`: 画布容器相对于父元素的初始位置

### 拖拽方向定义
- `n` (north): 上边缘
- `s` (south): 下边缘
- `w` (west): 左边缘
- `e` (east): 右边缘
- `nw`, `ne`, `sw`, `se`: 四个角落

### 当前各方向的逻辑

#### 上边缘 (n)
```javascript
newHeight = Math.max(100, resizeStartHeight.value - deltaY);
newTop = resizeStartTop.value + deltaY;
```
- **行为**: 向上拖拽时，高度增加，同时上边缘向上移动
- **问题**: 这会导致画布向上扩展，但左上角位置也会改变

#### 下边缘 (s)
```javascript
newHeight = Math.max(100, resizeStartHeight.value + deltaY);
// 位置不变
```
- **行为**: 向下拖拽时，高度增加，左上角位置不变
- **正确**: 这是期望的行为

#### 左边缘 (w)
```javascript
newWidth = Math.max(100, resizeStartWidth.value - deltaX);
// 位置不变（当前实现）
```
- **行为**: 向左拖拽时，宽度增加，左上角位置不变
- **问题**: 这会导致画布向左扩展，但左上角位置不变，意味着画布内容会向右移动

#### 右边缘 (e)
```javascript
newWidth = Math.max(100, resizeStartWidth.value + deltaX);
// 位置不变
```
- **行为**: 向右拖拽时，宽度增加，左上角位置不变
- **正确**: 这是期望的行为

## 问题分析

### 问题1: 左边缘和上边缘的逻辑不一致
- **上边缘**: 改变高度 + 改变位置（向上移动）
- **左边缘**: 只改变宽度，不改变位置

这导致：
- 拖拽上边缘时，画布向上扩展，左上角向上移动
- 拖拽左边缘时，画布向左扩展，但左上角位置不变（画布内容向右移动）

### 问题2: 期望的行为应该是
所有边缘拖拽时，应该保持**左上角固定**，只改变右下角的位置：
- **上边缘**: 向下拖拽 → 高度增加，左上角不变
- **下边缘**: 向下拖拽 → 高度增加，左上角不变
- **左边缘**: 向左拖拽 → 宽度增加，左上角不变
- **右边缘**: 向右拖拽 → 宽度增加，左上角不变

或者，如果用户希望**改变边界时能改变画布的位置**：
- **上边缘**: 向上拖拽 → 高度增加，同时左上角向上移动
- **下边缘**: 向下拖拽 → 高度增加，左上角不变
- **左边缘**: 向左拖拽 → 宽度增加，同时左上角向左移动
- **右边缘**: 向右拖拽 → 宽度增加，左上角不变

## 建议的修复方案

### 方案A: 保持左上角固定（推荐）
所有边缘拖拽时，左上角位置不变，只改变大小：

```javascript
// 上边缘 (n)
if (resizeDirection.value.includes('n')) {
  newHeight = Math.max(100, resizeStartHeight.value - deltaY);
  // 不改变 newTop，保持左上角位置不变
}

// 下边缘 (s)
if (resizeDirection.value.includes('s')) {
  newHeight = Math.max(100, resizeStartHeight.value + deltaY);
  // 位置不变
}

// 左边缘 (w)
if (resizeDirection.value.includes('w')) {
  newWidth = Math.max(100, resizeStartWidth.value - deltaX);
  // 不改变 newLeft，保持左上角位置不变
}

// 右边缘 (e)
if (resizeDirection.value.includes('e')) {
  newWidth = Math.max(100, resizeStartWidth.value + deltaX);
  // 位置不变
}
```

### 方案B: 对称行为（上/左改变位置，下/右不改变）
上边缘和左边缘拖拽时改变位置，下边缘和右边缘不改变：

```javascript
// 上边缘 (n) - 改变位置
if (resizeDirection.value.includes('n')) {
  newHeight = Math.max(100, resizeStartHeight.value - deltaY);
  newTop = resizeStartTop.value + deltaY;
}

// 下边缘 (s) - 不改变位置
if (resizeDirection.value.includes('s')) {
  newHeight = Math.max(100, resizeStartHeight.value + deltaY);
}

// 左边缘 (w) - 改变位置
if (resizeDirection.value.includes('w')) {
  newWidth = Math.max(100, resizeStartWidth.value - deltaX);
  newLeft = resizeStartLeft.value + deltaX;
}

// 右边缘 (e) - 不改变位置
if (resizeDirection.value.includes('e')) {
  newWidth = Math.max(100, resizeStartWidth.value + deltaX);
}
```

## 角落拖拽逻辑

角落拖拽应该同时处理两个方向：

```javascript
// 左上角 (nw)
if (resizeDirection.value === 'nw') {
  newWidth = Math.max(100, resizeStartWidth.value - deltaX);
  newHeight = Math.max(100, resizeStartHeight.value - deltaY);
  // 根据选择的方案决定是否改变位置
}

// 其他角落类似...
```

## 当前代码位置
- 文件: `modulenote/src/components/Templates/CanvasElement.vue`
- 函数: `handleMouseMove` (约第318行)
- 函数: `startResize` (约第290行)


