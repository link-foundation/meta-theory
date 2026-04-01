(**
  SetDefinitions.v - Определение множеств в терминах последовательностей связей.

  Множество определяется как упорядоченная уникальная последовательность —
  то есть дерево связей-дуплетов, листья которого образуют строго
  возрастающий список без дубликатов.

  Это ключевой шаг: имея последовательности, определённые как деревья связей,
  мы теперь определяем множества как особый вид последовательностей.
  Таким образом, множества также выражены исключительно через связи.
*)

Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Require Import AssociativeNetworkDefinitions.
Require Import AssociativeNetworkConversions.
Require Import SequenceDefinitions.
Require Import SetSequenceEquivalence.

(** * Множества как упорядоченные уникальные последовательности связей *)

(** Множество ссылок — это дерево связей (последовательность),
    листья которого образуют строго возрастающий список (без дубликатов). *)
Definition LinkSet := LinkTree.

(** Предикат: является ли дерево связей корректным множеством
    (упорядоченная уникальная последовательность листьев) *)
Definition IsValidSet (s : LinkSet) : Prop :=
  IsOrderedUniqueSequence (TreeToList s).

(** Пустое множество не может быть представлено деревом (дерево всегда содержит хотя бы один лист) *)

(** Множество из одного элемента *)
Definition SingletonSet (value : Link) : LinkSet :=
  Leaf value.

(** Преобразование списка ссылок в множество (сбалансированное дерево после сортировки и удаления дубликатов) *)
Definition ListToSet (l : list Link) : option LinkSet :=
  ListToBalancedTree (toOrderedUnique l).

(** Преобразование множества обратно в список ссылок *)
Definition SetToList (s : LinkSet) : list Link :=
  TreeToList s.

(** Принадлежность элемента множеству *)
Definition InSet (x : Link) (s : LinkSet) : Prop :=
  In x (SetToList s).

(** Объединение двух множеств *)
Definition SetUnion (s1 s2 : LinkSet) : option LinkSet :=
  ListToSet ((SetToList s1) ++ (SetToList s2)).

(** Пересечение двух множеств *)
Fixpoint list_intersect (l1 l2 : list Link) : list Link :=
  match l1 with
  | nil => nil
  | x :: rest =>
    if existsb (Nat.eqb x) l2
    then x :: list_intersect rest l2
    else list_intersect rest l2
  end.

Definition SetIntersection (s1 s2 : LinkSet) : option LinkSet :=
  ListToSet (list_intersect (SetToList s1) (SetToList s2)).

(** Подмножество: s1 ⊆ s2 *)
Definition IsSubset (s1 s2 : LinkSet) : Prop :=
  forall x, InSet x s1 -> InSet x s2.

(** * Теорема: ListToSet всегда содержит упорядоченные уникальные элементы *)

Theorem ListToSet_elements_valid : forall l : list Link,
  IsOrderedUniqueSequence (toOrderedUnique l).
Proof.
  intro l.
  unfold IsOrderedUniqueSequence.
  apply toOrderedUnique_is_ascending.
Qed.

(** Элемент принадлежит множеству тогда и только тогда, когда он принадлежит исходному списку *)
Theorem ListToSet_membership : forall (x : Link) (l : list Link),
  In x (toOrderedUnique l) <-> In x l.
Proof.
  intros x l.
  apply mem_toOrderedUnique.
Qed.

(** * Примеры *)

(** Создание множества из списка с дубликатами *)
Compute ListToSet [3; 1; 4; 1; 5; 9; 2; 6; 5; 3].
(* Множество {1, 2, 3, 4, 5, 6, 9} в виде сбалансированного дерева *)

(** Множество из одного элемента *)
Compute SingletonSet 42.

(** Объединение множеств *)
Compute SetUnion (SingletonSet 1) (SingletonSet 2).
