export interface Question {
  id: number;
  type?: 'directo' | 'completamiento' | 'ordenamiento' | 'relacion' | 'multiple-choice' | 'ordering' | 'matching' | 'casuistica' | 'comienzo';
  difficulty?: 'easy' | 'medium' | 'hard' | 'normativity' | 'development' | 'pedagogy' | 'management';
  reading?: string; // Lectura narrativa / Caso práctico contextual
  readingTitle?: string; // Título de la lectura o caso práctico
  case: string;
  items?: string[]; // For ordering or matching (left column)
  matchItems?: string[]; // For matching (right column)
  columns?: { a: string[], b: string[] }; // Additional structure for relation
  options: string[];
  correctAnswer: number; // Index of the correct option
  reference: string;
}

export interface UserSession {
  name: string;
  whatsapp: string;
  email?: string;
  role?: 'admin' | 'user';
  authMethod?: 'google' | 'email';
}

export interface QuizAttempt {
  user: UserSession;
  answers: number[]; // User's chosen indices
  startTime: number;
  endTime: number | null;
  score: number;
}
