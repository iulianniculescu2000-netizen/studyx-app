import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to generate unique short IDs
function uid() { return Math.random().toString(36).substring(2, 10); }

async function parseFlashcardPdf(filePath) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

  const dataBuffer = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data: dataBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((item) => item.str).join(' ') + '\n';
  }

  // Process text using regex
  // Looking for patterns like "1. Question text here: ANSWER TEXT."
  const flashcards = [];
  let currentChapter = "General";
  
  // Split by line or by numbers
  // This regex looks for: 1 or more digits, a dot, space, the question text ending in a colon, then the answer.
  const regex = /(\d+)\.\s+(.*?):\s+(.*?)(?=\s+\d+\.|$)/gs;
  
  let match;
  while ((match = regex.exec(fullText)) !== null) {
    const questionText = match[2].trim() + "?";
    const answerText = match[3].trim();
    
    // We format this as a Quiz object of kind 'flashcard' with 1 correct option
    flashcards.push({
      id: uid(),
      text: questionText,
      options: [
        { id: uid(), text: answerText, isCorrect: true },
        // Add fake options if we wanted to force multiple choice, but for flashcards 1 is enough
      ],
      multipleCorrect: false,
      explanation: "Răspuns generat din baza de date oficială.",
      category: currentChapter,
      sourceBook: "Kumar"
    });
  }
  
  return flashcards;
}

async function main() {
  console.log("Parsing Kumar Flashcards...");
  const filePath = 'C:\\Users\\Iulia\\Desktop\\Rezidentiat\\Grile\\Kumar -  complement simplu.pdf';
  const questions = await parseFlashcardPdf(filePath);
  
  console.log(`Successfully extracted ${questions.length} flashcards!`);
  
  const quizDb = {
    id: "rezi-kumar-flashcards-1",
    title: "Kumar - Concepte Cheie",
    description: "Extrase directe pentru fixare rapidă.",
    emoji: "⚡",
    category: "Rezidențiat",
    kind: "flashcard",
    questions: questions,
    createdAt: Date.now(),
    color: "blue"
  };

  const outPath = path.join(__dirname, '..', 'src', 'data', 'rezidentiat', 'kumar_flashcards.json');
  fs.writeFileSync(outPath, JSON.stringify(quizDb, null, 2), 'utf8');
  console.log(`Saved to ${outPath}`);
  
  // Preview
  console.log("\nPreview of first flashcard:");
  console.log(JSON.stringify(questions[0], null, 2));
}

main().catch(console.error);
