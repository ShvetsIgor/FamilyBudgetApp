import { parseMessage } from '../src/features/chat/parser/parse.ts';

try {
  console.log('тест 1:', parseMessage('Телевизор 500 5 июня', { learned: {} }));
} catch (e) {
  console.log('ОШИБКА 1:', e.message, e.stack);
}

try {
  console.log('тест 2:', parseMessage('Телевизор 500 05.06', { learned: {} }));
} catch (e) {
  console.log('ОШИБКА 2:', e.message);
}

try {
  console.log('тест 3:', parseMessage('Телевизор 500 завтра', { learned: {} }));
} catch (e) {
  console.log('ОШИБКА 3:', e.message);
}

try {
  console.log('тест 4:', parseMessage('Телевизор 500 через неделю', { learned: {} }));
} catch (e) {
  console.log('ОШИБКА 4:', e.message);
}
