import { ObjectBase } from "./object";

export class TextElement extends ObjectBase {
  /** 在文本中的位置索引 */
  public position: number = 0;
  
  /** 元素在文本中的显示文本 */
  public displayText: string = '';

  /** 文本颜色 */
  public textColor: string = '#1f2937';
  
  /** 元素的唯一标识符 */
  public elementId: string = '';
  
  /**
   * 构造函数
   * @param content 元素的内容
   * @param displayText 元素在文本中的显示文本
   * @param position 在文本中的位置索引
   */
  constructor(content: any = {}, displayText: string = '', position: number = 0) {
    super();
    this.setContent(content);
    this.displayText = displayText;
    this.position = position;
    this.type = 'text-element';
    this.elementId = `textElement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 接收来自其他对象的信号
   * @param sender 发送者
   * @param signal 信号名称
   * @param data 附加数据
   */
  public receiveSignal(
    sender: ObjectBase,
    signal: string,
    data?: any
  ): void {
    console.log(`元素${this.elementId}收到信号: ${signal}`, data, `发送者: ${sender.constructor.name}`);
    
    // 处理更新值的信号
    if (signal === 'updateValue' && data && typeof data.value !== 'undefined') {
      this.setContent(data.value);
    }
    // 处理更新显示文本的信号
    else if (signal === 'updateDisplayText' && data && typeof data.displayText === 'string') {
      this.displayText = data.displayText;
      console.log(`元素显示文本已更新为: ${this.displayText}`);
      // 向发送者发送更新确认信号
      this.sendSignal(sender, 'displayTextUpdated', { elementId: this.elementId, displayText: this.displayText });
    }
    // 处理更新位置的信号
    else if (signal === 'updatePosition' && data && typeof data.position === 'number') {
      this.position = data.position;
      console.log(`元素位置已更新为: ${this.position}`);
    }
    // 处理获取值的信号
    else if (signal === 'getValue') {
      this.sendSignal(sender, 'valueRetrieved', { elementId: this.elementId, value: this.getContent() });
    } else if (signal === 'updateComment' && data && typeof data.comment === 'string') {
      this.setComment(data.comment);
      console.log(`元素${this.elementId}的注释已更新: ${this.comment}`);
    } else if (signal === 'updateContent' && typeof data.content !== 'undefined') {
      // 处理内容更新信号
      this.setContent(data.content);
      console.log(`元素${this.elementId}的内容已更新:`, this.content);
    }
  }
  
  /**
   * 更新元素的内容
   * @param newContent 新的内容
   */
  public updateContent(newContent: any): void {
    this.setContent(newContent);
    console.log(`元素内容已更新:`, this.getContent());
    // 触发内容更新信号
    this.triggerLocalListeners('contentUpdated', this, { elementId: this.elementId, content: this.getContent() });
  }
  
  /**
   * 获取元素的内容
   * @returns 元素的内容
   */
  public getValue(): any {
    return this.getContent();
  }
  
  /**
   * 获取元素在文本中的表示
   * @returns 元素的显示文本
   */
  public toString(): string {
    return this.displayText;
  }
  
  /**
   * 与textbox建立关联并嵌入到指定位置
   * @param textbox 要关联的textbox
   * @param position 要嵌入的位置索引
   */
  public embedInTextbox(textbox: any, position?: number): void {
    if (position !== undefined) {
      this.position = position;
    }
    
    // 与textbox建立关联
    this.relate(textbox);
    
    // 向textbox发送嵌入信号
    this.sendSignal(textbox, 'embedElement', {
      element: this,
      position: this.position,
      displayText: this.displayText
    });
    
    console.log(`元素${this.elementId}已尝试嵌入到textbox的位置${this.position}`);
  }
  
  /**
   * 从textbox中移除元素
   * @param textbox 要移除的textbox
   */
  public removeFromTextbox(textbox: any): void {
    // 向textbox发送移除信号
    this.sendSignal(textbox, 'removeElement', {
      elementId: this.elementId,
      position: this.position
    });
    
    // 解除关联
    this.unrelate(textbox);
    
    console.log(`元素${this.elementId}已尝试从textbox中移除`);
  }
  
  /**
   * 移动元素在文本中的位置
   * @param newPosition 新的位置索引
   * @param textbox 关联的textbox
   */
  public moveToPosition(newPosition: number, textbox: any): void {
    const oldPosition = this.position;
    this.position = newPosition;
    
    // 向textbox发送移动信号
    this.sendSignal(textbox, 'moveElement', {
      elementId: this.elementId,
      oldPosition: oldPosition,
      newPosition: newPosition
    });
    
    console.log(`元素${this.elementId}已移动从位置${oldPosition}到${newPosition}`);
  }

  /**
   * 设置文本颜色
   * @param color 颜色值
   */
  public setTextColor(color: string): void {
    this.textColor = color;
    this.triggerLocalListeners('colorUpdated', this, {
      elementId: this.elementId,
      color: this.textColor,
    });
  }

  /**
   * 获取文本颜色
   */
  public getTextColor(): string {
    return this.textColor;
  }

  /**
   * 更新元素的展示文本
   * @param text 展示文本
   */
  public setDisplayText(text: string): void {
    this.displayText = text;
    this.triggerLocalListeners('displayTextUpdated', this, {
      elementId: this.elementId,
      displayText: this.displayText,
    });
  }
}

// 兼容导出
export { TextElement as Element };



