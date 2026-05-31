import { extractDate } from '../src/features/chat/parser/parseDate.ts';
console.log('тест 1:', extractDate('телевизор 500 5 июня'));
console.log('тест 2:', extractDate('5 июня'));
console.log('тест 3:', extractDate('завтра'));
console.log('тест 4:', extractDate('через неделю'));
