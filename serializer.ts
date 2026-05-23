/**
 * Этот файл реализует точную сериализацию мультимножества чисел 1..300 через комбинаторное ранжирование: 
 * массив превращается в частотный вектор, 
 * частотный вектор превращается в уникальный BigInt-ранг,
 * ранг превращается в короткую строку на печатном ASCII-алфавите.
 * десериализация выполняет строго обратные шаги через unranking

 * Главная идея решения: 
 * массив чисел
 * считаем, сколько раз встретилось каждое число от 1 до 300
 * получаем вектор частот длиной 300
 * превращаем этот вектор в одно большое число
 * это большое число кодируем короткой ASCII-строкой
 * порядок массива не сохраняем
 * колво мультимножеств размера n из 300 возможных чисел: C(n + 300 - 1, 300 - 1) = C(n + 299, 299)
*/

const MIN_VALUE = 1;
const MAX_VALUE = 300;

const VALUE_COUNT = MAX_VALUE - MIN_VALUE + 1;

// 5..11   → короткий режим
// 12..1000 → длинный режим

const MIN_LENGTH = 5;
const SHORT_MAX_LENGTH = 11;
const LONG_MIN_LENGTH = 12;
const MAX_LENGTH = 1000;

// ~ маркер короткого формата
const SHORT_PREFIX = '~';

// все печатные ASCII-символы от кода 33 до 126
const SHORT_ALPHABET = Array.from(
  { length: 94 },
  (_, i) => String.fromCharCode(33 + i),
).join('');

// 93 символа: от ! до } - кроме ~
const LONG_ALPHABET = Array.from(
  { length: 93 },
  (_, i) => String.fromCharCode(33 + i),
).join('');

const MAX_COMB_N = MAX_LENGTH + VALUE_COUNT - 1; //1299
const MAX_COMB_K = VALUE_COUNT - 1; //299

type ShortBudgetData = {
  offsets: Map<number, bigint>;
  minBudget: number;
  maxBudget: number;
  total: bigint;
};

// треугольник Паскаля
function buildBinomialTable(maxN: number, maxK: number): bigint[][] {
  const table: bigint[][] = Array.from({ length: maxN + 1 }, () => []);

  table[0][0] = 1n;

  for (let n = 1; n <= maxN; n++) {
    const upperK = Math.min(n, maxK);

    table[n][0] = 1n;

    for (let k = 1; k <= upperK; k++) {
      const left = table[n - 1][k - 1] ?? 0n;
      const right = table[n - 1][k] ?? 0n;

      table[n][k] = left + right;
    }
  }

  return table;
}

const BINOMIAL = buildBinomialTable(MAX_COMB_N, MAX_COMB_K);

function binomial(n: number, k: number): bigint {
  if (!Number.isInteger(n) || !Number.isInteger(k)) {
    return 0n;
  }

  if (n < 0 || k < 0 || k > n) {
    return 0n;
  }

  const normalizedK = Math.min(k, n - k); // это позволяет хранить меньше значений

  if (normalizedK > MAX_COMB_K) {
    throw new Error(`binomial(${n}, ${k}) is outside the precomputed range.`);
  }

  return BINOMIAL[n][normalizedK] ?? 0n; // если параметры невозможные, вернёт 0n
}

// подсчёт кол-ва мультимножеств
function multisetCount(valueKinds: number, total: number): bigint {
  return binomial(total + valueKinds - 1, valueKinds - 1);
}

function makeAlphabetIndex(alphabet: string): Map<string, bigint> {
  return new Map([...alphabet].map((char, index) => [char, BigInt(index)]));
}

const SHORT_ALPHABET_INDEX = makeAlphabetIndex(SHORT_ALPHABET);
const LONG_ALPHABET_INDEX = makeAlphabetIndex(LONG_ALPHABET);

// кодирование большого числа в ASCII
function encodeBase(value: bigint, alphabet: string): string {
  if (value < 0n) {
    throw new Error('Cannot encode a negative BigInt.');
  }

  const base = BigInt(alphabet.length); // ф-я превращает число в строку в системе счисления по основанию 94 / 93

  if (value === 0n) {
    return alphabet[0];
  }

  let result = '';
  let current = value;

  while (current > 0n) {
    const digit = Number(current % base);

    result = alphabet[digit] + result;
    current /= base;
  }

  return result;
}


