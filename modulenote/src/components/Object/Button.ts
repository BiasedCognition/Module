import { ObjectBase } from "./object.ts";

export class tButton extends ObjectBase {
  /** 按钮文本 */
  public label: string = '';
  /** 按钮类型 */
  public type: string = 'default'; // default, bold, italic, underline等
  /** 按钮状态 */
  public isActive: boolean = false;

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
   * 向所有与其关联的类传递信息
   */
  public click(): void {
    console.log(`${this.label}按钮被点击，类型: ${this.type}`);
    
    // 切换按钮状态
    this.isActive = !this.isActive;
    
    // 准备要发送的数据
    const data = {
      buttonType: this.type,
      buttonLabel: this.label,
      isActive: this.isActive
    };
    
    // 向所有关联对象发送信号
    // 由于WeakSet不支持直接遍历，我们需要一个辅助方法来获取关联对象列表
    this.sendSignalToRelatedObjects(`button_${this.type}_click`, data);
  }

  /**
   * 向所有关联对象发送信号的辅助方法
   * @param signal 信号名称
   * @param data 附加数据
   */
  private sendSignalToRelatedObjects(signal: string, data?: any): void {
    // 在实际项目中，这里应该使用一个活动对象列表来进行广播
    // 这里为了演示，我们假设外部会提供这样的列表
    // 或者可以改为事件总线模式
    console.log(`准备向关联对象发送信号: ${signal}`, data);
    
    // 注意：由于WeakSet不支持直接遍历，在实际使用时需要传入活动对象列表
    // 这里我们提供一个方法供外部调用，传入活动对象列表进行真正的广播
  }

  /**
   * 使用活动对象列表进行广播的公共方法
   * @param activeObjects 活动对象列表
   * @param signal 信号名称
   * @param data 附加数据
   */
  public broadcastToRelatedActiveObjects(activeObjects: ObjectBase[], signal?: string, data?: any): void {
    const signalName = signal || `button_${this.type}_click`;
    const broadcastData = data || {
      buttonType: this.type,
      buttonLabel: this.label,
      isActive: this.isActive
    };
    
    this.broadcastToActiveObjects(activeObjects, signalName, broadcastData);
    console.log(`已向关联的活动对象广播信号: ${signalName}`);
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
    console.log(`按钮${this.label}收到信号: ${signal}`, data, `发送者: ${sender.constructor.name}`);
    
    // 根据不同信号类型处理
    if (signal === 'disable') {
      this.isActive = false;
      console.log(`按钮${this.label}被禁用`);
    } else if (signal === 'enable') {
      console.log(`按钮${this.label}被启用`);
    } else if (signal === 'updateLabel') {
      if (data && typeof data.label === 'string') {
        this.label = data.label;
        console.log(`按钮标签已更新为: ${this.label}`);
      }
    } else if (signal === 'updateComment' && data && typeof data.comment === 'string') {
      // 处理注释更新信号
      this.setComment(data.comment);
      console.log(`按钮${this.label}的注释已更新: ${this.comment}`);
    } else if (signal === 'updateContent' && typeof data.content !== 'undefined') {
      // 处理内容更新信号
      this.setContent(data.content);
      console.log(`按钮${this.label}的内容已更新:`, this.content);
    }
  }

  /**
   * 建立与其他对象的关联关系
   * 重写父类方法以添加日志
   * @param obj 要关联的对象
   */
  public relate(obj: ObjectBase): void {
    super.relate(obj);
    console.log(`按钮${this.label}已与${obj.constructor.name}建立关联`);
  }
}

/**
 * 演示tButton类的使用方法
 * 展示如何创建按钮、建立关联、处理点击事件和信号传递
 */
export function demonstrateTButtonUsage(): void {
  // 创建tButton实例
  const boldButton = new tButton('加粗', 'bold');
  const italicButton = new tButton('斜体', 'italic');
  
  // 创建一个简单的接收者类
  class TextElement extends ObjectBase {
    public text: string = '';
    public isBold: boolean = false;
    public isItalic: boolean = false;
    
    constructor(text: string) {
      super();
      this.text = text;
    }
    
    public receiveSignal(sender: ObjectBase, signal: string, data?: any): void {
      console.log(`文本元素收到信号: ${signal}`, data);
      
      if (signal === 'button_bold_click' && data) {
        this.isBold = data.isActive;
        console.log(`文本加粗状态已切换为: ${this.isBold}`);
      } else if (signal === 'button_italic_click' && data) {
        this.isItalic = data.isActive;
        console.log(`文本斜体状态已切换为: ${this.isItalic}`);
      }
    }
  }
  
  // 创建文本元素
  const textElement = new TextElement('示例文本');
  
  // 建立关联关系
  boldButton.relate(textElement);
  italicButton.relate(textElement);
  
  // 创建活动对象列表
  const activeObjects = [boldButton, italicButton, textElement];
  
  // 模拟点击按钮
  console.log('\n===== tButton使用演示 =====');
  console.log('点击加粗按钮:');
  boldButton.click();
  // 使用活动对象列表进行广播
  boldButton.broadcastToRelatedActiveObjects(activeObjects);
  
  console.log('\n点击斜体按钮:');
  italicButton.click();
  // 使用活动对象列表进行广播
  italicButton.broadcastToRelatedActiveObjects(activeObjects);
  
  console.log('\n再次点击加粗按钮:');
  boldButton.click();
  boldButton.broadcastToRelatedActiveObjects(activeObjects);
  
  console.log('\n文本元素向按钮发送信号:');
  textElement.sendSignal(boldButton, 'updateLabel', { label: '粗体 (已切换)' });
}