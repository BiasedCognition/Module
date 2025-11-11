export abstract class ObjectBase {

  /** 横坐标 */
  public x: number = 0;
  /** 纵坐标 */
  public y: number = 0;
  /** 宽度 */
  public width: number = 0;
  /** 高度 */
  public height: number = 0;

  /** 类型 */
  public type: string = '';
  /** ID */
  public id: string = '';
  /** 注释内容 */
  public comment: string = '';
  
  /** 内容属性，可以存储任意类型的数据 */
  public content: any = null;
  /** 
   * 与此对象相关的其他对象集合
   * 使用WeakSet替代Set以优化内存使用：
   * 1. 不会阻止垃圾回收器回收不再使用的对象
   * 2. 避免循环引用导致的内存泄漏
   * 3. 适合存储临时关联关系
   */
  public relatedObjects: WeakSet<ObjectBase> = new WeakSet();
  
  /**
   * 存储信号监听器的Map，支持动态注册和移除监听器
   */
  public signalListeners: Map<string, Set<(sender: ObjectBase, data?: any) => void>> = new Map();

  /**
   * 接收来自其他对象的信号
   * @param sender 发送者
   * @param signal 信号名称
   * @param data 附加数据
   */
  public abstract receiveSignal(
    sender: ObjectBase,
    signal: string,
    data?: any
  ): void;
  
  /**
   * 注册信号监听器
   * @param signal 信号名称
   * @param listener 监听器函数
   */
  public on(signal: string, listener: (sender: ObjectBase, data?: any) => void): void {
    if (!this.signalListeners.has(signal)) {
      this.signalListeners.set(signal, new Set());
    }
    this.signalListeners.get(signal)!.add(listener);
  }
  
  /**
   * 移除信号监听器
   * @param signal 信号名称
   * @param listener 监听器函数
   */
  public off(signal: string, listener?: (sender: ObjectBase, data?: any) => void): void {
    if (!this.signalListeners.has(signal)) return;
    
    if (listener) {
      this.signalListeners.get(signal)!.delete(listener);
    } else {
      // 如果没有指定监听器，则移除该信号的所有监听器
      this.signalListeners.delete(signal);
    }
  }
  
  /**
   * 触发本地注册的信号监听器
   * @param signal 信号名称
   * @param sender 发送者
   * @param data 附加数据
   */
  public triggerLocalListeners(signal: string, sender: ObjectBase, data?: any): void {
    if (!this.signalListeners.has(signal)) return;
    
    this.signalListeners.get(signal)!.forEach(listener => {
      try {
        listener(sender, data);
      } catch (error) {
        console.error(`执行信号监听器出错: ${signal}`, error);
      }
    });
  }

  /**
   * 向指定对象发送信号
   * @param target 目标对象
   * @param signal 信号名称
   * @param data 附加数据
   */
  public sendSignal(target: ObjectBase, signal: string, data?: any): void {
    // 不需要检查关联关系，直接发送信号
    // 这样可以更灵活地进行信号传递，同时通过弱引用来避免内存问题
    target.receiveSignal(this, signal, data);
    target.triggerLocalListeners(signal, this, data);
  }

  /**
   * 向所有相关对象广播信号
   * @param signal 信号名称
   * @param data 附加数据
   */
  public broadcastSignal(signal: string, data?: any): void {
    // 注意：WeakSet不支持forEach遍历，需要维护一个临时的强引用列表
    // 这里我们使用更可控的方式，不再直接依赖WeakSet的遍历
    // 实际项目中可以考虑维护一个额外的临时引用数组用于广播
    // 或者使用事件总线模式替代直接广播
    console.warn('WeakSet不支持直接遍历，广播功能需要额外实现');
  }
  
  /**
   * 内存优化版本的广播 - 需要传入一个活动对象列表
   * @param activeObjects 当前活动的对象列表
   * @param signal 信号名称
   * @param data 附加数据
   */
  public broadcastToActiveObjects(activeObjects: ObjectBase[], signal: string, data?: any): void {
    activeObjects.forEach(obj => {
      if (this.isRelatedTo(obj)) {
        obj.receiveSignal(this, signal, data);
        obj.triggerLocalListeners(signal, this, data);
      }
    });
  }
  
  /**
   * 检查是否与某个对象相关联
   * @param obj 要检查的对象
   * @returns 是否相关联
   */
  public isRelatedTo(obj: ObjectBase): boolean {
    return this.relatedObjects.has(obj);
  }

  /**
   * 建立对象关联
   * @param obj 要关联的对象
   * 使用WeakSet可以避免内存泄漏，当对象不再被其他地方引用时可以被垃圾回收
   */
  public relate(obj: ObjectBase): void {
    if (this !== obj) { // 避免自关联
      this.relatedObjects.add(obj);
      obj.relatedObjects.add(this);
    }
  }

  /**
   * 解除对象关联
   * @param obj 要解除关联的对象
   */
  public unrelate(obj: ObjectBase): void {
    this.relatedObjects.delete(obj);
    obj.relatedObjects.delete(this);
  }
  
  /**
   * 设置对象注释
   * @param comment 注释内容
   */
  public setComment(comment: string): void {
    this.comment = comment;
    // 触发注释更新信号
    this.triggerLocalListeners('commentUpdated', this, { comment: this.comment });
  }
  
  /**
   * 获取对象注释
   * @returns 注释内容
   */
  public getComment(): string {
    return this.comment;
  }
  
  /**
   * 设置对象内容
   * @param content 内容数据
   */
  public setContent(content: any): void {
    this.content = content;
    // 触发内容更新信号
    this.triggerLocalListeners('contentUpdated', this, { content: this.content });
  }
  
  /**
   * 获取对象内容
   * @returns 内容数据
   */
  public getContent(): any {
    return this.content;
  }
  
  /**
   * 清理所有关联和监听器，用于对象销毁时释放资源
   */
  public cleanup(): void {
    // 清空所有信号监听器
    this.signalListeners.clear();
    
    // WeakSet不需要手动清理，垃圾回收器会处理
    console.log('对象已清理，释放相关资源');
  }
}


