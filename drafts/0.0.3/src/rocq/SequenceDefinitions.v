(**
  SequenceDefinitions.v - Определение последовательностей в терминах связей.

  Последовательность определяется как дерево связей-дуплетов.
  Каждый элемент последовательности представлен дуплетом (элемент, ссылка_на_следующий),
  где ссылка_на_следующий указывает на следующий дуплет в последовательности.
  Пустая последовательность обозначается ссылкой на себя (0, 0).

  Это формализует идею из теории связей: любая последовательность может быть
  представлена исключительно связями-дуплетами вида L → L².
*)

Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Require Import AssociativeNetworkDefinitions.
Require Import AssociativeNetworkConversions.

(** * Последовательности как деревья связей *)

(** Последовательность, определённая в терминах связей-дуплетов.
    Каждый элемент — это дуплет (значение, ссылка_на_следующий).
    Пустой дуплет (0, 0) обозначает конец последовательности. *)
Definition Sequence := AssociativeNetworkDupletList.

(** Пустая последовательность *)
Definition EmptySequence : Sequence := nil.

(** Предикат: является ли последовательность пустой *)
Definition IsEmptySequence (s : Sequence) : Prop := s = nil.

(** Создание последовательности из одного элемента.
    Элемент-связь указывает на себя, обозначая конец. *)
Definition SingletonSequence (value : Link) : Sequence :=
  (value, 0) :: nil.

(** Преобразование списка ссылок в последовательность связей-дуплетов.
    Это ключевая операция: берём обычный список и представляем его
    как цепочку связей-дуплетов. *)
Definition ListToSequence (l : list Link) : Sequence :=
  NestedPairToDupletList l.

(** Преобразование последовательности связей-дуплетов обратно в список ссылок. *)
Definition SequenceToList (s : Sequence) : list Link :=
  DupletListToNestedPair s.

(** Длина последовательности *)
Definition SequenceLength (s : Sequence) : nat :=
  length s.

(** Конкатенация двух последовательностей *)
Definition SequenceConcat (s1 s2 : Sequence) : Sequence :=
  let l1 := SequenceToList s1 in
  let l2 := SequenceToList s2 in
  ListToSequence (l1 ++ l2).

(** Добавление элемента в конец последовательности *)
Definition SequenceAppend (s : Sequence) (value : Link) : Sequence :=
  let l := SequenceToList s in
  ListToSequence (l ++ (value :: nil)).

(** Добавление элемента в начало последовательности *)
Definition SequencePrepend (value : Link) (s : Sequence) : Sequence :=
  let l := SequenceToList s in
  ListToSequence (value :: l).

(** * Примеры *)

(** Пример: создание последовательности [3, 1, 4, 1, 5] *)
Definition exampleSequence := ListToSequence [3; 1; 4; 1; 5].

(** Вычисление примера последовательности *)
Compute exampleSequence.
(* Ожидается: [(3, 1), (1, 2), (4, 3), (1, 4), (5, 4)] *)

(** Обратное преобразование *)
Compute SequenceToList exampleSequence.
(* Ожидается: [3, 1, 4, 1, 5] *)

(** Пустая последовательность *)
Compute ListToSequence [].
(* Ожидается: [] *)

Compute SequenceToList EmptySequence.
(* Ожидается: [] *)

(** Последовательность из одного элемента *)
Compute SingletonSequence 42.
(* Ожидается: [(42, 0)] *)

(** Конкатенация *)
Compute SequenceConcat (ListToSequence [1; 2; 3]) (ListToSequence [4; 5]).
(* Ожидается: представление [1, 2, 3, 4, 5] в дуплетах *)
