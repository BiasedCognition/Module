import { ObjectBase } from "./object.ts";
import { tButton } from "./Button.ts";
import { Element } from "./textElement.ts";
import { VarElement } from "./varElement.ts";

// 元素类型联合
export type TextboxElement = Element | VarElement;

export class Textbox extends ObjectBase {
  /** 元素集合 */
  public elements: TextboxElement[] = [];
  
  /** 编辑模式: 'view' 或 'edit' */
  public mode: 'view' | 'edit' = 'view';
  
  /** 注释内容 */
  public comment: string = '';
  
  /** 操作按钮集合 */
  public actionButtons: tButton[] = [];
  
  /** 构造函数 */
  constructor() {
    super();
    this.type = 'textbox';
    this.initializeActionButtons();
  }
  
  /** 初始化操作按钮 */
  private initializeActionButtons(): void {
    // 创建模式切换按钮
    const modeButton = new tButton('切换模式', 'mode');
    modeButton.relate(this);
    
    // 存储按钮集合
    this.actionButtons = [modeButton];
  }
  
  /** 接收来自其他对象的信号（如按钮、元素等） */
  public receiveSignal(
    sender: ObjectBase,
    signal: string,
    data?: any
  ): void {
    // 处理模式切换信号
    if (signal === 'button_mode_click') {
      this.toggleMode();
      console.log(`文本框模式切换为: ${this.mode}`);
    }
    // 添加元素信号
    else if (signal === 'addElement' && data && data.element) {
      this.addElement(data.element);
      // 向发送者回复确认信号
      this.sendSignal(sender, 'elementAdded', { success: true, elementId: data.element.elementId });
    }
    // 移除元素信号
    else if (signal === 'removeElement' && data && data.elementId) {
      this.removeElement(data.elementId);
      // 向发送者回复确认信号
      this.sendSignal(sender, 'elementRemoved', { success: true, elementId: data.elementId });
    }
    // 处理获取元素信号
    else if (signal === 'getElements') {
      const elements = this.getElements();
      this.sendSignal(sender, 'elementsRetrieved', { elements: elements });
    }
    // 处理注释更新信号
    else if (signal === 'updateComment' && data && typeof data.comment === 'string') {
      // 处理注释更新信号
      this.setComment(data.comment);
      console.log(`文本框的注释已更新: ${this.comment}`);
    }
    // 处理内容更新信号
    else if (signal === 'updateContent' && typeof data.content !== 'undefined') {
      this.setContent(data.content);
      console.log(`文本框的内容已更新:`, this.content);
    }
  }
  
  /** 切换查看/编辑模式 */
  public toggleMode(): void {
    this.mode = this.mode === 'view' ? 'edit' : 'view';
  }
  
  /**
   * 添加元素到textbox
   * @param element 要添加的元素
   */
  public addElement(element: TextboxElement): void {
    // 添加到元素集合
    this.elements.push(element);
    
    // 与元素建立关联
    this.relate(element);
    
    console.log(`元素${element.elementId}已成功添加到textbox`);
    
    // 触发元素添加信号
    this.triggerLocalListeners('elementAdded', this, {
      element: element
    });
  }

  /**
   * 在指定元素位置进行拆分
   * @param target 要拆分的元素
    * @param beforeText 前半部分展示文本
   * @param afterText 后半部分展示文本
   * @returns 新创建的元素
   */
  public splitElement(target: TextboxElement, beforeText: string, afterText: string): Element | null {
    // varElement 不可分割
    if (target instanceof VarElement || (target as any).type === 'var-element') {
      console.warn('varElement 不可分割');
      return null;
    }
    const index = this.elements.findIndex(el => el === target);
    if (index === -1) return null;

    const normalizedBefore = beforeText ?? '';
    const normalizedAfter = afterText ?? '';
    const textColor = typeof target.getTextColor === 'function' ? target.getTextColor() : target.textColor;
    const backgroundColor = typeof target.getBackgroundColor === 'function' ? target.getBackgroundColor() : target.backgroundColor;
    const splittable = typeof target.getSplittable === 'function' ? target.getSplittable() : target.splittable ?? true;

    target.setDisplayText(normalizedBefore);
    target.setContent(normalizedBefore);
    if (typeof target.setTextColor === 'function') {
      target.setTextColor(textColor);
    } else {
      target.textColor = textColor;
    }
    if (typeof target.setBackgroundColor === 'function') {
      target.setBackgroundColor(backgroundColor);
    } else {
      target.backgroundColor = backgroundColor;
    }

    const newElement = new Element();
    newElement.setDisplayText(normalizedAfter);
    newElement.setContent(normalizedAfter);
    if (typeof newElement.setTextColor === 'function') {
      newElement.setTextColor(textColor);
    } else {
      newElement.textColor = textColor;
    }
    if (typeof newElement.setBackgroundColor === 'function') {
      newElement.setBackgroundColor(backgroundColor);
    } else {
      newElement.backgroundColor = backgroundColor;
    }
    // 继承原元素的可分割性
    if (typeof newElement.setSplittable === 'function') {
      newElement.setSplittable(splittable);
    } else {
      newElement.splittable = splittable;
    }

    this.relate(newElement);
    this.elements.splice(index + 1, 0, newElement);

    this.triggerLocalListeners('elementSplit', this, {
      originalElement: target,
      newElement,
      index,
    });

    console.log(`元素${target.elementId}已拆分，新元素${newElement.elementId}插入至索引${index + 1}`);

    return newElement;
  }
  
