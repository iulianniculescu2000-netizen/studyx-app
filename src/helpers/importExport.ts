/**
 * Import/Export Helper - Utilitare pentru import/export diverse formate
 * Suport pentru CSV, JSON, PDF, DOCX, TXT \u0219i alte formate
 */

import type { Quiz, Question, QuizColor } from '../types';

// Export formats
export type ExportFormat = 'json' | 'csv' | 'txt' | 'pdf' | 'docx';

// Import result
export interface ImportResult {
  success: boolean;
  data?: Quiz[];
  errors: string[];
  warnings: string[];
  summary: {
    totalItems: number;
    importedItems: number;
    skippedItems: number;
    errorItems: number;
  };
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cleanedData?: Quiz[];
}

/**
 * Export quiz-uri \u00een format JSON
 */
export function exportToJSON(quizzes: Quiz[]): {
  success: boolean;
  data?: string;
  error?: string;
} {
  try {
    const exportData = {
      version: '1.0.0',
      timestamp: Date.now(),
      source: 'StudyX',
      format: 'json',
      data: quizzes
    };

    return {
      success: true,
      data: JSON.stringify(exportData, null, 2)
    };
  } catch (error) {
    return {
      success: false,
      error: `Eroare export JSON: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`
    };
  }
}

/**
 * Export quiz-uri \u00een format CSV
 */
export function exportToCSV(quizzes: Quiz[]): {
  success: boolean;
  data?: string;
  error?: string;
} {
  try {
    const rows: string[][] = [['Titlu', 'Descriere', '\u00centrebare', 'Op\u021biune A', 'Op\u021biune B', 'Op\u021biune C', 'Op\u021biune D', 'R\u0103spuns Corect', 'Explica\u021bie']];

    quizzes.forEach(quiz => {
      quiz.questions.forEach(question => {
        const correctOption = question.options.find(opt => opt.isCorrect);
        const correctLetter = correctOption ? 
          String.fromCharCode(65 + question.options.indexOf(correctOption)) : '';

        rows.push([
          quiz.title || '',
          quiz.description || '',
          question.text || '',
          question.options[0]?.text || '',
          question.options[1]?.text || '',
          question.options[2]?.text || '',
          question.options[3]?.text || '',
          correctLetter,
          question.explanation || ''
        ]);
      });
    });

    const csvContent = rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    return {
      success: true,
      data: csvContent
    };
  } catch (error) {
    return {
      success: false,
      error: `Eroare export CSV: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`
    };
  }
}

/**
 * Export quiz-uri \u00een format TXT
 */
export function exportToTXT(quizzes: Quiz[]): {
  success: boolean;
  data?: string;
  error?: string;
} {
  try {
    let content = `StudyX - Export Quiz-uri\n`;
    content += `Generat: ${new Date().toLocaleString('ro-RO')}\n`;
    content += `Total quiz-uri: ${quizzes.length}\n\n`;

    quizzes.forEach((quiz, quizIndex) => {
      content += `${quizIndex + 1}. ${quiz.title}\n`;
      if (quiz.description) {
        content += `   Descriere: ${quiz.description}\n`;
      }
      content += `   \u00centreb\u0103ri: ${quiz.questions.length}\n\n`;

      quiz.questions.forEach((question, qIndex) => {
        content += `   \u00centrebarea ${qIndex + 1}: ${question.text}\n`;
        
        question.options.forEach((option, oIndex) => {
          const marker = option.isCorrect ? '\u2713' : ' ';
          content += `      ${marker} ${String.fromCharCode(65 + oIndex)}. ${option.text}\n`;
        });

        if (question.explanation) {
          content += `      Explica\u021bie: ${question.explanation}\n`;
        }
        content += '\n';
      });

      content += '---\n\n';
    });

    return {
      success: true,
      data: content
    };
  } catch (error) {
    return {
      success: false,
      error: `Eroare export TXT: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`
    };
  }
}

/**
 * Import quiz-uri din format JSON
 */