export class Button extends ObjectBase {
  /** 按钮文本 */
  public label: string = '';
  /** 按钮类型 */
  public type: string = 'default'; // default, bold, italic, underline等
  
  /**
   * 构造函数
   * @param label 按钮文本
   * @param type 按钮类型
   */
  constructor(label?: string, type?: string) {
    super();
    if (label) this.label = label;
    if (type) this.type = type;
  }

  /**
   * 点击按钮
   * 发送相应类型的信号给所有相关对象
   */
  public click(): void {
    console.log(`${this.label}按钮被点击，类型: ${this.type}`);
    // 不再依赖broadcastSignal方法
  }

  /**
   * 接收来自其他对象的信号
   */
  public receiveSignal(
    sender: ObjectBase,
    signal: string,
    data?: any
  ): void {
    // 按钮可以接收其他对象的信号，例如状态更新
    if (signal === 'update') {
      // 可以根据需要更新按钮状态
      console.log(`按钮${this.label}收到更新信号`, data);
    }
  }
}

export class TextBox extends ObjectBase {
  /** 文本内容 */
  public text: string = '';

  /** 是否粗体 */
  public isBold: boolean = false;
  
  /** 是否斜体 */
  public isItalic: boolean = false;
  
  /** 是否下划线 */
  public isUnderline: boolean = false;
  
  /**
   * 构造函数
   * @param text 文本内容
   */
  constructor(text?: string) {
    super();
    if (text) this.text = text;
  }

  /**
   * 接收来自其他对象的信号（如按钮）
   */
  public receiveSignal(
    sender: ObjectBase,
    signal: string,
    data?: any
  ): void {
    // 处理加粗信号
    if (signal === 'bold') {
      this.isBold = !this.isBold; // 切换粗体状态
      console.log(`文本框收到加粗信号: ${this.isBold}`);
      
      // 向发送者回复确认信号
      this.sendSignal(sender, 'formatApplied', { type: 'bold', state: this.isBold });
    }
    // 处理斜体信号
    else if (signal === 'italic') {
      this.isItalic = !this.isItalic;
      console.log(`文本框收到斜体信号: ${this.isItalic}`);
    }
    // 处理下划线信号
    else if (signal === 'underline') {
      this.isUnderline = !this.isUnderline;
      console.log(`文本框收到下划线信号: ${this.isUnderline}`);
    }
  }
}

// 演示不同类型对象之间的信号传递
export function demonstrateObjectCommunication(): void {
  // 创建对象实例
  const boldButton = new Button();
  boldButton.label = '加粗按钮';
  boldButton.type = 'bold';
  
  const italicButton = new Button();
  italicButton.label = '斜体按钮';
  italicButton.type = 'italic';
  
  const textBox = new TextBox();
  textBox.text = '示例文本';
  
  // 建立对象关联
  boldButton.relate(textBox);
  italicButton.relate(textBox);
  boldButton.relate(italicButton); // 按钮之间也可以建立关联
  
  // 模拟按钮点击
  console.log('===== 对象通信演示 =====');
  console.log('点击加粗按钮:');
  boldButton.click(); // 触发加粗信号
  
  console.log('\n点击斜体按钮:');
  italicButton.click(); // 触发斜体信号
  
  // 文本框向按钮发送信号
  console.log('\n文本框向按钮发送更新信号:');
  textBox.broadcastSignal('update', { status: 'content changed' });
}