// декодирование ASCII обратно вв Bigint
function decodeBase(
  encoded: string,
  alphabet: string,
  alphabetIndex: Map<string, bigint>,
): bigint {
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new Error('Serialized value must be a non-empty string.');
  }

  if (encoded.length > 1 && encoded[0] === alphabet[0]) {
    throw new Error('Serialized value is not canonical: leading zero digit.');
  }

  const base = BigInt(alphabet.length);

  let value = 0n;

  for (const char of encoded) {
    const digit = alphabetIndex.get(char);

    if (digit === undefined) {
      throw new Error(`Serialized value contains unsupported character: ${JSON.stringify(char)}.`);
    }

    value = value * base + digit;
  }

  return value;
}

function encodedLength(maxValueInclusive: bigint, base: number): number {
  if (maxValueInclusive < 0n) {
    return 0;
  }

  let length = 1;
  let capacity = BigInt(base);

  while (maxValueInclusive >= capacity) {
    length++;
    capacity *= BigInt(base);
  }

  return length;
}

/**
 * валидация входа
 * функция делает две вещи:
 *  проверяет корректность массива
 *  строит вектор частот
 *  [1, 1, 3]
 *  counts[0] = 2 - число 1
 *  counts[1] = 0 - число 2
 *  counts[2] = 1 - число 3
 */

function validateInput(numbers: readonly number[]): number[] {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Input must be an array of integers.');
  }

  if (numbers.length < MIN_LENGTH || numbers.length > MAX_LENGTH) {
    throw new RangeError(`Input length must be in [${MIN_LENGTH}, ${MAX_LENGTH}].`);
  }

  const counts = new Array<number>(VALUE_COUNT).fill(0);

  for (const value of numbers) {
    if (!Number.isInteger(value)) {
      throw new TypeError(`All values must be integers. Invalid value: ${value}.`);
    }

    if (value < MIN_VALUE || value > MAX_VALUE) {
      throw new RangeError(`All values must be in [${MIN_VALUE}, ${MAX_VALUE}]. Invalid value: ${value}.`);
    }

    counts[value - MIN_VALUE]++;
  }

  return counts;
}

// расчёт длины простой сериализации

function simpleLengthFromCounts(counts: readonly number[]): number {
    // для каждого числа: длина числа + 1 запятая
    // а потом -1, потому что после последнего числа запятой нет
    let length = -1;

  for (let index = 0; index < counts.length; index++) {
    const value = index + MIN_VALUE;
    const digitLength = value < 10 ? 1 : value < 100 ? 2 : 3;

    length += counts[index] * (digitLength + 1);
  }

  return length;
}

// деление чисел на категории
// потому что в зависимости от дипозона чисел будет нужен разный допустимый размер сжатой строки
function categoryTotals(counts: readonly number[]): [number, number, number] {
  let oneDigit = 0;
  let twoDigit = 0;
  let threeDigit = 0;

  for (let index = 0; index < 9; index++) {
    oneDigit += counts[index];
  }

  for (let index = 9; index < 99; index++) {
    twoDigit += counts[index];
  }

  for (let index = 99; index < 300; index++) {
    threeDigit += counts[index];
  }

  return [oneDigit, twoDigit, threeDigit];
}

// бюджет сжатой строки
// здесь считается максимум символов, который можно потратить на сжатую строку
function budgetFromCategoryTotals(
  oneDigit: number,
  twoDigit: number,
  threeDigit: number,
): number {
  const simpleLength = 2 * oneDigit + 3 * twoDigit + 4 * threeDigit - 1;
  // Потому что:
    // однозначное число занимает 1 цифру + условную запятую → 2;
    // двузначное число занимает 2 цифры + запятую → 3;
    // трёхзначное число занимает 3 цифры + запятую → 4;
    // у последнего числа запятой нет → -1.

  return Math.floor(simpleLength / 2);
}

// ранжирование вектора частот
//  эта функция превращает вектор частот в одно число rank
function rankCountsDescending(
  counts: readonly number[],
  total: number,
  valueKinds: number,
): bigint {
  let rank = 0n;
  let remaining = total;

  for (let index = 0; index < valueKinds - 1; index++) {
    const currentCount = counts[index];
    const suffixKinds = valueKinds - index - 1;

    for (let skippedCount = remaining; skippedCount > currentCount; skippedCount--) {
      const suffixSum = remaining - skippedCount;

      rank += multisetCount(suffixKinds, suffixSum); // если мы пропустили вариант с большей текущей частотой, сколько есть способов заполнить оставшиеся числа?
    }

    remaining -= currentCount;
  }

  return rank;
}

