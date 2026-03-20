import { Translations } from './de'

export const en: Translations = {
  appName: 'Number King',
  error: {
    two_numbers_in_row: 'Enter an operator first',
    operator_needs_number: 'Enter a number first',
    bracket_not_allowed: 'Bracket not allowed here',
    no_open_bracket: 'No open bracket found',
    use_all_numbers: 'Use all numbers',
    invalid_expression: 'Invalid expression',
    wrong_answer: 'Not quite – try again!',
  },
  hint: {
    intermediate_value: 'Can you calculate a {{value}}?',
    think_about_target: 'The target is {{target}} – how do you get there?',
    look_at_numbers: 'Look at {{a}} and {{b}}',
    try_operator: 'Try using {{operator}}',
    keep_trying: 'You can do it!',
    next_hint: 'Next hint',
    no_more_hints: 'No more hints',
    title: 'Hints',
  },
  game: {
    target: 'TARGET',
    check: 'Check',
    correct: 'Correct! 🎉',
    streak_bonus: 'Streak bonus! 🔥',
  },
  level: {
    beginner: 'Beginner',
    advanced: 'Advanced',
    expert: 'Expert',
    locked: 'Locked',
    unlock_progress: '{{current}} of {{total}} to unlock',
  },
  settings: {
    title: 'Settings',
    levels: 'Levels',
    target_range: 'Target Range',
    target_max: 'Maximum: {{max}}',
    language: 'Language',
    progress: 'Progress',
    reset: 'Reset',
    reset_confirm: 'Really reset everything?',
    back: 'Back',
  },
  score: {
    points: 'Points',
    streak: 'Streak',
  },
}
