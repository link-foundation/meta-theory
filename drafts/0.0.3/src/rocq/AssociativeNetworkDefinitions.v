Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.

(* Множество ссылок на кортежи: L ⊆ ℕ₀ *)
Definition Link := nat.

(* Значение Link по умолчанию: ноль *)
Definition LinkDefault : Link := 0.

(* Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfLinks ⊆ Lⁿ *)
Definition TupleOfLinks (n : nat) := t Link n.

(* Значение TupleOfLinks по умолчанию *)
Definition TupleOfLinksDefault (n : nat) : TupleOfLinks n := Vector.const LinkDefault n.

(* Множество всех ассоциаций: Association = Link × TupleOfLinks *)
Definition Association (n : nat) := prod Link (TupleOfLinks n).

(* Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : Link → TupleOfLinks} *)
Definition AssociativeNetworkTupleFunction (n : nat) := Link -> TupleOfLinks n.

(* Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) в виде последовательности *)
Definition AssociativeNetworkTupleList (n : nat) := list (TupleOfLinks n).

(* Список ссылок (ранее NestedPair — вложенные упорядоченные пары): LinkList ⊆ List(L) *)
Definition LinkList := list Link.

(* Ассоциативная сеть списков ссылок: anetl : Link → LinkList *)
Definition AssociativeNetworkLinkListFunction := Link -> LinkList.

(* Ассоциативная сеть списков ссылок в виде последовательности списков ссылок *)
Definition AssociativeNetworkLinkListList := list LinkList.

(* Дуплет ссылок *)
Definition Duplet := prod Link Link.

(* Значение Duplet по умолчанию: пара из двух LinkDefault, используется для обозначения пустого дуплета *)
Definition DupletDefault : Duplet := (LinkDefault, LinkDefault).

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : Link → Link² *)
Definition AssociativeNetworkDupletFunction := Link -> Duplet.

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов *)
Definition AssociativeNetworkDupletList := list Duplet.
