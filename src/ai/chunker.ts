export function chunkText(text: string, sourceName: string, chunkSize = 1000, overlap = 100): { text: string; id: string }[] {
  const chunks: { text: string; id: string }[] = [];
  let currentIndex = 0;

  // Normalize whitespace
  const cleanText = text.replace(/\s+/g, ' ').trim();

  while (currentIndex < cleanText.length) {
    let end = currentIndex + chunkSize;
    
    if (end < cleanText.length) {
      // Try to find a good breaking point: paragraph end, then sentence end, then word end
      const searchWindow = cleanText.slice(Math.max(currentIndex, end - 200), end + 50);
      
      let breakPoint = -1;
      const markers = ['\n\n', '. ', '? ', '! ', ' '];
      
      for (const marker of markers) {
        const lastIdx = searchWindow.lastIndexOf(marker);
        if (lastIdx !== -1) {
          // Adjust breakpoint relative to the start of the window
          breakPoint = Math.max(currentIndex, end - 200) + lastIdx + marker.length;
          break;
        }
      }
      
      if (breakPoint !== -1) {
        end = breakPoint;
      }
    } else {
      end = cleanText.length;
    }

    const chunkContent = cleanText.slice(currentIndex, end).trim();
    if (chunkContent.length > 10) {
      chunks.push({
        text: chunkContent,
        id: `${sourceName}-${currentIndex}`
      });
    }

    currentIndex = end - overlap;
    // Safety check to avoid infinite loops if overlap >= chunkSize
    if (currentIndex <= currentIndex + overlap - chunkSize) {
      currentIndex = end;
    }
  }

  return chunks;
}
