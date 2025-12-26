export type ChatRole = "user" | "model";

export interface Message {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: string;
  senderId?: number;
}
