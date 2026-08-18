export interface Question {
  question: string;
  answers: string[]; // 2, 3 nebo 4 varianty – správná je vždy jen jedna
  correctAnswer: number; // index do answers
  answered: boolean;
}

export interface Category {
  /** Krátký název pro hlavičku sloupce na desce, např. „Ríša“. */
  name: string;
  /** Dlouhý název pro nadpis okna otázky, např. „Otázky na Ríšu“. */
  longName: string;
  questions: Question[];
}