  /**
   * 从textbox移除元素
   * @param elementId 要移除的元素ID
   */
  public removeElement(elementId: string): void {
    const index = this.elements.findIndex(el => el.elementId === elementId);
    if (index !== -1) {
      const removedElement = this.elements[index];
      this.elements.splice(index, 1);
      
      // 解除关联
      this.unrelate(removedElement);
      
      console.log(`元素${elementId}已从textbox中移除`);
      
      // 触发元素移除信号
      this.triggerLocalListeners('elementRemoved', this, {
        elementId: elementId
      });
    }
  }
  
  /**
   * 合并两个元素
   * @param sourceElementId 源元素ID（被拖拽的元素）
   * @param targetElementId 目标元素ID（被拖到的元素）
   * @returns 是否成功合并
   */
  public mergeElements(sourceElementId: string, targetElementId: string): boolean {
    const sourceIndex = this.elements.findIndex(el => el.elementId === sourceElementId);
    const targetIndex = this.elements.findIndex(el => el.elementId === targetElementId);
    
    if (sourceIndex === -1 || targetIndex === -1) {
      console.warn(`无法找到要合并的元素: source=${sourceElementId}, target=${targetElementId}`);
      return false;
    }
    
    if (sourceIndex === targetIndex) {
      console.warn('源元素和目标元素相同，无法合并');
      return false;
    }
    
    const sourceElement = this.elements[sourceIndex];
    const targetElement = this.elements[targetIndex];

    if (
      (sourceElement instanceof VarElement) ||
      (targetElement instanceof VarElement) ||
      (sourceElement as any)?.type === 'var-element' ||
      (targetElement as any)?.type === 'var-element'
    ) {
      console.warn('varElement 不支持合并');
      return false;
    }
    
    // 获取两个元素的文本
    const sourceText = typeof sourceElement.getDisplayText === 'function' 
      ? sourceElement.getDisplayText() 
      : sourceElement.displayText || '';
    const targetText = typeof targetElement.getDisplayText === 'function'
      ? targetElement.getDisplayText()
      : targetElement.displayText || '';
    
    // 合并文本（源元素在前，目标元素在后）
    const mergedText = (sourceText + targetText).trim();
    
    // 更新目标元素的文本
    if (typeof targetElement.setDisplayText === 'function') {
      targetElement.setDisplayText(mergedText);
    } else {
      targetElement.displayText = mergedText;
    }
    
    if (typeof targetElement.setContent === 'function') {
      targetElement.setContent(mergedText);
    } else {
      targetElement.content = mergedText;
    }
    
    // 移除源元素
    this.elements.splice(sourceIndex, 1);
    this.unrelate(sourceElement);
    
    console.log(`元素${sourceElementId}已合并到元素${targetElementId}，合并后文本: ${mergedText}`);
    
    // 触发元素合并信号
    this.triggerLocalListeners('elementMerged', this, {
      sourceElementId,
      targetElementId,
      mergedText,
    });
    
    return true;
  }
  
  /**
   * 获取所有元素
   * @returns 元素数组
   */
  public getElements(): TextboxElement[] {
    return [...this.elements];
  }
  
  /**
   * 清空所有元素
   */
  public clearElements(): void {
    // 解除所有元素的关联
    for (const element of this.elements) {
      this.unrelate(element);
    }
    
    this.elements = [];
    console.log('textbox中的所有元素已清空');
    
    // 触发清空信号
    this.triggerLocalListeners('elementsCleared', this, {});
  }
  
  /** 获取操作按钮信息 */
  public getActionButtons(): Array<{ label: string; type: string; isActive: boolean }> {
    return this.actionButtons.map(button => ({
      label: button.label,
      type: button.type,
      isActive: button.isActive
    }));
  }
  
  /** 触发按钮点击事件 */
  public triggerButtonClick(buttonType: string): void {
    const button = this.actionButtons.find(btn => btn.type === buttonType);
    if (button) {
      button.click();
      // 获取活动对象列表并广播信号
      const activeObjects = [this];
      button.broadcastToRelatedActiveObjects(activeObjects);
    }
  }
}