// обратное ранжирование частот
// восстанавливает частоты
// логика:
    // пробуем, сколько раз мог встретиться первый элемент
    // считаем размер блока для каждого варианта
    // если rank попадает в этот блок то это нужная частота
    // если нет- вычитаем блок

function unrankCountsDescending(
  rank: bigint,
  total: number,
  valueKinds: number,
): number[] {
  const counts = new Array<number>(valueKinds).fill(0);

  let remaining = total;
  let currentRank = rank;

  for (let index = 0; index < valueKinds - 1; index++) {
    const suffixKinds = valueKinds - index - 1;

    let selectedCount = 0;

    for (let count = remaining; count >= 0; count--) {
      const suffixSum = remaining - count;
      const blockSize = multisetCount(suffixKinds, suffixSum);

      if (currentRank < blockSize) {
        selectedCount = count;
        break;
      }

      currentRank -= blockSize;
    }

    counts[index] = selectedCount;
    remaining -= selectedCount;
  }

  counts[valueKinds - 1] = remaining;

  if (currentRank !== 0n) {
    throw new Error('Internal error: invalid non-zero rank after unranking.');
  }

  return counts;
}

//  ф-я чтобы разделять векторы частот на части
function sliceCounts(
  counts: readonly number[],
  startValue: number,
  size: number,
): number[] {
  const startIndex = startValue - MIN_VALUE;

  return counts.slice(startIndex, startIndex + size);
}

// превращает частоты обратно в массив
function pushRepeatedValues(
  result: number[],
  startValue: number,
  counts: readonly number[],
): void {
  for (let index = 0; index < counts.length; index++) {
    const value = startValue + index;

    for (let repeat = 0; repeat < counts[index]; repeat++) {
      result.push(value);
    }
  }
}

/**
 * эта ф-я считает:
 *  сколько существует массивов, где:
 *  - oneDigit чисел из диапазона 1..9
 *  - twoDigit чисел из диапазона 10..99
 *  - threeDigit чисел из диапазона 100..300
 */

function shortTripleBlock(
  oneDigit: number,
  twoDigit: number,
  threeDigit: number,
): bigint {
  return (
    multisetCount(9, oneDigit) *
    multisetCount(90, twoDigit) *
    multisetCount(201, threeDigit)
  );
}

// предрасчёт для короткого режима
// перебирает все возможные комбинации
// сколько однозначных, двузначных и трёхзначных
// для длины от 5 до 11
function buildShortBudgetData(): ShortBudgetData {
  const countByBudget = new Map<number, bigint>();

  for (let oneDigit = 0; oneDigit <= SHORT_MAX_LENGTH; oneDigit++) {
    const oneDigitWays = multisetCount(9, oneDigit);

    for (let twoDigit = 0; twoDigit <= SHORT_MAX_LENGTH - oneDigit; twoDigit++) {
      const twoDigitWays = multisetCount(90, twoDigit);

      for (
        let threeDigit = 0;
        threeDigit <= SHORT_MAX_LENGTH - oneDigit - twoDigit;
        threeDigit++
      ) {
        const total = oneDigit + twoDigit + threeDigit;

        if (total < MIN_LENGTH || total > SHORT_MAX_LENGTH) {
          continue;
        }

        const budget = budgetFromCategoryTotals(oneDigit, twoDigit, threeDigit);
        const ways = oneDigitWays * twoDigitWays * multisetCount(201, threeDigit);

        countByBudget.set(budget, (countByBudget.get(budget) ?? 0n) + ways);
      }
    }
  }

  const budgets = [...countByBudget.keys()];
  const minBudget = Math.min(...budgets);
  const maxBudget = Math.max(...budgets);

  const offsets = new Map<number, bigint>();

  let accumulator = 0n;

  for (let budget = minBudget; budget <= maxBudget + 1; budget++) {
    offsets.set(budget, accumulator);
    accumulator += countByBudget.get(budget) ?? 0n;
  }

  return {
    offsets,
    minBudget,
    maxBudget,
    total: accumulator,
  };
}

