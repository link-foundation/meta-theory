### Последовательности и множества, определённые в терминах связей

В предыдущих разделах мы показали, что любой кортеж длины $n$ может быть эквивалентно представлен в виде цепочки связей-дуплетов ($L \to L^2$). Теперь мы делаем следующий шаг: формально определяем **последовательности** и **множества** исключительно в терминах связей-дуплетов.

Это важный шаг, поскольку последовательности и множества являются фундаментальными структурами данных, лежащими в основе теории множеств и теории типов. Показав, что они могут быть полностью выражены через связи, мы демонстрируем выразительную мощь теории связей.

#### Последовательности как деревья связей

Последовательность в теории связей определяется как **дерево связей-дуплетов**. Каждый элемент последовательности представлен дуплетом $(значение, ссылка\_на\_следующий)$, где $ссылка\_на\_следующий$ указывает на следующий дуплет в цепочке. Пустая последовательность представляется пустым списком дуплетов.

Ключевые операции:
- **ListToSequence** — преобразование обычного списка ссылок в последовательность связей-дуплетов
- **SequenceToList** — обратное преобразование последовательности в список
- **SequenceConcat** — конкатенация двух последовательностей
- **SequenceAppend** / **SequencePrepend** — добавление элемента в конец или начало

Эти операции реализуются через уже доказанные функции преобразования `NestedPairToDupletList` и `DupletListToNestedPair` из предыдущих разделов.

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/SequenceDefinitions.v)

```rocq
Require Import AssociativeNetworkDefinitions.
Require Import AssociativeNetworkConversions.

(* Последовательность, определённая в терминах связей-дуплетов *)
Definition Sequence := AssociativeNetworkDupletList.

(* Пустая последовательность *)
Definition EmptySequence : Sequence := nil.

(* Создание последовательности из одного элемента *)
Definition SingletonSequence (value : Link) : Sequence :=
  (value, 0) :: nil.

(* Преобразование списка ссылок в последовательность связей-дуплетов *)
Definition ListToSequence (l : list Link) : Sequence :=
  NestedPairToDupletList l.

(* Преобразование последовательности обратно в список ссылок *)
Definition SequenceToList (s : Sequence) : list Link :=
  DupletListToNestedPair s.

(* Конкатенация двух последовательностей *)
Definition SequenceConcat (s1 s2 : Sequence) : Sequence :=
  let l1 := SequenceToList s1 in
  let l2 := SequenceToList s2 in
  ListToSequence (l1 ++ l2).
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/SequenceDefinitions.lean)

```lean
import AssociativeNetworkDefinitions
import AssociativeNetworkConversions

-- Последовательность, определённая в терминах связей-дуплетов
abbrev Sequence := AssociativeNetworkDupletList

-- Пустая последовательность
def EmptySequence : Sequence := []

-- Создание последовательности из одного элемента
def SingletonSequence (value : Link) : Sequence :=
  [(value, 0)]

-- Преобразование списка ссылок в последовательность связей-дуплетов
def ListToSequence (l : List Link) : Sequence :=
  NestedPairToDupletList l

-- Преобразование последовательности обратно в список ссылок
def SequenceToList (s : Sequence) : List Link :=
  DupletListToNestedPair s

-- Конкатенация двух последовательностей
def SequenceConcat (s1 s2 : Sequence) : Sequence :=
  let l1 := SequenceToList s1
  let l2 := SequenceToList s2
  ListToSequence (l1 ++ l2)
```

#### Эквивалентность множеств и последовательностей

Прежде чем определить множества, необходимо формально доказать, что любое конечное множество может быть представлено как **упорядоченная уникальная последовательность** — последовательность без дубликатов, отсортированная в строго возрастающем порядке.

Это доказательство адаптировано из [проекта set_sequence_equivalence](https://github.com/konard/subset-sum/tree/main/proofs/set_sequence_equivalence) и включает:

1. **StrictlyAscending** — предикат строго возрастающего списка
2. **NoDuplicates** — предикат списка без дубликатов
3. **insertSorted** — вставка элемента в отсортированный список с пропуском дубликатов
4. **toOrderedUnique** — преобразование произвольного списка в строго возрастающий

**Основная теорема** (`set_sequence_equivalence`): для любого списка натуральных чисел существует строго возрастающий список, содержащий в точности те же элементы.

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/SetSequenceEquivalence.v)

```rocq
(* Список является строго возрастающим, если каждый элемент строго меньше следующего *)
Fixpoint StrictlyAscending (l : list nat) : Prop :=
  match l with
  | [] => True
  | [_] => True
  | x :: ((y :: _) as rest) => x < y /\ StrictlyAscending rest
  end.

(* Вставка элемента в отсортированный список с сохранением порядка *)
Fixpoint insertSorted (x : nat) (l : list nat) : list nat :=
  match l with
  | [] => [x]
  | y :: rest =>
    if x <? y then x :: y :: rest
    else if x =? y then y :: rest
    else y :: insertSorted x rest
  end.

