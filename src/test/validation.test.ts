/**
 * Validation Helper Tests
 * Testare completă pentru funcționalitățile de validare
 */

import { 
  validateQuiz, 
  validateQuestion, 
  validateOptions, 
  validateQuizTitle, 
  validateQuestionText, 
  validateOptionText,
  validateProfileName,
  validateUserInput,
  sanitizeString,
  sanitizeQuiz
} from '../helpers/validation';

describe('Validation Helper', () => {
  describe('validateQuizTitle', () => {
    it('should validate correct title', () => {
      const result = validateQuizTitle('Test Quiz Title');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty title', () => {
      const result = validateQuizTitle('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Acest câmp este obligatoriu');
    });

    it('should reject title too short', () => {
      const result = validateQuizTitle('AB');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Titlul quiz-ului trebuie sa aibie între 3-100 caractere');
    });

    it('should reject title too long', () => {
      const result = validateQuizTitle('A'.repeat(101));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Titlul quiz-ului trebuie sa aibie între 3-100 caractere');
    });
  });

  describe('validateQuestionText', () => {
    it('should validate correct question text', () => {
      const result = validateQuestionText('What is the capital of Romania?');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty question text', () => {
      const result = validateQuestionText('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Acest câmp este obligatoriu');
    });

    it('should reject question text too short', () => {
      const result = validateQuestionText('ABC');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Textul întrebarii trebuie sa aibie între 10-1000 caractere');
    });
  });

  describe('validateOptionText', () => {
    it('should validate correct option text', () => {
      const result = validateOptionText('Bucharest');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty option text', () => {
      const result = validateOptionText('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Acest câmp este obligatoriu');
    });

    it('should reject option text too long', () => {
      const result = validateOptionText('A'.repeat(201));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Textul opțiunii trebuie sa aibie între 1-200 caractere');
    });
  });

  describe('validateOptions', () => {
    it('should validate correct options', () => {
      const options = [
        { id: 'a', text: 'Option A', isCorrect: false },
        { id: 'b', text: 'Option B', isCorrect: true },
        { id: 'c', text: 'Option C', isCorrect: false },
        { id: 'd', text: 'Option D', isCorrect: false },
      ];
      const result = validateOptions(options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject options with no correct answer', () => {
      const options = [
        { id: 'a', text: 'Option A', isCorrect: false },
        { id: 'b', text: 'Option B', isCorrect: false },
        { id: 'c', text: 'Option C', isCorrect: false },
        { id: 'd', text: 'Option D', isCorrect: false },
      ];
      const result = validateOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cel puțin o opțiune corectă este necesară');
    });

    it('should reject duplicate options', () => {
      const options = [
        { id: 'a', text: 'Same Option', isCorrect: false },
        { id: 'b', text: 'Same Option', isCorrect: true },
        { id: 'c', text: 'Option C', isCorrect: false },
        { id: 'd', text: 'Option D', isCorrect: false },
      ];
      const result = validateOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Opțiunile nu pot fi duplicate');
    });

    it('should reject too few options', () => {
      const options = [
        { id: 'a', text: 'Option A', isCorrect: true },
      ];
      const result = validateOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cel puțin două opțiuni sunt necesare');
    });

    it('should reject too many options', () => {
      const options = Array.from({ length: 11 }, (_, i) => ({
        id: String.fromCharCode(97 + i),
        text: `Option ${i + 1}`,
        isCorrect: i === 0,
      }));
      const result = validateOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum 10 opțiuni permise');
    });
  });

  describe('validateQuestion', () => {
    it('should validate correct question', () => {
      const question = {
        id: 'q1',
        text: 'What is 2+2?',
        options: [
          { id: 'a', text: '3', isCorrect: true },
          { id: 'b', text: '4', isCorrect: false },
          { id: 'c', text: '5', isCorrect: false },
          { id: 'd', text: '6', isCorrect: false },
        ],
        explanation: 'Basic math',
        imageUrl: '',
        difficulty: 'medium' as const,
        tags: [],
      };
      const result = validateQuestion(question);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject question with invalid image URL', () => {
      const question = {
        id: 'q1',
        text: 'What is in this image?',
        options: [
          { id: 'a', text: 'Cat', isCorrect: true },
          { id: 'b', text: 'Dog', isCorrect: false },
          { id: 'c', text: 'Bird', isCorrect: false },
          { id: 'd', text: 'Fish', isCorrect: false },
        ],
        explanation: 'Animal identification',
        imageUrl: 'invalid-url',
        difficulty: 'medium' as const,
        tags: [],
      };
      const result = validateQuestion(question);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('URL imagine invalid');
    });
  });

  describe('validateQuiz', () => {
    it('should validate correct quiz', () => {
      const quiz = {
        id: 'quiz1',
        title: 'Math Quiz',
        description: 'Basic mathematics',
        questions: [
          {
            id: 'q1',
            text: 'What is 2+2?',
            options: [
              { id: 'a', text: '3', isCorrect: true },
              { id: 'b', text: '4', isCorrect: false },
            ],
            explanation: 'Basic addition',
            imageUrl: '',
            difficulty: 'easy' as const,
            tags: [],
          },
        ],
      };
      const result = validateQuiz(quiz);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject quiz with no questions', () => {
      const quiz = {
        id: 'quiz1',
        title: 'Empty Quiz',
        description: 'No questions',
        questions: [],
      };
      const result = validateQuiz(quiz);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cel puțin o întrebare este necesară');
    });

    it('should reject quiz with too many questions', () => {
      const quiz = {
        id: 'quiz1',
        title: 'Long Quiz',
        description: 'Too many questions',
        questions: Array.from({ length: 101 }, (_, i) => ({
          id: `q${i}`,
          text: `Question ${i + 1}`,
          options: [
            { id: 'a', text: 'A', isCorrect: true },
            { id: 'b', text: 'B', isCorrect: false },
          ],
          explanation: '',
          imageUrl: '',
          difficulty: 'medium' as const,
          tags: [],
        })),
      };
      const result = validateQuiz(quiz);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum 100 întrebări permise');
    });

    it('should reject quiz with description too long', () => {
      const quiz = {
        id: 'quiz1',
        title: 'Test Quiz',
        description: 'A'.repeat(501),
        questions: [
          {
            id: 'q1',
            text: 'Test Question',
            options: [
              { id: 'a', text: 'A', isCorrect: true },
              { id: 'b', text: 'B', isCorrect: false },
            ],
            explanation: '',
            imageUrl: '',
            difficulty: 'medium' as const,
            tags: [],
          },
        ],
      };
      const result = validateQuiz(quiz);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Descrierea nu poate avea mai mult de 500 caractere');
    });
  });

  describe('validateProfileName', () => {
    it('should validate correct profile name', () => {
      const result = validateProfileName('John Doe');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty profile name', () => {
      const result = validateProfileName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Acest câmp este obligatoriu');
    });

    it('should reject profile name too short', () => {
      const result = validateProfileName('A');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Numele profilului trebuie sa aibie între 2-30 caractere');
    });

    it('should reject profile name too long', () => {
      const result = validateProfileName('A'.repeat(31));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Numele profilului trebuie sa aibie între 2-30 caractere');
    });
  });

  describe('validateUserInput', () => {
    it('should validate email input', () => {
      const result = validateUserInput('test@example.com', 'email');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('test@example.com');
    });

    it('should reject invalid email', () => {
      const result = validateUserInput('invalid-email', 'email');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email invalid');
    });

    it('should validate URL input', () => {
      const result = validateUserInput('https://example.com', 'url');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('https://example.com');
    });

    it('should reject invalid URL', () => {
      const result = validateUserInput('not-a-url', 'url');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('URL invalid');
    });

    it('should sanitize dangerous input', () => {
      const result = validateUserInput('<script>alert("xss")</script>', 'text');
      expect(result.isValid).toBe(false);
      expect(result.sanitized).toBe('');
    });
  });

  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const result = sanitizeString('<div>Hello</div>');
      expect(result).toBe('Hello');
    });

    it('should remove JavaScript protocols', () => {
      const result = sanitizeString('javascript:alert("xss")');
      expect(result).toBe('alert("xss")');
    });

    it('should remove event handlers', () => {
      const result = sanitizeString('<div onclick="alert()">Click</div>');
      expect(result).toBe('Click');
    });

    it('should preserve valid content', () => {
      const result = sanitizeString('Valid text with 123 and symbols !@#$%');
      expect(result).toBe('Valid text with 123 and symbols !@#$%');
    });
  });

  describe('sanitizeQuiz', () => {
    it('should sanitize quiz data', () => {
      const quiz = {
        title: '<script>alert("xss")</script>Quiz Title',
        description: 'Quiz <b>description</b>',
        questions: [
          {
            id: 'q1',
            text: 'Question <script>alert("xss")</script>text',
            options: [
              { id: 'a', text: '<div>Option A</div>', isCorrect: false },
              { id: 'b', text: 'Option B', isCorrect: true },
            ],
            explanation: 'Explanation <b>with HTML</b>',
            imageUrl: '',
            difficulty: 'medium' as const,
            tags: [],
          },
        ],
      };
      const sanitized = sanitizeQuiz(quiz);
      
      expect(sanitized.title).toBe('Quiz Title');
      expect(sanitized.description).toBe('Quiz description');
      expect(sanitized.questions[0].text).toBe('Question text');
      expect(sanitized.questions[0].options[0].text).toBe('Option A');
      expect(sanitized.questions[0].explanation).toBe('Explanation with HTML');
    });
  });
});