export function importFromJSON(jsonData: string): ImportResult {
  const result: ImportResult = {
    success: false,
    errors: [],
    warnings: [],
    summary: {
      totalItems: 0,
      importedItems: 0,
      skippedItems: 0,
      errorItems: 0
    }
  };

  try {
    const data = JSON.parse(jsonData);
    
    // Verificare format
    if (!data.data || !Array.isArray(data.data)) {
      result.errors.push('Format JSON invalid - lipse\u0219te array-ul de date');
      return result;
    }

    result.summary.totalItems = data.data.length;

    // Validare \u0219i cur\u0103\u021bare date
    const validation = validateImportData(data.data);
    
    if (!validation.isValid) {
      result.errors.push(...validation.errors);
      result.warnings.push(...validation.warnings);
      return result;
    }

    if (validation.cleanedData) {
      result.data = validation.cleanedData;
      result.summary.importedItems = validation.cleanedData.length;
      result.success = true;
    }

    result.warnings.push(...validation.warnings);

  } catch (error) {
    result.errors.push(`Eroare parsare JSON: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`);
  }

  return result;
}

/**
 * Import quiz-uri din format CSV
 */
export function importFromCSV(csvData: string): ImportResult {
  const result: ImportResult = {
    success: false,
    errors: [],
    warnings: [],
    summary: {
      totalItems: 0,
      importedItems: 0,
      skippedItems: 0,
      errorItems: 0
    }
  };

  try {
    const lines = csvData.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      result.errors.push('CSV invalid - prea pu\u021bine r\u00e2nduri');
      return result;
    }

    // Verificăm dacă primul rând e header (nu conține date de întrebare)
    const firstRow = parseCSVLine(lines[0]);
    const hasHeader = firstRow.length >= 3 &&
      (firstRow[0].toLowerCase().includes('titlu') ||
       firstRow[0].toLowerCase().includes('title') ||
       firstRow[2].toLowerCase().includes('ntrebare') ||
       firstRow[2].toLowerCase().includes('question'));
    const startIdx = hasHeader ? 1 : 0;

    const quizzes: Quiz[] = [];
    let currentQuiz: Quiz | null = null;

    for (let i = startIdx; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      if (values.length < 8) {
        result.warnings.push(`R\u00e2nd ${i + 1}: coloane insuficiente`);
        continue;
      }

      const [title, description, questionText, optA, optB, optC, optD, correct, explanation] = values;

      // Creeaz\u0103 quiz dac\u0103 e necesar
      if (!currentQuiz || currentQuiz.title !== title) {
        currentQuiz = {
          id: `import_${Date.now()}_${quizzes.length}`,
          title: title || `Quiz ${quizzes.length + 1}`,
          description: description || '',
          emoji: '📚',
          category: 'Import CSV',
          color: 'blue',
          questions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          shuffleQuestions: false,
          shuffleAnswers: false,
        };
        quizzes.push(currentQuiz);
      }

      // Creeaz\u0103 \u00eentrebare
      const question: Question = {
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: questionText || '\u00centrebare f\u0103r\u0103 text',
        options: [
          { id: 'a', text: optA || 'Op\u021biune A', isCorrect: correct.toUpperCase() === 'A' },
          { id: 'b', text: optB || 'Op\u021biune B', isCorrect: correct.toUpperCase() === 'B' },
          { id: 'c', text: optC || 'Op\u021biune C', isCorrect: correct.toUpperCase() === 'C' },
          { id: 'd', text: optD || 'Op\u021biune D', isCorrect: correct.toUpperCase() === 'D' }
        ],
        explanation: explanation || '',
        imageUrl: '',
        difficulty: 'medium' as const,
        tags: []
      };

      if (!currentQuiz) {
        result.warnings.push(`Rand ${i + 1}: quiz invalid - linie ignorata`);
        continue;
      }

      currentQuiz.questions.push(question);
    }

    result.summary.totalItems = quizzes.length;
    result.data = quizzes;
    result.summary.importedItems = quizzes.length;
    result.success = true;

    if (quizzes.length === 0) {
      result.errors.push('Niciun quiz valid g\u0103sit \u00een CSV');
      result.success = false;
    }

  } catch (error) {
    result.errors.push(`Eroare procesare CSV: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`);
  }

  return result;
}

/**
 * Import quiz-uri din format TXT
 */
