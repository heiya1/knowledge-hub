import { Extension, InputRule } from '@tiptap/core';

// Common emoji name to Unicode mapping
const emojiMap: Record<string, string> = {
  // Faces
  smile: '\uD83D\uDE0A',
  grin: '\uD83D\uDE01',
  laugh: '\uD83D\uDE02',
  wink: '\uD83D\uDE09',
  sweat: '\uD83D\uDE05',
  cry: '\uD83D\uDE22',
  angry: '\uD83D\uDE20',
  cool: '\uD83D\uDE0E',
  nerd: '\uD83E\uDD13',
  think: '\uD83E\uDD14',
  ghost: '\uD83D\uDC7B',
  skull: '\uD83D\uDC80',
  poop: '\uD83D\uDCA9',

  // Hands
  thumbsup: '\uD83D\uDC4D',
  '+1': '\uD83D\uDC4D',
  thumbsdown: '\uD83D\uDC4E',
  '-1': '\uD83D\uDC4E',
  clap: '\uD83D\uDC4F',
  wave: '\uD83D\uDC4B',
  pray: '\uD83D\uDE4F',
  muscle: '\uD83D\uDCAA',
  ok: '\uD83D\uDC4C',
  peace: '\u270C\uFE0F',
  fist: '\u270A',
  point_up: '\u261D\uFE0F',

  // Symbols
  heart: '\u2764\uFE0F',
  fire: '\uD83D\uDD25',
  star: '\u2B50',
  check: '\u2705',
  x: '\u274C',
  warning: '\u26A0\uFE0F',
  info: '\u2139\uFE0F',
  question: '\u2753',
  bulb: '\uD83D\uDCA1',
  rocket: '\uD83D\uDE80',
  tada: '\uD83C\uDF89',
  eyes: '\uD83D\uDC40',
  sparkles: '\u2728',
  bug: '\uD83D\uDC1B',
  hundred: '\uD83D\uDCAF',
  zzz: '\uD83D\uDCA4',
  boom: '\uD83D\uDCA5',

  // Objects
  memo: '\uD83D\uDCDD',
  book: '\uD83D\uDCD6',
  link: '\uD83D\uDD17',
  lock: '\uD83D\uDD12',
  key: '\uD83D\uDD11',
  gear: '\u2699\uFE0F',
  hammer: '\uD83D\uDD28',
  wrench: '\uD83D\uDD27',
  package: '\uD83D\uDCE6',
  truck: '\uD83D\uDE9A',
  calendar: '\uD83D\uDCC5',
  clock: '\uD83D\uDD50',
  hourglass: '\u23F3',
  bell: '\uD83D\uDD14',
  pin: '\uD83D\uDCCC',
  folder: '\uD83D\uDCC1',
  file: '\uD83D\uDCC4',
  trash: '\uD83D\uDDD1\uFE0F',
  search: '\uD83D\uDD0D',
  plus: '\u2795',
  minus: '\u2796',

  // Arrows
  arrow_right: '\u27A1\uFE0F',
  arrow_left: '\u2B05\uFE0F',
  arrow_up: '\u2B06\uFE0F',
  arrow_down: '\u2B07\uFE0F',

  // Food & drink
  coffee: '\u2615',
  beer: '\uD83C\uDF7A',
  pizza: '\uD83C\uDF55',
  cake: '\uD83C\uDF82',
  gift: '\uD83C\uDF81',

  // Nature
  sun: '\u2600\uFE0F',
  moon: '\uD83C\uDF19',
  cloud: '\u2601\uFE0F',
  rain: '\uD83C\uDF27\uFE0F',
  snow: '\u2744\uFE0F',
  dog: '\uD83D\uDC15',
  cat: '\uD83D\uDC08',
  earth: '\uD83C\uDF0D',

  // Activities
  flag: '\uD83C\uDFC1',
  trophy: '\uD83C\uDFC6',
};

export const EmojiExtension = Extension.create({
  name: 'emoji',

  addInputRules() {
    return [
      new InputRule({
        find: /:([a-z0-9_+-]+):\s$/,
        handler: ({ state, range, match }) => {
          const emoji = emojiMap[match[1]];
          if (emoji) {
            const { tr } = state;
            tr.replaceWith(range.from, range.to, state.schema.text(emoji + ' '));
          }
        },
      }),
    ];
  },
});

export { emojiMap };