const SHORT_DATA = buildShortBudgetData();

// длинный режим
// группируем по длине массива (не по бюджету)
function buildLongOffsets(): bigint[] {
  const offsets = new Array<bigint>(MAX_LENGTH + 2).fill(0n);

  let accumulator = 0n;

  for (let length = LONG_MIN_LENGTH; length <= MAX_LENGTH + 1; length++) {
    offsets[length] = accumulator;

    if (length <= MAX_LENGTH) {
      accumulator += multisetCount(VALUE_COUNT, length);
    }
  }

  return offsets;
}

const LONG_OFFSETS = buildLongOffsets();

// самопроверка гарантий длины
// проверяем математические ограничения при запуске модуля
function assertLengthGuarantees(): void {
  for (let budget = SHORT_DATA.minBudget; budget <= SHORT_DATA.maxBudget; budget++) {
    const maxExclusive = SHORT_DATA.offsets.get(budget + 1);

    if (maxExclusive === undefined) {
      throw new Error(`Missing short offset for budget ${budget + 1}.`);
    }

    const payloadLength = encodedLength(maxExclusive - 1n, SHORT_ALPHABET.length);

    if (payloadLength + 1 > budget) { // для короткого режима
      throw new Error(`Short-mode length guarantee failed for budget ${budget}.`);
    }
  }

  for (let length = LONG_MIN_LENGTH; length <= MAX_LENGTH; length++) {
    const maxExclusive = LONG_OFFSETS[length + 1];
    const maxEncodedLength = encodedLength(maxExclusive - 1n, LONG_ALPHABET.length);
    // если код укладывается даже в минимальный бюджет, значит он укладывается для всех вариантов этой длины
    const minimalBudget = Math.floor((2 * length - 1) / 2); // самая короткая простая строка для массива длины n это когда все числа однозначные

    if (maxEncodedLength > minimalBudget) { // для длинного режима
      throw new Error(
        `Long-mode length guarantee failed for length ${length}: ${maxEncodedLength} > ${minimalBudget}.`,
      );
    }
  }
}

assertLengthGuarantees();

