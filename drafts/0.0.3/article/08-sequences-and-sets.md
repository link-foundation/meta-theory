### Последовательности и множества, определённые в терминах связей

В предыдущих разделах мы показали, что любой кортеж длины $n$ может быть эквивалентно представлен в виде цепочки связей-дуплетов ($R \to R^2$). Теперь мы делаем следующий шаг: формально определяем **последовательности** и **множества** исключительно в терминах связей-дуплетов.

Это важный шаг, поскольку последовательности и множества являются фундаментальными структурами данных, лежащими в основе теории множеств и теории типов. Показав, что они могут быть полностью выражены через связи, мы демонстрируем выразительную мощь теории связей.

#### Последовательности как деревья связей-дуплетов

Последовательность в теории связей — это **ссылка (Reference) на корень дерева**, хранимого в сети дуплетов. Каждый внутренний узел дерева — это связь-дуплет $(ссылка\_на\_левое, ссылка\_на\_правое)$, а листья — это элементы последовательности.

Например, последовательность $[1, 2, 3, 4]$ в сбалансированном варианте $((1, 2), (3, 4))$ хранится как:

В математической нотации: $5 \to (1, 2),\ 6 \to (3, 4),\ 7 \to (5, 6)$

В [нотации связей](https://github.com/link-foundation/links-notation):
```
(5: 1 2)   — дуплет для пары (1, 2)
(6: 3 4)   — дуплет для пары (3, 4)
(7: 5 6)   — дуплет-корень, ссылающийся на поддеревья
```

Последовательность = ссылка 7. Все элементы закодированы исключительно через связи-дуплеты.

Формально:

> $\displaystyle LinkSequence := Reference$

Последовательность идентифицируется ссылкой (Reference) на корень дерева в сети.

Одна и та же последовательность может быть представлена деревьями различной формы:

```
[1, 2, 3, 4] = ((1, 2), (3, 4))   — сбалансированный вариант
[1, 2, 3, 4] = (((1, 2), 3), 4)   — левая лестница
[1, 2, 3, 4] = (1, (2, (3, 4)))   — правая лестница
```

Все эти варианты содержат одни и те же листья в одном и том же порядке, различаясь лишь структурой дерева. Количество различных деревьев для последовательности длины $n$ определяется [числом Каталана](https://ru.wikipedia.org/wiki/Числа_Каталана).

Определены три алгоритма создания последовательностей:
- **ListToBalancedTree** — сбалансированный вариант (как в [BalancedVariantConverter](https://github.com/linksplatform/Data.Doublets.Sequences/blob/main/csharp/Platform.Data.Doublets.Sequences/Converters/BalancedVariantConverter.cs))
- **ListToRightStaircase** — правая лестница $(1, (2, (3, 4)))$
- **ListToLeftStaircase** — левая лестница $(((1, 2), 3), 4)$

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/SequenceDefinitions.v)

```rocq
Require Import NetworkDefinitions.
Require Import NetworkConversions.

(* Последовательность — это ссылка на корень дерева в сети *)
Definition LinkSequence := Reference.

(* Вспомогательное дерево для алгоритмов построения последовательностей *)
Inductive LinkTree : Type :=
  | Leaf : Reference -> LinkTree
  | Node : LinkTree -> LinkTree -> LinkTree.

(* Запись дерева в сеть дуплетов *)
Fixpoint TreeToDupletList_ (t : LinkTree) (offset : nat)
    : NetworkDupletList * nat := ...

(* Получение ссылки на корень (= последовательность) *)
Definition TreeToSequence (t : LinkTree) (offset : nat) : LinkSequence := ...

(* Полное преобразование: список → сеть дуплетов + ссылка на корень *)
Definition ListToSequence (l : list Reference) (offset : nat)
    : option (LinkSequence * NetworkDupletList) := ...
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/SequenceDefinitions.lean)

```lean
import NetworkDefinitions
import NetworkConversions

-- Последовательность — это ссылка на корень дерева в сети
abbrev LinkSequence := Reference

/-- Вспомогательное дерево для алгоритмов построения последовательностей -/
inductive LinkTree where
  | Leaf : Reference → LinkTree
  | Node : LinkTree → LinkTree → LinkTree

-- Запись дерева в сеть дуплетов
def TreeToDupletList_ : LinkTree → Nat → NetworkDupletList × Nat

-- Получение ссылки на корень (= последовательность)
def TreeToSequence (t : LinkTree) (offset : Nat) : LinkSequence

-- Полное преобразование: список → сеть дуплетов + ссылка на корень
def ListToSequence (l : List Reference) (offset : Nat)
    : Option (LinkSequence × NetworkDupletList)
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
(* ОСНОВНАЯ ТЕОРЕМА: Эквивалентность множества и последовательности *)
Theorem set_sequence_equivalence : forall l : list nat,
  exists l' : list nat,
    IsOrderedUniqueSequence l' /\
    (forall x, In x l' <-> In x l).
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/SetSequenceEquivalence.lean)

```lean
/-- Основная теорема: Каждый список может быть преобразован в упорядоченную
    уникальную последовательность с теми же элементами -/
theorem set_sequence_equivalence (l : List Nat) :
  ∃ l' : List Nat,
    IsOrderedUniqueSequence l' ∧
    (∀ x, x ∈ l' ↔ x ∈ l)
```

#### Множества как упорядоченные уникальные последовательности связей

Используя доказанную эквивалентность, мы определяем **множество** как **ссылку (Reference) на корень дерева** в сети, листья которого образуют строго возрастающий список. Для создания множества из произвольного списка сначала применяется `toOrderedUnique` (сортировка и удаление дубликатов), затем строится сбалансированное дерево и записывается в сеть.

> $\displaystyle LinkSet := Reference$

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/SetDefinitions.v)

