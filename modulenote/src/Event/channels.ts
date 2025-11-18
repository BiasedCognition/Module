export const NotesChannels = {
  // 元素相关
  ELEMENT_DOUBLE_CLICK: 'notes:element:dblclick',
  ELEMENT_CLICK: 'notes:element:click',
  ELEMENT_ADD: 'notes:element:add',
  ELEMENT_REMOVE: 'notes:element:remove',
  ELEMENT_SPLIT: 'notes:element:split',
  ELEMENTS_CHANGE: 'notes:elements:change',
  
  // 选择相关
  SELECTION_CHANGED: 'notes:selection:changed',
  
  // 侧边栏相关
  SIDEBAR_EXPANDED: 'notes:sidebar:expanded',
  SIDEBAR_CONTENT_UPDATED: 'notes:sidebar:content-updated',
  
  // Textbox 相关
  TEXTBOX_MODE_CHANGE: 'notes:textbox:mode-change',
  
  // 元素编辑相关
  ELEMENT_START_EDIT: 'notes:element:start-edit',
  
  // Textbox 激活相关
  TEXTBOX_ACTIVATE: 'notes:textbox:activate',
  TEXTBOX_DEACTIVATE: 'notes:textbox:deactivate',
  TEXTBOX_ADD_ELEMENT_REQUEST: 'notes:textbox:add-element-request',
} as const;

export type NotesChannelKey = keyof typeof NotesChannels;
export type NotesChannel = (typeof NotesChannels)[NotesChannelKey];

export interface ElementSelectionPayload {
  element: any;
}

export interface SelectionChangedPayload {
  element: any | null;
}

export interface SidebarExpandedPayload {
  expanded: boolean;
}

export interface SidebarContentUpdatedPayload {
  element: any;
  content: any;
}

export interface ElementClickPayload {
  element: any;
}

export interface ElementAddPayload {
  element: any;
}

export interface ElementRemovePayload {
  elementId: string;
}

export interface ElementSplitPayload {
  element: any;
  beforeText: string;
  afterText: string;
}

export interface ElementsChangePayload {
  elements: any[];
}

export interface TextboxModeChangePayload {
  mode: 'view' | 'edit';
}

export interface ElementStartEditPayload {
  elementId: string;
}

export interface TextboxActivatePayload {
  textboxId: string;
}

export interface TextboxDeactivatePayload {
  textboxId: string;
}

export interface TextboxAddElementRequestPayload {
  textboxId: string;
}



