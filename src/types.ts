export interface Question {
  question: string;
  answers: string[]; // proměnlivý počet (oblast 5 může mít jiný počet)
  correctAnswer: number; // index od 0
  pointValue: number; // 1..5
  answered: boolean;
}

export interface Category {
  name: string;
  questions: Question[];
}