```rocq
Require Import NetworkDefinitions.
Require Import NetworkConversions.
Require Import SequenceDefinitions.
Require Import SetSequenceEquivalence.

(* Множество ссылок — это ссылка на корень дерева в сети *)
Definition LinkSet := Reference.

(* Предикат корректности множества (через дерево) *)
Definition IsValidSetTree (s : LinkTree) : Prop :=
  IsOrderedUniqueSequence (TreeToList s).

(* Преобразование списка в множество: ссылка на корень + сеть дуплетов *)
Definition ListToSet (l : list Reference) (offset : nat)
    : option (LinkSet * NetworkDupletList) :=
  let sorted := toOrderedUnique l in
  match ListToBalancedTree sorted with
  | None => None
  | Some t => Some (TreeToSequence t offset, TreeToDupletList t offset)
  end.
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/SetDefinitions.lean)

```lean
import NetworkDefinitions
import NetworkConversions
import SequenceDefinitions
import SetSequenceEquivalence

-- Множество ссылок — это ссылка на корень дерева в сети
abbrev LinkSet := Reference

-- Предикат корректности множества (через дерево)
def IsValidSetTree (s : LinkTree) : Prop :=
  IsOrderedUniqueSequence (TreeToList s)

-- Преобразование списка в множество: ссылка на корень + сеть дуплетов
def ListToSet (l : List Reference) (offset : Nat)
    : Option (LinkSet × NetworkDupletList)
```

#### Значение результатов

Таким образом, мы формально показали, что:

1. **Последовательности** определены как ссылки на корни деревьев связей-дуплетов ($R \to R^2$) в сети
2. **Множества** определены как последовательности с инвариантом упорядоченности и уникальности листьев
3. Теорема `set_sequence_equivalence` гарантирует, что любое конечное множество натуральных чисел может быть представлено как упорядоченная уникальная последовательность

Всё это означает, что и последовательности, и множества **выражены исключительно через связи-дуплеты** — минимальную структуру теории связей $R \to R^2$.
