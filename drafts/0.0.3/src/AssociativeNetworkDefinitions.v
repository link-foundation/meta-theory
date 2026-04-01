Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.

(* Множество ссылок на вектора: L ⊆ ℕ₀ *)
Definition Link := nat.

(* Значение Link по умолчанию: ноль *)
Definition LinkDefault : Link := 0.

(* Множество векторов ссылок длины n ∈ ℕ₀: VectorOfLinks ⊆ Lⁿ *)
Definition VectorOfLinks (n : nat) := t Link n.

(* Значение VectorOfLinks по умолчанию *)
Definition VectorOfLinksDefault (n : nat) : VectorOfLinks n := Vector.const LinkDefault n.

(* Множество всех ассоциаций: Association = Link × VectorOfLinks *)
Definition Association (n : nat) := prod Link (VectorOfLinks n).

(* Ассоциативная сеть векторов длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : Link → VectorOfLinks} *)
Definition AssociativeNetworkVectorFunction (n : nat) := Link -> VectorOfLinks n.

(* Ассоциативная сеть векторов длины n (или n-мерная ассоциативная сеть) в виде последовательности *)
Definition AssociativeNetworkVectorList (n : nat) := list (VectorOfLinks n).

(* Вложенные упорядоченные пары *)
Definition NestedPair := list Link.

(* Ассоциативная сеть вложенных упорядоченных пар: anetl : Link → NestedPair *)
Definition AssociativeNetworkNestedPairFunction := Link -> NestedPair.

(* Ассоциативная сеть вложенных упорядоченных пар в виде последовательности вложенных упорядоченных пар *)
Definition AssociativeNetworkNestedPairList := list NestedPair.

(* Дуплет ссылок *)
Definition Duplet := prod Link Link.

(* Значение Duplet по умолчанию: пара из двух LinkDefault, используется для обозначения пустого дуплета *)
Definition DupletDefault : Duplet := (LinkDefault, LinkDefault).

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : Link → Link² *)
Definition AssociativeNetworkDupletFunction := Link -> Duplet.

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов *)
Definition AssociativeNetworkDupletList := list Duplet.
