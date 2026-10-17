import { questions } from './src/data/questions';

questions.forEach((q, idx) => {
  if (q.options && q.options.length !== 4) {
    console.log(`Question ${q.id} at index ${idx} has ${q.options.length} options`);
  }
  if (q.options) {
      q.options.forEach((opt, optIdx) => {
          if (!/^[A-D][)\.]\s/i.test(opt)) {
              console.log(`Question ${q.id} option ${optIdx} lacks A/B/C/D prefix: "${opt}"`);
          }
      })
  }
});
