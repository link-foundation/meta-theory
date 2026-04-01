/-
  SequenceDefinitions.lean - Определение последовательностей в терминах связей.

  Последовательность определяется как дерево связей-дуплетов.
  Каждый элемент последовательности представлен дуплетом (элемент, ссылка_на_следующий),
  где ссылка_на_следующий указывает на следующий дуплет в последовательности.
  Пустая последовательность обозначается пустым списком дуплетов.

  Это формализует идею из теории связей: любая последовательность может быть
  представлена исключительно связями-дуплетами вида L → L².
-/
import AssociativeNetworkDefinitions
import AssociativeNetworkConversions

-- * Последовательности как деревья связей

-- Последовательность, определённая в терминах связей-дуплетов.
-- Каждый элемент — это дуплет (значение, ссылка_на_следующий).
abbrev Sequence := AssociativeNetworkDupletList

-- Пустая последовательность
def EmptySequence : Sequence := []

-- Предикат: является ли последовательность пустой
def IsEmptySequence (s : Sequence) : Prop := s = []

-- Создание последовательности из одного элемента.
-- Элемент-связь указывает на себя, обозначая конец.
def SingletonSequence (value : Link) : Sequence :=
  [(value, 0)]

-- Преобразование списка ссылок в последовательность связей-дуплетов.
-- Это ключевая операция: берём обычный список и представляем его
-- как цепочку связей-дуплетов.
def ListToSequence (l : List Link) : Sequence :=
  NestedPairToDupletList l

-- Преобразование последовательности связей-дуплетов обратно в список ссылок.
def SequenceToList (s : Sequence) : List Link :=
  DupletListToNestedPair s

-- Длина последовательности
def SequenceLength (s : Sequence) : Nat :=
  s.length

-- Конкатенация двух последовательностей
def SequenceConcat (s1 s2 : Sequence) : Sequence :=
  let l1 := SequenceToList s1
  let l2 := SequenceToList s2
  ListToSequence (l1 ++ l2)

-- Добавление элемента в конец последовательности
def SequenceAppend (s : Sequence) (value : Link) : Sequence :=
  let l := SequenceToList s
  ListToSequence (l ++ [value])

-- Добавление элемента в начало последовательности
def SequencePrepend (value : Link) (s : Sequence) : Sequence :=
  let l := SequenceToList s
  ListToSequence (value :: l)

-- * Примеры

-- Пример: создание последовательности [3, 1, 4, 1, 5]
def exampleSequence := ListToSequence [3, 1, 4, 1, 5]

-- Вычисление примера последовательности
#eval exampleSequence
-- Ожидается: [(3, 1), (1, 2), (4, 3), (1, 4), (5, 4)]

-- Обратное преобразование
#eval SequenceToList exampleSequence
-- Ожидается: [3, 1, 4, 1, 5]

-- Пустая последовательность
#eval ListToSequence []
-- Ожидается: []

#eval SequenceToList EmptySequence
-- Ожидается: []

-- Последовательность из одного элемента
#eval SingletonSequence 42
-- Ожидается: [(42, 0)]

-- Конкатенация
#eval SequenceConcat (ListToSequence [1, 2, 3]) (ListToSequence [4, 5])
-- Ожидается: представление [1, 2, 3, 4, 5] в дуплетах
