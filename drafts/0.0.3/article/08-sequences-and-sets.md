### Последовательности и множества, определённые в терминах связей

В предыдущих разделах мы показали, что любой кортеж длины $n$ может быть эквивалентно представлен в виде цепочки связей-дуплетов ($L \to L^2$). Теперь мы делаем следующий шаг: формально определяем **последовательности** и **множества** исключительно в терминах связей-дуплетов.

Это важный шаг, поскольку последовательности и множества являются фундаментальными структурами данных, лежащими в основе теории множеств и теории типов. Показав, что они могут быть полностью выражены через связи, мы демонстрируем выразительную мощь теории связей.

#### Последовательности как деревья связей

Последовательность в теории связей определяется как **бинарное дерево связей-дуплетов** ([LinkTree](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/SequenceDefinitions.v)). Листья дерева — это элементы последовательности, а каждый внутренний узел — это связь-дуплет, объединяющая два поддерева.

Формально:
- **Leaf** (лист) — одиночный элемент-ссылка
- **Node** (узел) — связь-дуплет из двух поддеревьев

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
(* Дерево связей: рекурсивная структура, представляющая последовательность *)
Inductive LinkTree : Type :=
  | Leaf : Link -> LinkTree
  | Node : LinkTree -> LinkTree -> LinkTree.

(* Последовательность — это дерево связей *)
Definition Sequence := LinkTree.

(* Получение листьев дерева (элементов последовательности) слева направо *)
Fixpoint TreeToList (t : LinkTree) : list Link :=
  match t with
  | Leaf x => [x]
  | Node left right => TreeToList left ++ TreeToList right
  end.

(* Сбалансированный вариант: ((1, 2), (3, 4)) *)
Fixpoint ListToBalancedTree (l : list Link) : option LinkTree :=
  match l with
  | [] => None
  | [x] => Some (Leaf x)
  | _ =>
    let mid := length l / 2 in
    match ListToBalancedTree (firstn mid l), ListToBalancedTree (skipn mid l) with
    | Some lt, Some rt => Some (Node lt rt)
    | _, _ => None
    end
  end.
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/SequenceDefinitions.lean)

```lean
/-- Дерево связей: рекурсивная структура, представляющая последовательность -/
inductive LinkTree where
  | Leaf : Link → LinkTree
  | Node : LinkTree → LinkTree → LinkTree

-- Последовательность — это дерево связей
abbrev Sequence := LinkTree

-- Получение листьев дерева слева направо
def TreeToList : LinkTree → List Link
  | .Leaf x => [x]
  | .Node left right => TreeToList left ++ TreeToList right

/-- Сбалансированный вариант: ((1, 2), (3, 4)) -/
def ListToBalancedTree : List Link → Option LinkTree
  | [] => none
  | [x] => some (.Leaf x)
  | l =>
    let mid := l.length / 2
    match ListToBalancedTree (l.take mid), ListToBalancedTree (l.drop mid) with
    | some lt, some rt => some (.Node lt rt)
    | _, _ => none
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

#### Множества как упорядоченные уникальные деревья связей

Используя доказанную эквивалентность, мы определяем **множество** как **дерево связей** (`LinkTree`), листья которого образуют строго возрастающий список. Для создания множества из произвольного списка сначала применяется `toOrderedUnique` (сортировка и удаление дубликатов), затем `ListToBalancedTree` (построение сбалансированного дерева).

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/SetDefinitions.v)

```rocq
(* Множество ссылок — это дерево связей, листья которого строго возрастают *)
Definition LinkSet := LinkTree.

(* Предикат корректности множества *)
Definition IsValidSet (s : LinkSet) : Prop :=
  IsOrderedUniqueSequence (TreeToList s).

(* Преобразование списка в множество (сбалансированное дерево) *)
Definition ListToSet (l : list Link) : option LinkSet :=
  ListToBalancedTree (toOrderedUnique l).
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/SetDefinitions.lean)

```lean
-- Множество ссылок — это дерево связей
abbrev LinkSet := LinkTree

-- Предикат корректности множества
def IsValidSet (s : LinkSet) : Prop :=
  IsOrderedUniqueSequence (TreeToList s)

-- Преобразование списка в множество (сбалансированное дерево)
def ListToSet (l : List Link) : Option LinkSet :=
  ListToBalancedTree (toOrderedUnique l)
```

#### Значение результатов

Таким образом, мы формально показали, что:

1. **Последовательности** определены как бинарные деревья связей-дуплетов ($L \to L^2$), где листья — элементы, а узлы — связи
2. **Множества** определены как деревья связей с инвариантом упорядоченности и уникальности листьев
3. Теорема `set_sequence_equivalence` гарантирует, что любое конечное множество натуральных чисел может быть представлено как упорядоченная уникальная последовательность

Всё это означает, что и последовательности, и множества **выражены исключительно через связи-дуплеты** — минимальную структуру теории связей $L \to L^2$.
