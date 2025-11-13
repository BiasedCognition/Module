export const NotesChannels = {
  ELEMENT_DOUBLE_CLICK: 'notes:element:dblclick',
  SELECTION_CHANGED: 'notes:selection:changed',
  SIDEBAR_EXPANDED: 'notes:sidebar:expanded',
  SIDEBAR_CONTENT_UPDATED: 'notes:sidebar:content-updated',
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



