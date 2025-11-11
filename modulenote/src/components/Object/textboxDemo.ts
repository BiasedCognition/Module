import { Textbox } from "./textbox.ts";
import { Element } from "./element.ts";

/**
 * 演示Textbox类的新功能
 * 验证Textbox是否能正确管理元素集合
 */
function demonstrateTextboxFunctionality() {
  console.log("===== Textbox功能演示开始 =====\n");
  
  // 创建Textbox实例
  console.log("1. 创建Textbox实例");
  const textbox = new Textbox();
  console.log("Textbox已创建，类型：", textbox.type);
  console.log("初始元素数量：", textbox.getElements().length);
  console.log();
  
  // 创建Element实例
  console.log("2. 创建Element实例");
  const element1 = new Element("元素1", "value1");
  const element2 = new Element("元素2", "value2");
  const element3 = new Element("元素3", "value3");
  console.log("创建了3个Element实例");
  console.log();
  
  // 添加元素到Textbox
  console.log("3. 向Textbox添加元素");
  textbox.addElement(element1);
  textbox.addElement(element2);
  console.log("添加2个元素后，元素数量：", textbox.getElements().length);
  console.log("元素列表：", textbox.getElements().map(el => el.label));
  console.log();
  
  // 测试接收信号功能
  console.log("4. 测试通过信号添加元素");
  textbox.receiveSignal(textbox, 'addElement', { element: element3 });
  console.log("通过信号添加元素后，元素数量：", textbox.getElements().length);
  console.log("元素列表：", textbox.getElements().map(el => el.label));
  console.log();
  
  // 测试移除元素
  console.log("5. 测试移除元素");
  textbox.removeElement(element2.elementId);
  console.log("移除元素后，元素数量：", textbox.getElements().length);
  console.log("剩余元素：", textbox.getElements().map(el => el.label));
  console.log();
  
  // 测试通过信号移除元素
  console.log("6. 测试通过信号移除元素");
  textbox.receiveSignal(textbox, 'removeElement', { elementId: element1.elementId });
  console.log("通过信号移除元素后，元素数量：", textbox.getElements().length);
  console.log("剩余元素：", textbox.getElements().map(el => el.label));
  console.log();
  
  // 测试清空所有元素
  console.log("7. 测试清空所有元素");
  textbox.clearElements();
  console.log("清空后，元素数量：", textbox.getElements().length);
  console.log();
  
  // 测试模式切换
  console.log("8. 测试模式切换");
  console.log("初始模式：", textbox.mode);
  textbox.toggleMode();
  console.log("切换后模式：", textbox.mode);
  console.log();
  
  // 测试通过信号获取元素
  console.log("9. 测试通过信号获取元素");
  // 先添加一些元素用于测试
  textbox.addElement(element1);
  textbox.addElement(element2);
  
  // 模拟信号处理
  let retrievedElements: Element[] = [];
  // 临时覆盖sendSignal方法来捕获响应
  const originalSendSignal = textbox.sendSignal;
  textbox.sendSignal = (sender, signal, data) => {
    if (signal === 'elementsRetrieved') {
      retrievedElements = data.elements;
      console.log("通过信号检索到的元素数量：", retrievedElements.length);
      console.log("通过信号检索到的元素：", retrievedElements.map(el => el.label));
    }
    originalSendSignal.call(textbox, sender, signal, data);
  };
  
  textbox.receiveSignal(textbox, 'getElements');
  
  // 恢复原始方法
  textbox.sendSignal = originalSendSignal;
  console.log();
  
  console.log("===== Textbox功能演示完成 =====");
}

// 执行演示
demonstrateTextboxFunctionality();