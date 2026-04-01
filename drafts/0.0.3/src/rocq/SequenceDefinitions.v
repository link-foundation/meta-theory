(**
  SequenceDefinitions.v - Определение последовательностей в терминах связей.

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
*)

Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Require Import AssociativeNetworkDefinitions.
Require Import AssociativeNetworkConversions.

(** * Последовательности как вложенные структуры связей *)

(** Дерево связей: рекурсивная структура, представляющая последовательность.
    - Leaf (лист): одиночный элемент-ссылка
    - Node (узел): связь-дуплет, состоящая из двух поддеревьев *)
Inductive LinkTree : Type :=
  | Leaf : Link -> LinkTree
  | Node : LinkTree -> LinkTree -> LinkTree.

(** Последовательность — это дерево связей *)
Definition Sequence := LinkTree.

(** Получение листьев дерева (элементов последовательности) слева направо *)
Fixpoint TreeToList (t : LinkTree) : list Link :=
  match t with
  | Leaf x => [x]
  | Node l r => TreeToList l ++ TreeToList r
  end.

(** Длина последовательности (количество листьев) *)
Fixpoint TreeLength (t : LinkTree) : nat :=
  match t with
  | Leaf _ => 1
  | Node l r => TreeLength l + TreeLength r
  end.

(** * Алгоритмы создания последовательностей *)

(** Правая лестница: (1, (2, (3, 4)))
    Каждый следующий элемент вкладывается вправо. *)
Fixpoint ListToRightStaircase (l : list Link) : option LinkTree :=
  match l with
  | [] => None
  | [x] => Some (Leaf x)
  | x :: rest =>
    match ListToRightStaircase rest with
    | None => None
    | Some t => Some (Node (Leaf x) t)
    end
  end.

(** Левая лестница: (((1, 2), 3), 4)
    Каждый следующий элемент вкладывается влево. *)
Fixpoint ListToLeftStaircase_ (acc : LinkTree) (l : list Link) : LinkTree :=
  match l with
  | [] => acc
  | x :: rest => ListToLeftStaircase_ (Node acc (Leaf x)) rest
  end.

Definition ListToLeftStaircase (l : list Link) : option LinkTree :=
  match l with
  | [] => None
  | [x] => Some (Leaf x)
  | x :: rest => Some (ListToLeftStaircase_ (Leaf x) rest)
  end.

(** Сбалансированный вариант: ((1, 2), (3, 4))
    Список делится пополам, каждая половина рекурсивно превращается в дерево.
    Адаптировано из BalancedVariantConverter.
    Использует fuel-параметр для гарантии завершения. *)
Fixpoint ListToBalancedTree_ (l : list Link) (fuel : nat) : option LinkTree :=
  match fuel with
  | 0 => None
  | S fuel' =>
    match l with
    | [] => None
    | [x] => Some (Leaf x)
    | _ =>
      let mid := length l / 2 in
      let left_part := firstn mid l in
      let right_part := skipn mid l in
      match ListToBalancedTree_ left_part fuel', ListToBalancedTree_ right_part fuel' with
      | Some lt, Some rt => Some (Node lt rt)
      | _, _ => None
      end
    end
  end.

Definition ListToBalancedTree (l : list Link) : option LinkTree :=
  ListToBalancedTree_ l (S (length l)).

(** * Хранение дерева в ассоциативной сети дуплетов *)

(** Запись дерева в ассоциативную сеть дуплетов.
    Каждый узел Node записывается как дуплет (ссылка_на_левое, ссылка_на_правое).
    Листья записываются как дуплеты (значение, значение) — связь-ссылающаяся-на-себя.
    Возвращает пару: (ассоциативная сеть дуплетов, ссылка на корень). *)
Fixpoint TreeToDupletList_ (t : LinkTree) (offset : nat)
    : AssociativeNetworkDupletList * nat :=
  match t with
  | Leaf x => ([(x, x)], S offset)
  | Node l r =>
    let '(left_net, left_next) := TreeToDupletList_ l (S offset) in
    let '(right_net, right_next) := TreeToDupletList_ r left_next in
    ((S offset, left_next) :: left_net ++ right_net, right_next)
  end.

Definition TreeToDupletList (t : LinkTree) : AssociativeNetworkDupletList :=
  fst (TreeToDupletList_ t 0).

(** * Примеры *)

(** Пример: [3, 1, 4, 1, 5] — правая лестница *)
Compute ListToRightStaircase [3; 1; 4; 1; 5].
(* Ожидается: Some (Node (Leaf 3) (Node (Leaf 1) (Node (Leaf 4) (Node (Leaf 1) (Leaf 5))))) *)
(* Т.е. (3, (1, (4, (1, 5)))) *)

(** Пример: [1, 2, 3, 4] — левая лестница *)
Compute ListToLeftStaircase [1; 2; 3; 4].
(* Ожидается: Some (Node (Node (Node (Leaf 1) (Leaf 2)) (Leaf 3)) (Leaf 4)) *)
(* Т.е. (((1, 2), 3), 4) *)

(** Пример: [1, 2, 3, 4] — сбалансированное дерево *)
Compute ListToBalancedTree [1; 2; 3; 4].
(* Ожидается: Some (Node (Node (Leaf 1) (Leaf 2)) (Node (Leaf 3) (Leaf 4))) *)
(* Т.е. ((1, 2), (3, 4)) *)

(** Пример: [1, 2, 3, 4, 5] — сбалансированное дерево *)
Compute ListToBalancedTree [1; 2; 3; 4; 5].
(* Ожидается: Some (Node (Node (Leaf 1) (Leaf 2)) (Node (Node (Leaf 3) (Leaf 4)) (Leaf 5))) *)
(* Т.е. ((1, 2), ((3, 4), 5)) *)

(** Обратное преобразование: дерево в список *)
Compute TreeToList (Node (Node (Leaf 1) (Leaf 2)) (Node (Leaf 3) (Leaf 4))).
(* Ожидается: [1, 2, 3, 4] *)

(** Все три варианта дают одну и ту же последовательность элементов *)
Definition balanced_1234 := match ListToBalancedTree [1; 2; 3; 4] with Some t => TreeToList t | None => [] end.
Definition right_1234 := match ListToRightStaircase [1; 2; 3; 4] with Some t => TreeToList t | None => [] end.
Definition left_1234 := match ListToLeftStaircase [1; 2; 3; 4] with Some t => TreeToList t | None => [] end.

Compute balanced_1234. (* [1, 2, 3, 4] *)
Compute right_1234.    (* [1, 2, 3, 4] *)
Compute left_1234.     (* [1, 2, 3, 4] *)

(** Пустая последовательность *)
Compute ListToRightStaircase [].
(* Ожидается: None *)

(** Последовательность из одного элемента *)
Compute ListToRightStaircase [42].
(* Ожидается: Some (Leaf 42) *)