function sameTriple(
  left: [number, number, number],
  right: [number, number, number],
): boolean {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

/**
 * сериализация короткого режима
 * считаем:
 *     сколько чисел однозначных
 *     сколько двузначных
 *     сколько трёхзначных
 * 
 * считаем бюджет
 * находим, с какого ранга начинается группа с этим бюджетом
 */

function serializeShort(counts: readonly number[]): string {
  const [oneDigit, twoDigit, threeDigit] = categoryTotals(counts);
  const budget = budgetFromCategoryTotals(oneDigit, twoDigit, threeDigit);

  const budgetOffset = SHORT_DATA.offsets.get(budget);

  if (budgetOffset === undefined) {
    throw new Error(`Internal error: unsupported short budget ${budget}.`);
  }

  let rank = budgetOffset; // начинаем глобальный ранг с offset-а группы

  const targetTriple: [number, number, number] = [oneDigit, twoDigit, threeDigit]; // потом перебираем все возможные тройки
// и пропускаем те, которые идут раньше нашей тройки в выбранном порядке
  let foundTriple = false;

  outer:
  for (let currentOneDigit = 0; currentOneDigit <= SHORT_MAX_LENGTH; currentOneDigit++) {
    for (
      let currentTwoDigit = 0;
      currentTwoDigit <= SHORT_MAX_LENGTH - currentOneDigit;
      currentTwoDigit++
    ) {
      for (
        let currentThreeDigit = 0;
        currentThreeDigit <= SHORT_MAX_LENGTH - currentOneDigit - currentTwoDigit;
        currentThreeDigit++
      ) {
        const total = currentOneDigit + currentTwoDigit + currentThreeDigit;

        if (total < MIN_LENGTH || total > SHORT_MAX_LENGTH) {
          continue;
        }

        if (
          budgetFromCategoryTotals(
            currentOneDigit,
            currentTwoDigit,
            currentThreeDigit,
          ) !== budget
        ) {
          continue;
        }

        const currentTriple: [number, number, number] = [
          currentOneDigit,
          currentTwoDigit,
          currentThreeDigit,
        ];

        if (sameTriple(currentTriple, targetTriple)) {
          foundTriple = true;
          break outer;
        }

        // за каждую пропущенную тройку добавляется размер блока
        // т.е. сначала определяем, где находится нужная комбинация категорий
        rank += shortTripleBlock(currentOneDigit, currentTwoDigit, currentThreeDigit);
      }
    }
  }

  if (!foundTriple) {
    throw new Error('Internal error: short triple was not found.');
  }
  // потом берутся частоты внутри каждой категории
  const oneDigitCounts = sliceCounts(counts, 1, 9);
  const twoDigitCounts = sliceCounts(counts, 10, 90);
  const threeDigitCounts = sliceCounts(counts, 100, 201);

  const twoDigitWays = multisetCount(90, twoDigit);
  const threeDigitWays = multisetCount(201, threeDigit);

  // каждая категория ранжируется отдельно
  const oneDigitRank = rankCountsDescending(oneDigitCounts, oneDigit, 9);
  const twoDigitRank = rankCountsDescending(twoDigitCounts, twoDigit, 90);
  const threeDigitRank = rankCountsDescending(threeDigitCounts, threeDigit, 201);

  // потом эти три ранга склеиваем в один
  rank += (oneDigitRank * twoDigitWays + twoDigitRank) * threeDigitWays + threeDigitRank;

  // итоговый rank кодируется в ASCII
  const payload = encodeBase(rank, SHORT_ALPHABET);
  const serialized = SHORT_PREFIX + payload;

  const simpleLength = simpleLengthFromCounts(counts);

  if (serialized.length > Math.floor(simpleLength / 2)) {
    throw new Error('Internal error: short serialized value violates the compression guarantee.');
  }

  return serialized;
}

// десериализация короткого режима
function deserializeShort(serialized: string): number[] {
  const payload = serialized.slice(1); // убираем префикс ~
  const globalRank = decodeBase(payload, SHORT_ALPHABET, SHORT_ALPHABET_INDEX); // декодируем payload обратно в globalRank

  // проверяем, что ранг не выходит за допустимый диапазон
  if (globalRank >= SHORT_DATA.total) {
    throw new RangeError('Short serialized value is outside the valid domain.');
  }

  // находим бюджет, которому принадлежит этот ранг
  let budget = SHORT_DATA.minBudget;

  while (budget <= SHORT_DATA.maxBudget) {
    const left = SHORT_DATA.offsets.get(budget);
    const right = SHORT_DATA.offsets.get(budget + 1);

    if (left !== undefined && right !== undefined && left <= globalRank && globalRank < right) {
      break;
    }

    budget++;
  }

  if (budget > SHORT_DATA.maxBudget) {
    throw new RangeError('Short serialized value is outside the budget domain.');
  }

  const budgetOffset = SHORT_DATA.offsets.get(budget);

  if (budgetOffset === undefined) {
    throw new Error(`Internal error: missing budget offset ${budget}.`);
  }
  
  // получаем локальный ранг внутри бюджета
  let localRank = globalRank - budgetOffset;

  let oneDigit = 0;
  let twoDigit = 0;
  let threeDigit = 0;

  let foundTriple = false;

  outer:
  for (let currentOneDigit = 0; currentOneDigit <= SHORT_MAX_LENGTH; currentOneDigit++) {
    for (
      let currentTwoDigit = 0;
      currentTwoDigit <= SHORT_MAX_LENGTH - currentOneDigit;
      currentTwoDigit++
    ) {
      for (
        let currentThreeDigit = 0;
        currentThreeDigit <= SHORT_MAX_LENGTH - currentOneDigit - currentTwoDigit;
        currentThreeDigit++
      ) {
        const total = currentOneDigit + currentTwoDigit + currentThreeDigit;

        if (total < MIN_LENGTH || total > SHORT_MAX_LENGTH) {
          continue;
        }

        if (
          budgetFromCategoryTotals(
            currentOneDigit,
            currentTwoDigit,
            currentThreeDigit,
          ) !== budget
        ) {
          continue;
        }

        const blockSize = shortTripleBlock(
          currentOneDigit,
          currentTwoDigit,
          currentThreeDigit,
        );

        // если localRank попал в текущий блок, значит это нужная тройка
        // если не попал, блок вычитается
        if (localRank >= blockSize) {
          localRank -= blockSize;
          continue;
        }

        oneDigit = currentOneDigit;
        twoDigit = currentTwoDigit;
        threeDigit = currentThreeDigit;

        foundTriple = true;
        break outer;
      }
    }
  }

  if (!foundTriple) {
    throw new RangeError('Short serialized value is outside the triple domain.');
  }

  const twoDigitWays = multisetCount(90, twoDigit);
  const threeDigitWays = multisetCount(201, threeDigit);

  // локальный ранг делится обратно на три ранга
  const threeDigitRank = localRank % threeDigitWays;
  const afterThreeDigit = localRank / threeDigitWays;

  const twoDigitRank = afterThreeDigit % twoDigitWays;
  const oneDigitRank = afterThreeDigit / twoDigitWays;

  const result: number[] = [];

  // восстанавливаются частоты и превращаются обратно в массив
  pushRepeatedValues(
    result,
    1,
    unrankCountsDescending(oneDigitRank, oneDigit, 9),
  );

  pushRepeatedValues(
    result,
    10,
    unrankCountsDescending(twoDigitRank, twoDigit, 90),
  );

  pushRepeatedValues(
    result,
    100,
    unrankCountsDescending(threeDigitRank, threeDigit, 201),
  );

  return result;
}

/**
 * сериализация длинного режима
 * для длины n >= 12:
 *     ранжируем весь вектор частот из 300 значений
 *     добавляем offset для этой длины
 *     кодируем в base-93
 */
function serializeLong(counts: readonly number[], totalLength: number): string {
  const rank = rankCountsDescending(counts, totalLength, VALUE_COUNT);
  const globalRank = LONG_OFFSETS[totalLength] + rank; // для понимания длины массива 
  const serialized = encodeBase(globalRank, LONG_ALPHABET);

  // доп гарантия, что действительно нет ~
  if (serialized.includes(SHORT_PREFIX)) {
    throw new Error('Internal error: long alphabet leaked the short-mode prefix.');
  }

  const simpleLength = simpleLengthFromCounts(counts);

  // проверка сжатия
  if (serialized.length > Math.floor(simpleLength / 2)) {
    throw new Error('Internal error: long serialized value violates the compression guarantee.');
  }

  return serialized;
}

function findLongLength(globalRank: bigint): number {
  let left = LONG_MIN_LENGTH;
  let right = MAX_LENGTH;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);

    if (LONG_OFFSETS[middle] <= globalRank && globalRank < LONG_OFFSETS[middle + 1]) {
      return middle;
    }

    if (globalRank < LONG_OFFSETS[middle]) {
      right = middle - 1;
    } else {
      left = middle + 1;
    }
  }

  throw new RangeError('Long serialized value is outside the valid domain.');
}

