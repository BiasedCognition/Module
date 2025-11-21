import { ObjectBase } from "./object";

export class VarElement extends ObjectBase {
  /** 在文本中的位置索引 */
  public position: number = 0;
  
  /** 元素在文本中的显示文本（对象的名称） */
  public displayText: string = '';

  /** 文本颜色 */
  public textColor: string = '#1f2937';

  /** 背景颜色，默认为深灰色 */
  public backgroundColor: string = '#e5e7eb';

  /** 是否可分割，varElement 永远不可分割 */
  public readonly splittable: boolean = false;
  
  /** 元素的唯一标识符 */
  public elementId: string = '';

  /** 关联的对象（varElement 的内容） */
  public targetObject: ObjectBase | null = null;

  /** 对象的类型（用于悬浮显示） */
  public objectType: string = '';

  /** 对象的元素列表（如果只有一个元素，则视为变量） */
  public objectElements: ObjectBase[] = [];
  
  /**
   * 构造函数
   * @param targetObject 关联的对象
   * @param displayText 元素在文本中的显示文本（对象的名称）
   * @param position 在文本中的位置索引
   */
  constructor(targetObject: ObjectBase | null = null, displayText: string = '', position: number = 0) {
    super();
    this.targetObject = targetObject;
    this.displayText = displayText || (targetObject ? this.getObjectName(targetObject) : '');
    this.position = position;
    this.type = 'var-element';
    this.elementId = `varElement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 设置内容为对象
    if (targetObject) {
      this.setContent(targetObject);
      this.objectType = this.determineObjectType(targetObject);
      this.updateObjectElements();
    } else {
      // 如果没有目标对象，类型为 NULL
      this.objectType = 'NULL';
      this.objectElements = [];
    }
  }

  /**
   * 获取对象的名称
   */
  private getObjectName(obj: ObjectBase): string {
    // 尝试获取对象的名称属性
    if ((obj as any).name) {
      return (obj as any).name;
    }
    if ((obj as any).displayText) {
      return (obj as any).displayText;
    }
    if ((obj as any).id) {
      return (obj as any).id;
    }
    return obj.type || '未命名对象';
  }

  /**
   * 确定对象的类型
   */
  private determineObjectType(obj: ObjectBase): string {
    // 如果对象有 elements 属性（如 textbox），检查元素数量
    if ((obj as any).elements && Array.isArray((obj as any).elements)) {
      const elements = (obj as any).elements;
      if (elements.length === 1) {
        return '变量';
      } else if (elements.length > 1) {
        return '对象';
      }
    }
    
    // 根据对象的类型返回
    if (obj.type === 'textbox') {
      return '文本框';
    }
    
    return obj.type || '对象';
  }

  /**
   * 更新对象的元素列表
   */
  public updateObjectElements(): void {
    if (!this.targetObject) {
      this.objectElements = [];
      this.objectType = '';
      return;
    }

    // 如果对象有 elements 属性，获取元素列表
    if ((this.targetObject as any).elements && Array.isArray((this.targetObject as any).elements)) {
      this.objectElements = [...(this.targetObject as any).elements];
    } else {
      this.objectElements = [];
    }

    // 更新类型
    this.objectType = this.determineObjectType(this.targetObject);
  }

  /**
   * 为对象添加元素
   */
  public addElementToObject(element: ObjectBase): void {
    if (!this.targetObject) return;

    // 如果对象有 addElement 方法，使用它
    if (typeof (this.targetObject as any).addElement === 'function') {
      (this.targetObject as any).addElement(element);
    } else if ((this.targetObject as any).elements && Array.isArray((this.targetObject as any).elements)) {
      (this.targetObject as any).elements.push(element);
    }

    this.updateObjectElements();
  }

  /**
   * 从对象移除元素
   */
  public removeElementFromObject(elementId: string): void {
    if (!this.targetObject) return;

    // 如果对象有 removeElement 方法，使用它
    if (typeof (this.targetObject as any).removeElement === 'function') {
      (this.targetObject as any).removeElement(elementId);
    } else if ((this.targetObject as any).elements && Array.isArray((this.targetObject as any).elements)) {
      const index = (this.targetObject as any).elements.findIndex((el: any) => 
        (el.elementId === elementId || el.id === elementId)
      );
      if (index !== -1) {
        (this.targetObject as any).elements.splice(index, 1);
      }
    }

    this.updateObjectElements();
  }
  
  /**
   * 覆写 setContent，确保内容始终为对象
   */
  public override setContent(content: any): void {
    if (!content || typeof content !== 'object') {
      console.warn('VarElement 的内容必须是对象');
      return;
    }
    const target = content as ObjectBase;
    this.targetObject = target;
    super.setContent(target);
    this.displayText = this.getObjectName(target);
    this.objectType = this.determineObjectType(target);
    this.updateObjectElements();
  }
  
  /**
   * 接收来自其他对象的信号
   */
  public receiveSignal(
    sender: ObjectBase,
    signal: string,
    data?: any
  ): void {
    console.log(`varElement${this.elementId}收到信号: ${signal}`, data, `发送者: ${sender.constructor.name}`);
    
    // 处理更新显示文本的信号
    if (signal === 'updateDisplayText' && data && typeof data.displayText === 'string') {
      this.displayText = data.displayText;
      console.log(`varElement显示文本已更新为: ${this.displayText}`);
      this.sendSignal(sender, 'displayTextUpdated', { elementId: this.elementId, displayText: this.displayText });
    }
    // 处理更新位置的信号
    else if (signal === 'updatePosition' && data && typeof data.position === 'number') {
      this.position = data.position;
      console.log(`varElement位置已更新为: ${this.position}`);
    }
    // 处理更新对象的信号
    else if (signal === 'updateTargetObject' && data && data.targetObject) {
      this.targetObject = data.targetObject;
      this.setContent(this.targetObject);
      this.displayText = this.getObjectName(this.targetObject);
      this.updateObjectElements();
      console.log(`varElement关联对象已更新`);
    }
    // 处理添加元素到对象的信号
    else if (signal === 'addElementToObject' && data && data.element) {
      this.addElementToObject(data.element);
      console.log(`已为varElement的对象添加元素`);
    }
    // 处理从对象移除元素的信号
    else if (signal === 'removeElementFromObject' && data && data.elementId) {
      this.removeElementFromObject(data.elementId);
      console.log(`已从varElement的对象移除元素`);
    }
  }
  
  /**
   * 更新元素的展示文本
   */
  public setDisplayText(text: string): void {
    this.displayText = text;
    this.triggerLocalListeners('displayTextUpdated', this, {
      elementId: this.elementId,
      displayText: this.displayText,
    });
  }

  /**
   * 设置文本颜色
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
   * 设置背景颜色
   */
  public setBackgroundColor(color: string): void {
    this.backgroundColor = color;
    this.triggerLocalListeners('backgroundColorUpdated', this, {
      elementId: this.elementId,
      backgroundColor: this.backgroundColor,
    });
  }

  /**
   * 获取背景颜色
   */
  public getBackgroundColor(): string {
    return this.backgroundColor;
  }

  /**
   * 获取可分割性（varElement 永远不可分割）
   */
  public getSplittable(): boolean {
    return false;
  }

  /**
   * 获取元素的显示文本
   */
  public toString(): string {
    return this.displayText;
  }
}