export function importFromTXT(txtData: string): ImportResult {
  const result: ImportResult = {
    success: false,
    errors: [],
    warnings: [],
    summary: {
      totalItems: 0,
      importedItems: 0,
      skippedItems: 0,
      errorItems: 0
    }
  };

  try {
    const lines = txtData.split('\n').filter(line => line.trim());
    const quizzes: Quiz[] = [];
    let currentQuiz: Quiz | null = null;
    let currentQuestion: Question | null = null;
    for (const line of lines) {
      const trimmed = line.trim();

      // Detectare titlu quiz
      if (trimmed.match(/^\d+\.\s+.+/)) {
        const title = trimmed.replace(/^\d+\.\s+/, '');
        currentQuiz = {
          id: `import_${Date.now()}_${quizzes.length}`,
          title,
          description: '',
          emoji: '\ud83d\udcda',
          category: 'general',
          color: 'blue',
          questions: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        quizzes.push(currentQuiz);
        continue;
      }

      // Detectare \u00eentrebare
      if (trimmed.match(/^\s*\u00centrebarea\s*\d+:/i)) {
        if (!currentQuiz) {
          result.warnings.push('\u00centrebare f\u0103r\u0103 quiz - ignorat\u0103');
          continue;
        }

        const questionText = trimmed.replace(/^\s*\u00centrebarea\s*\d+:\s*/i, '');
        currentQuestion = {
          id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: questionText,
          options: [],
          explanation: '',
          imageUrl: '',
          difficulty: 'medium' as const,
          tags: []
        };
        currentQuiz.questions.push(currentQuestion);
        continue;
      }

      // Detectare op\u021biuni
      if (trimmed.match(/^\s*[A-D]\.\s+/) && currentQuestion) {
        const optionText = trimmed.replace(/^\s*[A-D]\.\s+/, '');
        const optionId = trimmed.match(/([A-D])/)?.[1]?.toLowerCase() || 'a';
        const isCorrect = trimmed.includes('\u2713');

        currentQuestion.options.push({
          id: optionId,
          text: optionText,
          isCorrect
        });
        continue;
      }

      // Detectare explica\u021bie
      if (trimmed.match(/^\s*Explica\u021bie:/i) && currentQuestion) {
        const explanation = trimmed.replace(/^\s*Explica\u021bie:\s*/i, '');
        currentQuestion.explanation = explanation;
        continue;
      }
    }

    // Validare \u0219i cur\u0103\u021bare quiz-uri
    const validQuizzes = quizzes.filter(quiz => {
      const hasValidQuestions = quiz.questions.length > 0 && 
        quiz.questions.every(q => q.options.length >= 2 && q.options.some(o => o.isCorrect));
      
      if (!hasValidQuestions) {
        result.warnings.push(`Quiz "${quiz.title}" - \u00eentreb\u0103ri invalide`);
        return false;
      }
      
      return true;
    });

    result.summary.totalItems = quizzes.length;
    result.data = validQuizzes;
    result.summary.importedItems = validQuizzes.length;
    result.summary.skippedItems = quizzes.length - validQuizzes.length;
    result.success = validQuizzes.length > 0;

    if (validQuizzes.length === 0) {
      result.errors.push('Niciun quiz valid g\u0103sit \u00een TXT');
    }

  } catch (error) {
    result.errors.push(`Eroare procesare TXT: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`);
  }

  return result;
}

/**
 * Func\u021bie ajut\u0103toare pentru parsare linie CSV
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Validare date import
 */
function validateImportData(data: unknown[]): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    cleanedData: []
  };

  if (!Array.isArray(data)) {
    result.isValid = false;
    result.errors.push('Datele trebuie s\u0103 fie un array');
    return result;
  }

  const cleanedQuizzes: Quiz[] = [];

  data.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      result.warnings.push(`Item ${index + 1}: format invalid - ignorat`);
      return;
    }

    const quiz = item as Partial<Quiz> & { questions?: unknown[] };
    
    // Validare titlu
    if (!quiz.title || typeof quiz.title !== 'string') {
      quiz.title = `Quiz ${index + 1}`;
      result.warnings.push(`Item ${index + 1}: titlu generat automat`);
    }

    // Validare \u00eentreb\u0103ri
    if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      result.warnings.push(`Quiz "${quiz.title}": f\u0103r\u0103 \u00eentreb\u0103ri - ignorat`);
      return;
    }

    const validQuestions = quiz.questions.filter((question): question is Question => {
      if (!question || typeof question !== 'object') {
        result.warnings.push(`Quiz "${quiz.title}": intrebare invalida - ignorata`);
        return false;
      }

      const maybeQuestion = question as Partial<Question>;
      if (!maybeQuestion.text || typeof maybeQuestion.text !== 'string') {
        result.warnings.push(`Quiz "${quiz.title}": \u00eentrebare f\u0103r\u0103 text - ignorat\u0103`);
        return false;
      }

      if (!Array.isArray(maybeQuestion.options) || maybeQuestion.options.length < 2) {
        result.warnings.push(`Quiz "${quiz.title}": \u00eentrebare cu < 2 op\u021biuni - ignorat\u0103`);
        return false;
      }

      const hasCorrect = maybeQuestion.options.some((opt) => !!opt?.isCorrect);
      if (!hasCorrect) {
        result.warnings.push(`Quiz "${quiz.title}": \u00eentrebare f\u0103r\u0103 r\u0103spuns corect - ignorat\u0103`);
        return false;
      }

      return true;
    });

    if (validQuestions.length === 0) {
      result.warnings.push(`Quiz "${quiz.title}": niciun \u00eentrebare valid\u0103 - ignorat`);
      return;
    }

    // Cur\u0103\u021bare \u0219i ad\u0103ugare la rezultat
    const cleanedQuiz: Quiz = {
      // Generăm mereu un ID nou la import pentru a evita coliziunile cu quiz-uri existente
      id: `import_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
      title: quiz.title,
      description: quiz.description || '',
      emoji: quiz.emoji || '📚',
      category: quiz.category || 'Import',
      color: (quiz.color as QuizColor | undefined) || 'blue',
      questions: validQuestions,
      createdAt: quiz.createdAt || Date.now(),
      updatedAt: quiz.updatedAt || Date.now(),
      shuffleQuestions: quiz.shuffleQuestions ?? false,
      shuffleAnswers: quiz.shuffleAnswers ?? false,
    };

    cleanedQuizzes.push(cleanedQuiz);
  });

  result.cleanedData = cleanedQuizzes;
  result.isValid = cleanedQuizzes.length > 0;

  if (cleanedQuizzes.length === 0) {
    result.errors.push('Niciun quiz valid \u00een datele importate');
  }

  return result;
}

/**
 * Func\u021bie principal\u0103 de export
 */
export function exportQuizzes(quizzes: Quiz[], format: ExportFormat): {
  success: boolean;
  data?: string;
  error?: string;
} {
  switch (format) {
    case 'json':
      return exportToJSON(quizzes);
    case 'csv':
      return exportToCSV(quizzes);
    case 'txt':
      return exportToTXT(quizzes);
    case 'pdf':
    case 'docx':
      // Aceste formate ar necesita biblioteci suplimentare
      return {
        success: false,
        error: `Format ${format} nu este implementat \u00eenca`
      };
    default:
      return {
        success: false,
        error: 'Format necunoscut'
      };
  }
}

/**
 * Func\u021bie principal\u0103 de import
 */
export function importQuizzes(data: string, format: ExportFormat): ImportResult {
  switch (format) {
    case 'json':
      return importFromJSON(data);
    case 'csv':
      return importFromCSV(data);
    case 'txt':
      return importFromTXT(data);
    case 'pdf':
    case 'docx':
      return {
        success: false,
        errors: [`Format ${format} nu este implementat \u00eenca`],
        warnings: [],
        summary: {
          totalItems: 0,
          importedItems: 0,
          skippedItems: 0,
          errorItems: 0
        }
      };
    default:
      return {
        success: false,
        errors: ['Format necunoscut'],
        warnings: [],
        summary: {
          totalItems: 0,
          importedItems: 0,
          skippedItems: 0,
          errorItems: 0
        }
      };
  }
}

/**
 * Detectare format din con\u021binut
 */
export function detectFormat(content: string): ExportFormat | null {
  const trimmed = content.trim();

  // JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Nu e JSON valid
    }
  }

  // CSV
  if (trimmed.includes(',') && trimmed.split('\n')[0].includes(',')) {
    return 'csv';
  }

  // TXT (fallback)
  if (trimmed.length > 0) {
    return 'txt';
  }

  return null;
}

/**
 * Import automat (detectare format)
 */
export function autoImport(data: string): ImportResult {
  const format = detectFormat(data);
  
  if (!format) {
    return {
      success: false,
      errors: ['Format necunoscut - nu s-a putut detecta'],
      warnings: [],
      summary: {
        totalItems: 0,
        importedItems: 0,
        skippedItems: 0,
        errorItems: 0
      }
    };
  }

  return importQuizzes(data, format);
}

// Export pentru utilizare u\u0219oar\u0103
export const ImportExportHelper = {
  exportQuizzes,
  importQuizzes,
  autoImport,
  detectFormat,
  exportToJSON,
  exportToCSV,
  exportToTXT,
  importFromJSON,
  importFromCSV,
  importFromTXT
};

export default ImportExportHelper;
