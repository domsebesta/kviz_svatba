export interface Question {
  question: string;
  answers: string[]; // proměnlivý počet (oblast 5 může mít jiný počet)
  correctAnswer: number; // index nebo hodnota na škále (pro scale otázky)
  pointValue: number; // 1..5
  answered: boolean;
  media?: { type: 'image' | 'video'; path: string };
  scale?: boolean; // true pokud jde o otázku se škálou 1..10
}

export interface Category {
  name: string;
  questions: Question[];
}
