import { ObjectBase } from "./object.ts";
import { tButton } from "./Button.ts";
import { Textbox } from "./textbox.ts";
import { Element } from "./element.ts";

// 创建一个ObjectBase的具体实现类
class ConcreteObject extends ObjectBase {
  public receiveSignal(sender: ObjectBase, signal: string, data?: any): void {
    console.log(`基础对象收到信号: ${signal}`, data);
  }
}

/**
 * 演示ObjectBase及其子类的content属性和方法
 */
export function demonstrateContentFunctionality(): void {
  console.log("\n===== ObjectBase及其子类的content功能演示 =====\n");

  // 1. 演示ObjectBase的content方法
  console.log("1. 演示ObjectBase的content方法:");
  const baseObject = new ConcreteObject();

  // 设置并获取content
  baseObject.setContent({ name: "基础对象", timestamp: Date.now() });
  console.log(`获取基础对象内容:`, baseObject.getContent());

  // 添加内容更新监听器
  baseObject.on('contentUpdated', (sender, data) => {
    console.log(`监听到内容更新:`, data);
  });

  // 再次更新content以触发监听器
  baseObject.setContent({ name: "更新后的基础对象", value: 42 });
  
  // 2. 演示tButton的content功能
  console.log("\n2. 演示tButton的content功能:");
  const boldButton = new tButton("加粗", "bold");
  
  // 通过方法设置content
  boldButton.setContent({ shortcut: "Ctrl+B", icon: "fa-bold" });
  console.log(`按钮内容:`, boldButton.getContent());
  
  // 通过信号设置content
  baseObject.sendSignal(boldButton, "updateContent", {
    content: { shortcut: "Ctrl+B", icon: "fa-bold", tooltip: "设置粗体文本" }
  });
  console.log(`通过信号更新后的按钮内容:`, boldButton.getContent());
  
  // 3. 演示Textbox的content功能
  console.log("\n3. 演示Textbox的content功能:");
  const textbox = new Textbox();
  textbox.setContent("这是一个示例文本");
  
  // 直接设置content
  textbox.setContent({
    format: "rich",
    version: "1.0",
    metadata: { created: new Date().toISOString() }
  });
  console.log(`文本框内容:`, textbox.getContent());
  
  // 通过信号设置content
  boldButton.sendSignal(textbox, "updateContent", {
    content: {
      format: "rich",
      version: "1.1",
      metadata: { 
        created: new Date().toISOString(),
        lastModifiedBy: "boldButton"
      },
      history: [{ action: "format_change", type: "bold", timestamp: Date.now() }]
    }
  });
  console.log(`通过信号更新后的文本框内容:`, textbox.getContent());
  
  // 4. 演示Element的content功能
  console.log("\n4. 演示Element的content功能:");
  const element = new Element({
    id: 1,
    type: "demo"
  }, "[示例元素]", 10);
  
  // 直接设置content
  element.setContent({
    config: { editable: true },
    style: { color: "#ff0000" },
    dataSource: "local"
  });
  console.log(`元素内容:`, element.getContent());
  
  // 通过信号设置content
  textbox.sendSignal(element, "updateContent", {
    content: {
      config: { editable: true },
      style: { color: "#00ff00", backgroundColor: "#f0f0f0" },
      dataSource: "server",
      cacheable: true
    }
  });
  console.log(`通过信号更新后的元素内容:`, element.getContent());
  
  // 5. 演示复杂对象嵌套的content传递
  console.log("\n5. 演示复杂对象嵌套的content传递:");
  
  // 创建复杂的content对象
  const complexContent = {
    document: {
      title: "复杂内容演示",
      sections: [
        { id: 1, title: "介绍", content: "这是一个复杂内容对象" },
        { id: 2, title: "详细信息", content: "包含嵌套结构" }
      ],
      author: {
        name: "System",
        role: "Demo"
      }
    },
    format: "json",
    tags: ["demo", "content", "nested"]
  };
  
  // 设置到textbox
  textbox.setContent(complexContent);
  console.log(`文本框复杂内容设置成功`);
  
  // 从textbox获取并传递给element
  const retrievedContent = textbox.getContent();
  element.setContent({
    ...retrievedContent,
    additionalInfo: "从文本框复制并增强的内容"
  });
  
  console.log(`元素接收并增强了文本框的内容:`, element.getContent());
  
  console.log("\n===== content功能演示完成 =====");
}

// 直接执行演示函数
demonstrateContentFunctionality();