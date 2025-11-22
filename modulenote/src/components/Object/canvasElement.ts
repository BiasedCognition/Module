import { ObjectBase } from "./object";

/**
 * 画布元素类
 * 提供可拖拽、可缩放的画布功能
 */
export class CanvasElement extends ObjectBase {
  /** 元素的唯一标识符 */
  public elementId: string = '';
  
  /** 画布宽度 */
  public canvasWidth: number = 800;
  
  /** 画布高度 */
  public canvasHeight: number = 600;
  
  /** 画布背景颜色 */
  public backgroundColor: string = '#ffffff';
  
  /** 画布边框颜色 */
  public borderColor: string = '#e5e7eb';
  
  /** 是否启用拖拽 */
  public draggable: boolean = true;
  
  /** 是否启用缩放 */
  public zoomable: boolean = true;
  
  /** 当前缩放级别 */
  public zoomLevel: number = 1;
  
  /** 当前平移位置 */
  public translateX: number = 0;
  public translateY: number = 0;
  
  /** 画布内容（可以存储 SVG 元素、图形等） */
  public canvasContent: any = null;
  
  /**
   * 构造函数
   * @param width 画布宽度
   * @param height 画布高度
   * @param position 在文本中的位置索引
   */
  constructor(width: number = 800, height: number = 600, position: number = 0) {
    super();
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.position = position;
    this.type = 'canvas-element';
    this.elementId = `canvasElement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.width = width;
    this.height = height;
  }
  
  /**
   * 设置画布尺寸
   */
  public setCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.width = width;
    this.height = height;
    this.triggerLocalListeners('canvasSizeChanged', this, {
      width,
      height,
    });
  }
  
  /**
   * 设置背景颜色
   */
  public setBackgroundColor(color: string): void {
    this.backgroundColor = color;
    this.triggerLocalListeners('backgroundColorChanged', this, {
      backgroundColor: color,
    });
  }
  
  /**
   * 设置缩放级别
   */
  public setZoomLevel(level: number): void {
    this.zoomLevel = Math.max(0.1, Math.min(5, level)); // 限制在 0.1 到 5 之间
    this.triggerLocalListeners('zoomChanged', this, {
      zoomLevel: this.zoomLevel,
    });
  }
  
  /**
   * 设置平移位置
   */
  public setTranslate(x: number, y: number): void {
    this.translateX = x;
    this.translateY = y;
    this.triggerLocalListeners('translateChanged', this, {
      translateX: x,
      translateY: y,
    });
  }
  
  /**
   * 重置视图（缩放和平移）
   */
  public resetView(): void {
    this.zoomLevel = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.triggerLocalListeners('viewReset', this, {});
  }
  
  /**
   * 接收来自其他对象的信号
   */
  public receiveSignal(
    sender: ObjectBase,
    signal: string,
    data?: any
  ): void {
    console.log(`canvasElement${this.elementId}收到信号: ${signal}`, data, `发送者: ${sender.constructor.name}`);
    
    // 处理更新画布尺寸的信号
    if (signal === 'updateCanvasSize' && data && typeof data.width === 'number' && typeof data.height === 'number') {
      this.setCanvasSize(data.width, data.height);
    }
    // 处理更新背景颜色的信号
    else if (signal === 'updateBackgroundColor' && data && typeof data.color === 'string') {
      this.setBackgroundColor(data.color);
    }
    // 处理更新缩放级别的信号
    else if (signal === 'updateZoomLevel' && data && typeof data.zoomLevel === 'number') {
      this.setZoomLevel(data.zoomLevel);
    }
    // 处理更新平移位置的信号
    else if (signal === 'updateTranslate' && data && typeof data.x === 'number' && typeof data.y === 'number') {
      this.setTranslate(data.x, data.y);
    }
    // 处理重置视图的信号
    else if (signal === 'resetView') {
      this.resetView();
    }
  }
  
  /**
   * 获取画布显示文本（用于在文本流中显示）
   */
  public getDisplayText(): string {
    return `[画布 ${this.canvasWidth}×${this.canvasHeight}]`;
  }
  
  /**
   * 获取元素的显示文本
   */
  public toString(): string {
    return this.getDisplayText();
  }
}


