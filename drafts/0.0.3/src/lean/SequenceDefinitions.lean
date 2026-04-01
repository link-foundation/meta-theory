/-
  SequenceDefinitions.lean - Определение последовательностей в терминах связей.

  Последовательность определяется как вложенная структура связей-дуплетов,
  образующая бинарное дерево. Листья дерева — это элементы последовательности,
  а каждый внутренний узел — это связь-дуплет (левое_поддерево, правое_поддерево).

  Примеры:
    [1, 2, 3, 4] = ((1, 2), (3, 4))   — сбалансированный вариант
    [1, 2, 3, 4] = (((1, 2), 3), 4)   — левая лестница
    [1, 2, 3, 4] = (1, (2, (3, 4)))   — правая лестница

  Это формализует идею из рукописи теории связей:
  последовательность — это дерево связей, где связи играют роль ветвей,
  а листья дерева представляют собственно элементы последовательности.

  Адаптировано из: https://github.com/linksplatform/Documentation/tree/main/doc/LinksTheoryManuscriptDraft/05%20Sequences
  См. также: https://github.com/linksplatform/Data.Doublets.Sequences/blob/main/csharp/Platform.Data.Doublets.Sequences/Converters/BalancedVariantConverter.cs
-/
import AssociativeNetworkDefinitions
import AssociativeNetworkConversions

-- * Последовательности как вложенные структуры связей

/-- Дерево связей: рекурсивная структура, представляющая последовательность.
    - Leaf (лист): одиночный элемент-ссылка
    - Node (узел): связь-дуплет, состоящая из двух поддеревьев -/
inductive LinkTree where
  | Leaf : Link → LinkTree
  | Node : LinkTree → LinkTree → LinkTree
  deriving Repr

-- Последовательность — это дерево связей
abbrev Sequence := LinkTree

-- Получение листьев дерева (элементов последовательности) слева направо
def TreeToList : LinkTree → List Link
  | .Leaf x => [x]
  | .Node left right => TreeToList left ++ TreeToList right

-- Длина последовательности (количество листьев)
def TreeLength : LinkTree → Nat
  | .Leaf _ => 1
  | .Node left right => TreeLength left + TreeLength right

-- * Алгоритмы создания последовательностей

/-- Правая лестница: (1, (2, (3, 4)))
    Каждый следующий элемент вкладывается вправо. -/
def ListToRightStaircase : List Link → Option LinkTree
  | [] => none
  | [x] => some (.Leaf x)
  | x :: rest =>
    match ListToRightStaircase rest with
    | none => none
    | some t => some (.Node (.Leaf x) t)

/-- Левая лестница: (((1, 2), 3), 4)
    Каждый следующий элемент вкладывается влево. -/
def ListToLeftStaircase_ : LinkTree → List Link → LinkTree
  | acc, [] => acc
  | acc, x :: rest => ListToLeftStaircase_ (.Node acc (.Leaf x)) rest

def ListToLeftStaircase : List Link → Option LinkTree
  | [] => none
  | [x] => some (.Leaf x)
  | x :: rest => some (ListToLeftStaircase_ (.Leaf x) rest)

/-- Сбалансированный вариант: ((1, 2), (3, 4))
    Список делится пополам, каждая половина рекурсивно превращается в дерево.
    Адаптировано из BalancedVariantConverter.
    Использует fuel-параметр для гарантии завершения. -/
def ListToBalancedTree (l : List Link) (fuel : Nat := l.length + 1) : Option LinkTree :=
  match fuel with
  | 0 => none
  | fuel' + 1 =>
    match l with
    | [] => none
    | [x] => some (.Leaf x)
    | _ =>
      let mid := l.length / 2
      let left_part := l.take mid
      let right_part := l.drop mid
      match ListToBalancedTree left_part fuel', ListToBalancedTree right_part fuel' with
      | some lt, some rt => some (.Node lt rt)
      | _, _ => none

-- * Хранение дерева в ассоциативной сети дуплетов

/-- Запись дерева в ассоциативную сеть дуплетов.
    Каждый узел Node записывается как дуплет (ссылка_на_левое, ссылка_на_правое).
    Листья записываются как дуплеты (значение, значение) — связь-ссылающаяся-на-себя.
    Возвращает пару: (ассоциативная сеть дуплетов, следующее свободное смещение). -/
def TreeToDupletList_ : LinkTree → Nat → AssociativeNetworkDupletList × Nat
  | .Leaf x, offset => ([(x, x)], offset + 1)
  | .Node left right, offset =>
    let (left_net, left_next) := TreeToDupletList_ left (offset + 1)
    let (right_net, right_next) := TreeToDupletList_ right left_next
    ((offset + 1, left_next) :: left_net ++ right_net, right_next)

def TreeToDupletList (t : LinkTree) : AssociativeNetworkDupletList :=
  (TreeToDupletList_ t 0).1

-- * Примеры

-- Пример: [3, 1, 4, 1, 5] — правая лестница
#eval ListToRightStaircase [3, 1, 4, 1, 5]
-- Ожидается: some (Node (Leaf 3) (Node (Leaf 1) (Node (Leaf 4) (Node (Leaf 1) (Leaf 5)))))
-- Т.е. (3, (1, (4, (1, 5))))

-- Пример: [1, 2, 3, 4] — левая лестница
#eval ListToLeftStaircase [1, 2, 3, 4]
-- Ожидается: some (Node (Node (Node (Leaf 1) (Leaf 2)) (Leaf 3)) (Leaf 4))
-- Т.е. (((1, 2), 3), 4)

-- Пример: [1, 2, 3, 4] — сбалансированное дерево
#eval ListToBalancedTree [1, 2, 3, 4]
-- Ожидается: some (Node (Node (Leaf 1) (Leaf 2)) (Node (Leaf 3) (Leaf 4)))
-- Т.е. ((1, 2), (3, 4))

-- Пример: [1, 2, 3, 4, 5] — сбалансированное дерево
#eval ListToBalancedTree [1, 2, 3, 4, 5]
-- Ожидается: some (Node (Node (Leaf 1) (Leaf 2)) (Node (Node (Leaf 3) (Leaf 4)) (Leaf 5)))

-- Обратное преобразование: дерево в список
#eval TreeToList (.Node (.Node (.Leaf 1) (.Leaf 2)) (.Node (.Leaf 3) (.Leaf 4)))
-- Ожидается: [1, 2, 3, 4]

-- Все три варианта дают одну и ту же последовательность элементов
#eval do let t ← ListToBalancedTree [1, 2, 3, 4]; return TreeToList t    -- [1, 2, 3, 4]
#eval do let t ← ListToRightStaircase [1, 2, 3, 4]; return TreeToList t  -- [1, 2, 3, 4]
#eval do let t ← ListToLeftStaircase [1, 2, 3, 4]; return TreeToList t   -- [1, 2, 3, 4]

-- Пустая последовательность
#eval ListToRightStaircase ([] : List Link)
-- Ожидается: none

-- Последовательность из одного элемента
#eval ListToRightStaircase [42]
-- Ожидается: some (Leaf 42)
