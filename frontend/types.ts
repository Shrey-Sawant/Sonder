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
  INSIGHT = 'insight', // Admin
  JOURNAL = 'journal', // Mood Journal
  EXERCISES = 'exercises', // Exercises
  PEER_CHAT = 'peer_chat', // Anonymous Peer Chat
  STORY_FEED = 'story_feed', // Anonymous Story Feed
  VIDEO_CALL = 'video_call', // Video call room

  // Counsellor Views:
  MY_STUDENTS = 'mystudents',
  APPOINTMENTS = 'appointments',
  SESSION_NOTES = 'sessionnotes',
  ANALYTICS = 'analytics',
  ALERTS = 'alerts',

  // Admin Sidebar Sub-Views
  ADMIN_USERS = 'admin-users',
  ADMIN_FLAGS = 'admin-flags',
  ADMIN_CONTENT = 'admin-content',
  ADMIN_SETTINGS = 'admin-settings',
  ADMIN_AUDIT = 'admin-audit'
}