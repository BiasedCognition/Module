/**
 * 网格对齐工具函数
 * 用于将元素的位置和尺寸对齐到网格点
 */

// 网格大小（与 App.vue 中的背景网格保持一致）
export const GRID_SIZE = 28;

/**
 * 将数值对齐到最近的网格点
 * @param value 要对齐的数值
 * @param gridSize 网格大小，默认为 GRID_SIZE
 * @returns 对齐后的数值
 */
export function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * 将位置对象对齐到网格
 * @param position 位置对象 {x, y}
 * @param gridSize 网格大小，默认为 GRID_SIZE
 * @returns 对齐后的位置对象
 */
export function snapPositionToGrid(
  position: { x: number; y: number },
  gridSize: number = GRID_SIZE
): { x: number; y: number } {
  return {
    x: snapToGrid(position.x, gridSize),
    y: snapToGrid(position.y, gridSize)
  };
}

/**
 * 将尺寸对象对齐到网格
 * @param size 尺寸对象 {width, height}
 * @param gridSize 网格大小，默认为 GRID_SIZE
 * @param minSize 最小尺寸，默认为一个网格单位
 * @returns 对齐后的尺寸对象
 */
export function snapSizeToGrid(
  size: { width: number; height: number },
  gridSize: number = GRID_SIZE,
  minSize: number = gridSize
): { width: number; height: number } {
  return {
    width: Math.max(snapToGrid(size.width, gridSize), minSize),
    height: Math.max(snapToGrid(size.height, gridSize), minSize)
  };
}

/**
 * 将矩形区域对齐到网格
 * @param rect 矩形区域 {x, y, width, height}
 * @param gridSize 网格大小，默认为 GRID_SIZE
 * @param minSize 最小尺寸，默认为一个网格单位
 * @returns 对齐后的矩形区域
 */
export function snapRectToGrid(
  rect: { x: number; y: number; width: number; height: number },
  gridSize: number = GRID_SIZE,
  minSize: number = gridSize
): { x: number; y: number; width: number; height: number } {
  const position = snapPositionToGrid({ x: rect.x, y: rect.y }, gridSize);
  const size = snapSizeToGrid({ width: rect.width, height: rect.height }, gridSize, minSize);
  
  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height
  };
}

/**
 * 获取网格线位置数组
 * @param containerSize 容器尺寸 {width, height}
 * @param gridSize 网格大小，默认为 GRID_SIZE
 * @returns 网格线位置对象 {vertical: number[], horizontal: number[]}
 */
export function getGridLines(
  containerSize: { width: number; height: number },
  gridSize: number = GRID_SIZE
): { vertical: number[]; horizontal: number[] } {
  const vertical: number[] = [];
  const horizontal: number[] = [];
  
  // 垂直网格线
  for (let x = 0; x <= containerSize.width; x += gridSize) {
    vertical.push(x);
  }
  
  // 水平网格线
  for (let y = 0; y <= containerSize.height; y += gridSize) {
    horizontal.push(y);
  }
  
  return { vertical, horizontal };
}

/**
 * 检查一个点是否在网格点上
 * @param point 点坐标 {x, y}
 * @param gridSize 网格大小，默认为 GRID_SIZE
 * @param tolerance 容差，默认为 1 像素
 * @returns 是否在网格点上
 */
export function isOnGrid(
  point: { x: number; y: number },
  gridSize: number = GRID_SIZE,
  tolerance: number = 1
): boolean {
  const snappedPoint = snapPositionToGrid(point, gridSize);
  return (
    Math.abs(point.x - snappedPoint.x) <= tolerance &&
    Math.abs(point.y - snappedPoint.y) <= tolerance
  );
}

/**
 * 计算拖拽时的网格对齐偏移量
 * @param currentPos 当前位置
 * @param targetPos 目标位置
 * @param gridSize 网格大小，默认为 GRID_SIZE
 * @returns 对齐后的偏移量
 */
export function getGridAlignedOffset(
  currentPos: { x: number; y: number },
  targetPos: { x: number; y: number },
  gridSize: number = GRID_SIZE
): { x: number; y: number } {
  const snappedTarget = snapPositionToGrid(targetPos, gridSize);
  return {
    x: snappedTarget.x - currentPos.x,
    y: snappedTarget.y - currentPos.y
  };
}





