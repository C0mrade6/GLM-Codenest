// Offline fallback tasks used when the Gemini API is unavailable,
// so Learning Mode demos never break.
export const FALLBACK_TASKS = {
  easy: {
    title: 'FizzBuzz Refresher',
    description:
      'Write a function that prints numbers 1 to n, replacing multiples of 3 with "Fizz", multiples of 5 with "Buzz", and multiples of both with "FizzBuzz". Then call it with n = 20.',
    requirements: ['Loop from 1 to n inclusive', 'Correct Fizz/Buzz/FizzBuzz logic', 'Print each result on its own line', 'Call the function with n = 20'],
    starterCode: 'def fizzbuzz(n):\n    # TODO: implement\n    pass\n\nfizzbuzz(20)\n',
    hint: 'Check divisibility with the % operator; test i % 15 first.',
    difficulty: 'easy',
  },
  medium: {
    title: 'Word Frequency Counter',
    description:
      'Given a sentence, count how often each word appears (case-insensitive, ignore punctuation) and print the top 3 most frequent words with their counts.',
    requirements: ['Normalise case and strip punctuation', 'Count occurrences of each word', 'Print top 3 words sorted by count (desc)', 'No external libraries'],
    starterCode: 'sentence = "The quick brown fox jumps over the lazy dog the fox"\n# TODO: print top 3 words\n',
    hint: 'A dict works, but collections.Counter is more Pythonic.',
    difficulty: 'medium',
  },
  hard: {
    title: 'Matrix Spiral Traversal',
    description:
      'Given a 2D list (rectangular matrix), return and print the elements in spiral order (clockwise from the top-left).',
    requirements: ['Handle any rectangular m x n matrix', 'Traverse clockwise spiral', 'Return the list AND print it', 'Handle a single row or column'],
    starterCode: 'matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]\n\ndef spiral(m):\n    # TODO: implement\n    pass\n\nprint(spiral(matrix))\n',
    hint: 'Peel off the top row, then rotate the rest counter-clockwise and recurse.',
    difficulty: 'hard',
  },
};

export function fallbackTask(difficulty) {
  return FALLBACK_TASKS[difficulty] || FALLBACK_TASKS.medium;
}

export const FALLBACK_EVALUATION = (reason) => ({
  score: 0,
  summary: `Automatic evaluation is temporarily unavailable (${reason}). The team submission was recorded — ask your instructor to review it, or retry a new round.`,
  strengths: ['Submission received and saved'],
  improvements: ['Retry Learning Mode later for an AI evaluation'],
  fileComments: [],
});
