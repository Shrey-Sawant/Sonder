export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isTyping?: boolean;
}

export interface Resource {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'article';
  category: 'Anxiety' | 'Sleep' | 'Burnout' | 'Meditation';
  duration: string;
  imageUrl: string;
}

export interface Counselor {
  id: string;
  name: string;
  specialty: string;
  available: boolean;
  imageUrl: string;
  rating: number;
}

export interface StatData {
  name: string;
  value: number;
  stressLevel?: number;
}

export enum ViewState {
  DASHBOARD = 'dashboard',
  COMPANION = 'companion', // AI Chat
  SANCTUARY = 'sanctuary', // Resources
  CONNECT = 'connect', // Counseling/Peer
  INSIGHT = 'insight' // Admin
}