// десериализация длинного режима
function deserializeLong(serialized: string): number[] {
  const globalRank = decodeBase(serialized, LONG_ALPHABET, LONG_ALPHABET_INDEX); // строка превращается обратно в глобальный ранг

  // проверяем, что такой ранг вообще существует
  if (globalRank >= LONG_OFFSETS[MAX_LENGTH + 1]) {
    throw new RangeError('Long serialized value is outside the valid domain.');
  }

  // длина массива
  const totalLength = findLongLength(globalRank);
  // локальный ранг
  const rank = globalRank - LONG_OFFSETS[totalLength];
  // восстановление частот
  const counts = unrankCountsDescending(rank, totalLength, VALUE_COUNT);

  const result: number[] = [];

  // частоты превращаются в массив
  pushRepeatedValues(result, MIN_VALUE, counts);

  return result;
}

/**
 * валидация
 * - вектор частот
 * - выбор режима
 * - сериализация
 */
export function serialize(numbers: readonly number[]): string {
  const counts = validateInput(numbers);

  if (numbers.length <= SHORT_MAX_LENGTH) {
    return serializeShort(counts);
  }

  return serializeLong(counts, numbers.length);
}

// если первый символ ~ значит короткий режим, иначе длинный
export function deserialize(serialized: string): number[] {
  if (typeof serialized !== 'string' || serialized.length === 0) {
    throw new TypeError('Serialized value must be a non-empty string.');
  }

  if (serialized[0] === SHORT_PREFIX) {
    return deserializeShort(serialized);
  }

  return deserializeLong(serialized);
}

export function simpleSerialize(numbers: readonly number[]): string {
  return numbers.join(',');
}

export function compressionRatio(numbers: readonly number[]): number {
  return simpleSerialize(numbers).length / serialize(numbers).length;
}