(* Сортировка списка в строго возрастающем порядке *)
Fixpoint toOrderedUnique (l : list nat) : list nat :=
  match l with
  | [] => []
  | x :: rest => insertSorted x (toOrderedUnique rest)
  end.

(* ОСНОВНАЯ ТЕОРЕМА: Эквивалентность множества и последовательности *)
Theorem set_sequence_equivalence : forall l : list nat,
  exists l' : list nat,
    IsOrderedUniqueSequence l' /\
    (forall x, In x l' <-> In x l).
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/SetSequenceEquivalence.lean)

```lean
/-- Список является строго возрастающим -/
def StrictlyAscending : List Nat → Prop
  | [] => True
  | [_] => True
  | x :: y :: rest => x < y ∧ StrictlyAscending (y :: rest)

/-- Вставка элемента в отсортированный список с сохранением порядка -/
def insertSorted (x : Nat) : List Nat → List Nat
  | [] => [x]
  | y :: rest =>
    if x < y then x :: y :: rest
    else if x = y then y :: rest
    else y :: insertSorted x rest

/-- Сортировка списка в строго возрастающем порядке -/
def toOrderedUnique : List Nat → List Nat
  | [] => []
  | x :: rest => insertSorted x (toOrderedUnique rest)

/-- Основная теорема: Каждый список может быть преобразован в упорядоченную
    уникальную последовательность с теми же элементами -/
theorem set_sequence_equivalence (l : List Nat) :
  ∃ l' : List Nat,
    IsOrderedUniqueSequence l' ∧
    (∀ x, x ∈ l' ↔ x ∈ l)
```

#### Множества как упорядоченные уникальные последовательности связей

Используя доказанную эквивалентность, мы определяем **множество** как упорядоченную уникальную **последовательность связей-дуплетов**. Множество — это та же структура `Sequence` (список дуплетов), но с дополнительным инвариантом: его элементы образуют строго возрастающий список.

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/SetDefinitions.v)

```rocq
Require Import AssociativeNetworkDefinitions.
Require Import AssociativeNetworkConversions.
Require Import SequenceDefinitions.
Require Import SetSequenceEquivalence.

(* Множество ссылок — это последовательность связей-дуплетов,
   элементы которой образуют строго возрастающий список *)
Definition LinkSet := Sequence.

(* Предикат корректности множества *)
Definition IsValidSet (s : LinkSet) : Prop :=
  IsOrderedUniqueSequence (SequenceToList s).

(* Преобразование списка ссылок в множество *)
Definition ListToSet (l : list Link) : LinkSet :=
  ListToSequence (toOrderedUnique l).

(* Принадлежность элемента множеству *)
Definition InSet (x : Link) (s : LinkSet) : Prop :=
  In x (SetToList s).

(* Объединение двух множеств *)
Definition SetUnion (s1 s2 : LinkSet) : LinkSet :=
  ListToSet ((SetToList s1) ++ (SetToList s2)).

(* ListToSet всегда производит корректное множество *)
Theorem ListToSet_is_valid : forall l : list Link,
  IsOrderedUniqueSequence (toOrderedUnique l).
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/SetDefinitions.lean)

```lean
import SequenceDefinitions
import SetSequenceEquivalence

open SetSequenceEquivalence

-- Множество ссылок — это последовательность связей-дуплетов
abbrev LinkSet := Sequence

-- Предикат корректности множества
def IsValidSet (s : LinkSet) : Prop :=
  IsOrderedUniqueSequence (SequenceToList s)

-- Преобразование списка ссылок в множество
def ListToSet (l : List Link) : LinkSet :=
  ListToSequence (toOrderedUnique l)

-- Принадлежность элемента множеству
def InSet (x : Link) (s : LinkSet) : Prop :=
  x ∈ SetToList s

-- Объединение двух множеств
def SetUnion (s1 s2 : LinkSet) : LinkSet :=
  ListToSet ((SetToList s1) ++ (SetToList s2))

-- ListToSet всегда производит корректное множество
theorem ListToSet_is_valid (l : List Link) :
    IsOrderedUniqueSequence (toOrderedUnique l)
```

#### Значение результатов

Таким образом, мы формально показали, что:

1. **Последовательности** могут быть полностью определены в терминах связей-дуплетов ($L \to L^2$)
2. **Множества** могут быть определены как особый вид последовательностей (с инвариантом упорядоченности и уникальности)
3. Теорема `set_sequence_equivalence` гарантирует, что любое конечное множество натуральных чисел может быть представлено как упорядоченная уникальная последовательность

Всё это означает, что и последовательности, и множества **выражены исключительно через связи-дуплеты** — минимальную структуру теории связей $L \to L^2$.
