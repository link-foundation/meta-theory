/-
  SetDefinitions.lean - Определение множеств в терминах последовательностей связей.

  Множество определяется как упорядоченная уникальная последовательность —
  то есть последовательность связей-дуплетов, элементы которой строго
  возрастают и не содержат дубликатов.

  Это ключевой шаг: имея последовательности, определённые в терминах связей (дуплетов),
  мы теперь определяем множества как особый вид последовательностей.
  Таким образом, множества также выражены исключительно через связи.
-/
import AssociativeNetworkDefinitions
import AssociativeNetworkConversions
import SequenceDefinitions
import SetSequenceEquivalence

open SetSequenceEquivalence

-- * Множества как упорядоченные уникальные последовательности связей

-- Множество ссылок — это последовательность связей-дуплетов,
-- элементы которой образуют строго возрастающий список (без дубликатов).
abbrev LinkSet := Sequence

-- Предикат: является ли последовательность корректным множеством
-- (упорядоченная уникальная последовательность)
def IsValidSet (s : LinkSet) : Prop :=
  IsOrderedUniqueSequence (SequenceToList s)

-- Пустое множество
def EmptySet : LinkSet := EmptySequence

-- Множество из одного элемента
def SingletonSet (value : Link) : LinkSet :=
  SingletonSequence value

-- Преобразование списка ссылок в множество (с сортировкой и удалением дубликатов)
def ListToSet (l : List Link) : LinkSet :=
  ListToSequence (toOrderedUnique l)

-- Преобразование множества обратно в список ссылок
def SetToList (s : LinkSet) : List Link :=
  SequenceToList s

-- Принадлежность элемента множеству
def InSet (x : Link) (s : LinkSet) : Prop :=
  x ∈ SetToList s

-- Объединение двух множеств
def SetUnion (s1 s2 : LinkSet) : LinkSet :=
  ListToSet ((SetToList s1) ++ (SetToList s2))

-- Пересечение двух множеств
def listIntersect : List Link → List Link → List Link
  | [], _ => []
  | x :: rest, l2 =>
    if l2.any (· == x) then x :: listIntersect rest l2
    else listIntersect rest l2

def SetIntersection (s1 s2 : LinkSet) : LinkSet :=
  ListToSet (listIntersect (SetToList s1) (SetToList s2))

-- Подмножество: s1 ⊆ s2
def IsSubset (s1 s2 : LinkSet) : Prop :=
  ∀ x, InSet x s1 → InSet x s2

-- * Теорема: результат ListToSet всегда является корректным множеством

-- ListToSet всегда производит корректное множество
theorem ListToSet_is_valid (l : List Link) :
    IsOrderedUniqueSequence (toOrderedUnique l) := by
  exact toOrderedUnique_is_ascending l

-- Элемент принадлежит множеству тогда и только тогда, когда он принадлежит исходному списку
theorem ListToSet_membership (x : Link) (l : List Link) :
    x ∈ toOrderedUnique l ↔ x ∈ l := by
  exact mem_toOrderedUnique x l

-- * Примеры

-- Создание множества из списка с дубликатами
#eval ListToSet [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]
-- Множество {1, 2, 3, 4, 5, 6, 9} в виде дуплетов

-- Множество из одного элемента
#eval SingletonSet 42

-- Пустое множество
#eval EmptySet

-- Объединение множеств
#eval SetUnion (ListToSet [1, 3, 5]) (ListToSet [2, 4, 6])
-- Ожидается: представление {1, 2, 3, 4, 5, 6}
